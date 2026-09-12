import {parseXnl, type DataElementNode, type XnlNode} from 'xnl-core';
import type {KnowledgeFamily, KnowledgeFinding, KnowledgeSourceIndex, ModelingSchema, XnlMergeConflict, XnlMergePolicy} from 'depa-codument-domain-contract';
import {indexKnowledgeSources, validateKnowledgeIndex} from './knowledge';
import {mergeXnlNodes} from './merge';
import {isDataElement, readStableNodeId} from './registry';
import {patchDataTreeSource, patchRootBodySource, readDataBodySourceFragments} from './source-patch';
import {validateModelingNode} from './modeling-schema';
import {validateEngineeringNode} from './engineering-schema';

export interface ArchiveKnowledgeProposal {
  readonly updates: ReadonlyMap<string, string>;
  readonly conflicts: readonly (XnlMergeConflict & {readonly file: string})[];
  readonly findings: readonly KnowledgeFinding[];
}

/** Modeling deltas are desired snapshots of one context, not the aggregate
 * wrapper itself. Engineering retains its existing business-owner path. */
export function knowledgeArchiveOwnerFile(file: string, family: KnowledgeFamily): string {
  if (file.includes('\\') || file.split('/').some(part => !part || part.startsWith('.'))) throw new Error('Knowledge archive requires visible portable owner paths.');
  if (family === 'modeling' && /^[^/]+\/[^/]+\.xnl$/.test(file)) return file.replace(/\.xnl$/, '/index.xnl');
  if (family === 'engineering' && /^[^/]+\/[^/]+\/[^/]+(?:\/index)?\.xnl$/.test(file)) return file;
  throw new Error(`Invalid ${family} delta owner path '${file}'.`);
}

/** Isolated historical adapter: only old forests that the canonical parser can
 * read losslessly are mechanically enclosed. It never runs in a normal reader,
 * never rewrites a Git blob and never guesses legacy grades into DataTopology. */
export function readKnowledgeArchiveBaseline(sources: ReadonlyMap<string, string>, family: KnowledgeFamily): KnowledgeSourceIndex {
  const projected = new Map<string, string>();
  let sequence = 0;
  for (const [file, source] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    if (!file.endsWith('.xnl')) throw new Error(`Historical ${family} source '${file}' requires migration review.`);
    const ownerFile = family === 'modeling' && file.split('/').length === 2 ? knowledgeArchiveOwnerFile(file, family) : file;
    if (projected.has(ownerFile)) throw new Error(`Historical ${family} sources collide at owner '${ownerFile}'.`);
    const parsed = parseXnl(source, {textBlockStyle: true});
    if (parsed.warnings?.length || parsed.nodes.some(node => !isDataElement(node))) throw new Error(`Historical ${family} forest '${file}' requires migration review.`);
    const kind = family === 'modeling' ? 'ModelingRegistry' : 'EngineeringRegistry';
    const containsOwner = parsed.nodes.some(node => isDataElement(node) && /^(ModelingRegistry|EngineeringRegistry)$/.test(node.tag));
    projected.set(ownerFile, containsOwner ? source
      : `<${kind} #codument.baseline.owner${sequence++} envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 ${family === 'modeling' ? '{modeling_schema="codument-legacy/v1"}' : '{}'} [\n${source}\n]>`);
  }
  const result = indexKnowledgeSources(projected, family);
  requireReady(result);
  for (const member of result.registry.index.values()) {
    const schema = (member.node.attributes?.modeling_schema ?? member.node.metadata.modeling_schema ?? result.owners.get(member.file)?.attributes?.modeling_schema) as ModelingSchema;
    const errors = family === 'modeling' ? validateModelingNode(member.node, schema) : validateEngineeringNode(member.node);
    if (errors.length) throw new Error(`Historical ${family} source '${member.file}' requires migration review: ${errors.join('; ')}`);
  }
  return result;
}

/** Pure proposal; publication belongs to the enclosing archive transaction.
 * Every unresolved conflict makes the whole proposal non-publishable. */
