import { parseXnl, wordToString, type DataElementNode, type XnlNode } from 'xnl-core';
import { CODUMENT_RESOURCE_KINDS, type CodumentResourceKind, type MigrationSource,
  type ResourceMigrationInspection, type ResourceMigrationPlan, type ResourceMigrationRuntime,
  type ResourceMigrationApplyResult, type MigrationAdmissionDefinition } from 'depa-codument-domain-contract';
import { digestCanonical } from 'halfcode-cli-lite-skill-app-contract/resource';
import { isDataElement, readStableNodeId } from './registry';
import { patchDataTreeSource, readDataForestSourceFragments } from './source-patch';
import { convertMigrationXml, readMigrationXml } from './migration-xml';
import { recordHistoricalCompletion } from './historical-completion';

const ENVELOPE = 'halfcode.resource-envelope/v1' as const;
const LEGACY = 'codument.tech/v1alpha1';
const known = (tag: string): tag is CodumentResourceKind => (CODUMENT_RESOURCE_KINDS as readonly string[]).includes(tag);

function checkPath(file: string): void {
  if (!file || file.startsWith('/') || file.includes('\\') || file.includes('\0') || /^[A-Za-z]:/u.test(file)
    || file.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Migration requires a portable workspace-relative source path.');
}
function forest(source: string): DataElementNode[] {
  const parsed = parseXnl(source, {textBlockStyle: true});
  if (parsed.warnings?.length) throw new Error(parsed.warnings.map(warning => warning.message).join('; '));
  if (parsed.nodes.some(node => !isDataElement(node))) throw new Error('Migration requires unambiguous data roots.');
  return parsed.nodes as DataElementNode[];
}

export function inspectResourceMigration(input: MigrationSource): ResourceMigrationInspection {
  checkPath(input.path);
  const format: ResourceMigrationInspection['format'] = input.path.endsWith('.xnl') ? 'xnl' : input.path.endsWith('.xml') ? 'xml' : input.path.endsWith('.md') ? 'markdown' : undefined;
  const base = {path: input.path, format, fingerprint: digestCanonical({source: input.source})};
  if (format === 'xnl') {
    try {
      const roots = forest(input.source);
      return {...base, kinds: [...new Set(roots.map(root => root.tag))], apiVersions: [...new Set(roots.flatMap(root =>
        root.metadata.apiVersion === undefined ? [] : [String(root.metadata.apiVersion)]))], rootCount: roots.length, diagnostics: []};
    } catch (cause) { return {...base, kinds: [], apiVersions: [], diagnostics: [String(cause)]}; }
  }
  if (format === 'xml') {
    try {
      const {root} = readMigrationXml(input.source);
      const versions = [...root.attrs.apiVersion ? [root.attrs.apiVersion] : [],
        ...root.children.filter(node => node.tag === 'Metadata').flatMap(node => node.children.filter(child => child.tag === 'ApiVersion').map(child => child.text.trim()))];
      return {...base, kinds: [root.tag], apiVersions: [...new Set(versions)], rootCount: 1, diagnostics: []};
    } catch (cause) { return {...base, kinds: [], apiVersions: [], diagnostics: [String(cause)]}; }
  }
  return {...base, kinds: [], apiVersions: [], diagnostics: [format === 'markdown'
    ? 'Markdown requires current Agent semantic migration; preserve IDs, ownership, alternatives, feedback and evidence.'
    : 'Unsupported migration source format.']};
}

/** Changes only explicit envelope metadata, never body semantics or business
 * defaults. Actual schema and cross-resource validation belong to the apply gate. */
function currentRoot(root: DataElementNode): DataElementNode {
  const before = root.metadata;
  if ('envelopeVersion' in before || 'specVersion' in before) {
    if (before.envelopeVersion !== ENVELOPE || before.specVersion !== 1 || 'apiVersion' in before || 'version' in before) {
      throw new Error('Mixed, unknown or future envelope/spec requires review.');
    }
    return root;
  }
  if (before.apiVersion !== undefined && before.apiVersion !== LEGACY) throw new Error('Unknown legacy apiVersion requires review.');
  if (before.version !== undefined && before.version !== '1' && before.version !== 1) throw new Error('Unknown legacy resource version requires review.');
  const result = structuredClone(root);
  delete result.metadata.apiVersion;
  delete result.metadata.version;
  result.metadata.envelopeVersion = ENVELOPE;
  result.metadata.specVersion = 1;
  return result;
}

/** Preserve all admitted source outside the exact parsed root fragments,
 * including comments and between-root trivia. No decoding repair is implicit. */
function mapRoots(source: string, transform: (node: DataElementNode, fragment: string) => string): string {
  let result = '', cursor = 0;
  for (const {node, source: fragment} of readDataForestSourceFragments(source)) {
    const start = source.indexOf(fragment, cursor);
    if (start < cursor) throw new Error('Migration root source span changed.');
    result += source.slice(cursor, start) + transform(node, fragment);
    cursor = start + fragment.length;
  }
  return result + source.slice(cursor);
}

function ownerlessDurable(nodes: readonly XnlNode[], file: string): boolean {
  const parts = file.split('/');
  if (parts.at(-1)?.toLowerCase() !== 'decisions.xnl' || parts.at(-2) === 'decisions') return false;
  function visit(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(visit);
    if (!value || typeof value !== 'object') return false;
    const node = value as DataElementNode;
    if (isDataElement(node) && node.tag === 'decision') {
      const durable = node.attributes?.durable_candidate ?? node.attributes?.['durable-candidate'] ?? node.metadata.durable_candidate;
      if (durable === true || String(durable).toLowerCase() === 'true') return true;
    }
    return Object.values(value).some(visit);
  }
  return nodes.some(visit);
}

export function planResourceMigration(input: MigrationSource): ResourceMigrationPlan {
  const observed = inspectResourceMigration(input);
  function finish(status: ResourceMigrationPlan['status'], extra: Partial<ResourceMigrationPlan> = {}): ResourceMigrationPlan {
    const result = {...observed, status, targetEnvelopeVersion: ENVELOPE, targetSpecVersion: 1 as const, ...extra};
    return {...result, planDigest: digestCanonical(result)};
  }
  if (observed.diagnostics.length) return finish('review-required');
  try {
    if (observed.format === 'xml') {
      const converted = convertMigrationXml(input);
      const source = mapRoots(converted.source, (root, fragment) =>
        patchDataTreeSource(fragment, root, recordHistoricalCompletion(root, input.path, input.source)));
      return finish('planned', {migrationId: `xml.${converted.kind}.current/v1`, targetKind: converted.kind,
        targetPath: converted.targetPath, proposal: {source}});
    }
    const roots = forest(input.source);
    if (!roots.length) {
      if (/(?:^|\/)decisions(?:\/[^/]+)?\.xnl$/u.test(input.path) || input.path.startsWith('codument/decisions/')) {
        return finish('planned', {migrationId: 'xnl.empty-decision-forest.remove/v2', targetKind: 'decision', targetPath: input.path, proposal: {source: null}});
      }
      throw new Error('Empty source has no deterministic resource identity.');
    }
    if (ownerlessDurable(roots, input.path)) throw new Error('Working durable Decision ownership requires current Agent review before migration.');
    const kinds = new Set(roots.map(root => root.tag === 'decision-tree' ? 'decision' : root.tag));
    if (kinds.size !== 1 || !known([...kinds][0])) throw new Error('Unknown or mixed resource Kind requires review.');
    const kind = [...kinds][0] as CodumentResourceKind;
    if (kind !== 'decision' && roots.length !== 1) throw new Error('Single-resource Kind cannot accept multiple authority roots.');
    const source = mapRoots(input.source, (root, fragment) => {
      if (root.tag === 'decision-tree') {
        if (root.id || Object.keys(root.attributes ?? {}).length || root.extend || Object.keys(root.metadata).some(key => !['apiVersion', 'version'].includes(key))) {
          throw new Error('Decision wrapper carries identity or extension meaning; retain it for semantic review.');
        }
        currentRoot(root); // Reject unknown versions before unwrapping.
        if ((root.body ?? []).some(node => !isDataElement(node) || node.tag !== 'decision')) throw new Error('Decision wrapper has non-Decision children.');
        // Conservative until a source-aware wrapper span removal is available:
        // do not discard wrapper comments or empty authored bodies.
        throw new Error('Decision tree requires source-preserving owner review before unwrapping.');
      }
      if (!wordToString(root.id)) throw new Error('Resource root requires an explicit stable identity.');
      const current = currentRoot(root);
      const migrated = 'envelopeVersion' in root.metadata ? current : recordHistoricalCompletion(current, input.path, input.source);
      return patchDataTreeSource(fragment, root, migrated);
    });
    return finish(source === input.source ? 'noop' : 'planned', {migrationId: 'xnl.current-envelope/v1', targetKind: kind,
      targetPath: input.path, ...(source === input.source ? {} : {proposal: {source}})});
  } catch (cause) { return finish('review-required', {diagnostics: [...observed.diagnostics, String(cause)]}); }
}

/** A plan's digest and the fresh file observation bind the selected transition;
 * the caller cannot forge an alternative proposal or reuse stale validation. */
export async function applyResourceMigration(runtime: ResourceMigrationRuntime, expected: ResourceMigrationPlan): Promise<ResourceMigrationApplyResult> {
  const snapshot = await runtime.files.read(expected.path);
  const plan = planResourceMigration(snapshot);
  if (digestCanonical(plan) !== digestCanonical(expected)) throw new Error('Migration plan is stale or altered; inspect and plan again.');
  const prepared = await runtime.files.prepare(snapshot, plan);
  const result = {path: plan.path, targetPath: plan.targetPath, planDigest: plan.planDigest, backupPath: prepared.backupPath,
    targetKind: plan.targetKind, detectedKind: plan.kinds[0], detectedFormat: plan.format,
    targetEnvelopeVersion: plan.targetEnvelopeVersion, targetSpecVersion: plan.targetSpecVersion};
  try {
    if (plan.status === 'review-required' || prepared.reviewDiagnostics?.length) {
      await prepared.abort();
      return {...result, status: 'review-required', diagnostics: [...plan.diagnostics, ...prepared.reviewDiagnostics ?? []]};
    }
    const findings = await runtime.validate(prepared.validationRoot, plan, prepared.admissionRoot);
    if (findings.some(finding => finding.severity === 'error')) {
      await prepared.abort();
      return {...result, status: 'review-required', diagnostics: findings.map(finding => finding.message)};
    }
    await prepared.commit();
    return {...result, status: plan.status === 'noop' ? 'noop' : plan.proposal?.source === null ? 'removed' : 'applied',
      diagnostics: findings.map(finding => finding.message)};
  } catch (cause) {
    try { await prepared.abort(); }
    catch (recovery) { throw new AggregateError([cause, recovery], 'Migration recovery requires attention; preserve the backup and ledger.', {cause}); }
    throw cause;
  }
}

/** Disposable compiler input, never an authored workspace manifest or an
 * alternate active domain authority. The public Host injects built-in Kinds. */
export function migrationAdmissionDefinition(plan: ResourceMigrationPlan): MigrationAdmissionDefinition | undefined {
  if (plan.status === 'review-required' || plan.proposal?.source === null || !plan.targetKind || !plan.targetPath) return undefined;
  const directory = plan.targetKind === 'Track' || plan.targetKind === 'Mission';
  const entry = directory ? plan.targetKind.toLowerCase() + '.xnl' : 'candidate.xnl';
  const catalog = directory
    ? `<DirectoryResourceCatalog #candidate {resourceKind="${plan.targetKind}" root="vfs://./resources/" entry="${entry}" scope="root"}>`
    : `<FileResourceCatalog #candidate {resourceKind="${plan.targetKind}" root="vfs://./resources/"}>`;
  const parent = plan.targetPath.slice(0, plan.targetPath.lastIndexOf('/') + 1);
  return {manifest: `<SkillApp #codument.migration.candidate envelopeVersion="${ENVELOPE}" specVersion=1 (<Catalogs [${catalog}]>)>\n`,
    files: [{path: 'resources/' + entry, sourcePath: plan.targetPath},
      ...(directory ? ['proposal.md', 'design.md'].map(file => ({path: 'resources/' + file, sourcePath: parent + file})) : [])]};
}