export function proposeArchiveKnowledge(input: {
  readonly family: KnowledgeFamily;
  readonly baseSources: ReadonlyMap<string, string>;
  readonly canonicalSources: ReadonlyMap<string, string>;
  readonly deltaSources: ReadonlyMap<string, string>;
  readonly policy?: XnlMergePolicy;
}): ArchiveKnowledgeProposal {
  const {family} = input;
  if (!input.deltaSources.size) return {updates: new Map(), conflicts: [], findings: []};
  const base = readKnowledgeArchiveBaseline(input.baseSources, family);
  const ours = indexKnowledgeSources(input.canonicalSources, family);
  const theirs = indexKnowledgeSources(input.deltaSources, family, 'deltas');
  requireReady(ours); requireReady(theirs);
  const profiles = new Map<string, ModelingSchema>();
  if (family === 'modeling') {
    for (const index of [base, ours, theirs]) for (const member of index.registry.index.values()) {
      const value = (member.node.attributes?.modeling_schema ?? member.node.metadata.modeling_schema ?? index.owners.get(member.file)?.attributes?.modeling_schema) as ModelingSchema;
      if (profiles.has(member.id) && profiles.get(member.id) !== value) throw new Error(`Knowledge #${member.id} changes schema interpretation across merge inputs; explicit migration review is required.`);
      profiles.set(member.id, value);
    }
  }
  const updates = new Map<string, string>();
  const conflicts: (XnlMergeConflict & {file: string})[] = [];
  for (const [deltaFile, deltaOwner] of theirs.owners) {
    const file = knowledgeArchiveOwnerFile(deltaFile, family);
    if (updates.has(file)) throw new Error(`Multiple deltas select knowledge owner '${file}'.`);
    const current = ours.owners.get(file);
    if (current) requireCompatibleOwnerHeader(current, deltaOwner);
    const result = mergeXnlNodes(base.owners.get(file)?.body ?? [], current?.body ?? [], deltaOwner.body ?? [], input.policy);
    conflicts.push(...result.conflicts.map(conflict => ({...conflict, file})));
    if (result.conflicts.length) continue;
    const before = current ?? deltaOwner;
    const after = structuredClone(before);
    after.body = [...result.merged.values()];
    if (family === 'modeling') preserveProfileInterpretation(after.body, profiles, after.attributes?.modeling_schema as ModelingSchema);
    const source = input.canonicalSources.get(file) ?? input.deltaSources.get(deltaFile)!;
    const fragments = new Map<string, {node: DataElementNode; source: string}>();
    for (const candidate of [base.registry.sources.get(file), input.deltaSources.get(deltaFile), input.canonicalSources.get(file)]) {
      if (candidate === undefined) continue;
      for (const fragment of readDataBodySourceFragments(candidate)) fragments.set(readStableNodeId(fragment.node)!, fragment);
    }
    const proposal = patchKnowledgeBody(source, before, after, fragments);
    if (proposal !== input.canonicalSources.get(file)) updates.set(file, proposal);
  }
  if (conflicts.length) return {updates: new Map(), conflicts, findings: []};
  const next = indexKnowledgeSources(new Map([...input.canonicalSources, ...updates]), family);
  const findings = validateKnowledgeIndex(next);
  const errors = findings.filter(finding => finding.severity === 'error');
  if (errors.length) throw new Error(errors.map(finding => `${finding.file}: ${finding.message}`).join('\n'));
  return {updates, conflicts, findings};
}

function requireReady(index: KnowledgeSourceIndex): void {
  if (!index.ready) throw new Error(index.findings.map(finding => `${finding.file}: ${finding.message}`).join('\n'));
}

function patchKnowledgeBody(source: string, before: DataElementNode, after: DataElementNode,
  fragments: ReadonlyMap<string, {node: DataElementNode; source: string}>): string {
  if (JSON.stringify(before) === JSON.stringify(after)) return source;
  const members = (after.body ?? []).map(node => {
    if (!isDataElement(node)) throw new Error('Knowledge proposal requires data members.');
    const fragment = fragments.get(readStableNodeId(node)!);
    if (!fragment) throw new Error('Knowledge proposal has no observed member source.');
    return patchDataTreeSource(fragment.source, fragment.node, node);
  });
  // Delimiter spelling is source presentation, not merge authority. The member
  // writer already proved semantic equivalence; use its admitted presentation
  // for the enclosing exact-AST insertion check.
  const admitted = structuredClone(after);
  admitted.body = members.flatMap(member => parseXnl(member, {textBlockStyle: true}).nodes);
  let working = structuredClone(before);
  for (let index = (working.body?.length ?? 0) - 1; index >= 0; index--) {
    const next = structuredClone(working);
    next.body!.splice(index, 1);
    source = patchRootBodySource(source, working, next, {remove: index});
    working = next;
  }
  return members.length ? patchRootBodySource(source, working, admitted, {insert: members.join('\n')}) : source;
}

function requireCompatibleOwnerHeader(current: DataElementNode, delta: DataElementNode): void {
  // Delta identity/profile describe its own source, not a request to rename or
  // replace the canonical owner. Omitted extension fields do not delete facts.
  for (const [section, ignored] of [['metadata', ['envelopeVersion', 'specVersion']], ['attributes', ['modeling_schema']]] as const) {
    for (const [key, value] of Object.entries(delta[section] ?? {})) {
      if ((ignored as readonly string[]).includes(key)) continue;
      if (JSON.stringify(value) !== JSON.stringify(current[section]?.[key])) throw new Error(`Knowledge delta changes owner ${section}.${key}; explicit owner review is required.`);
    }
  }
  if (delta.extend && JSON.stringify(delta.extend) !== JSON.stringify(current.extend)) throw new Error('Knowledge delta changes owner subdomains; explicit owner review is required.');
}

function preserveProfileInterpretation(value: XnlNode, profiles: ReadonlyMap<string, ModelingSchema>, defaultProfile: ModelingSchema): void {
  if (Array.isArray(value)) {value.forEach(child => preserveProfileInterpretation(child, profiles, defaultProfile)); return;}
  if (!value || typeof value !== 'object') return;
  if (isDataElement(value)) {
    const id = readStableNodeId(value), profile = id ? profiles.get(id) : undefined;
    if (profile && profile !== defaultProfile && value.attributes?.modeling_schema === undefined && value.metadata.modeling_schema === undefined) {
      value.attributes = {...value.attributes, modeling_schema: profile};
    }
  }
  Object.values(value).forEach(child => preserveProfileInterpretation(child as XnlNode, profiles, defaultProfile));
}
