import { CODUMENT_APP_CATALOGS, CODUMENT_RESOURCE_KINDS, type WorkspaceAppInspection,
  type WorkspaceAppInspectionInput, type WorkspaceAppSourceSnapshot } from 'depa-codument-domain-contract';
import { digestCanonical } from 'halfcode-cli-lite-skill-app-contract/resource';
import { inspectDomainValidation } from './validate';
import { indexKnowledgeSources, validateKnowledgeIndex } from './knowledge';
import { validateDecisionSources } from './decisions';
import { readKnowledgeSettings } from './knowledge-read';
import { readAttractorProfileNames } from './config';

/** Authored initial membership, not a periodically rewritten discovery cache. */
export function renderCodumentAppManifest(appId = 'codument.workspace'): string {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)+$/u.test(appId)) {
    throw new Error('Codument App ID must be a portable dotted resource identity.');
  }
  return [
    `<SkillApp #${appId} envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (`,
    '  <Catalogs [',
    ...CODUMENT_APP_CATALOGS.map(catalog => {
      const tag = catalog.shape === 'directory' ? 'DirectoryResourceCatalog' : 'FileResourceCatalog';
      const attributes = [`resourceKind = ${JSON.stringify(catalog.kind)}`, `root = ${JSON.stringify('vfs://./' + catalog.root + '/')}`];
      if (catalog.entry) attributes.push(`entry = ${JSON.stringify(catalog.entry)}`);
      if (catalog.shape === 'directory') attributes.push('scope = "root"');
      if (catalog.recursive) {
        attributes.push('hostTraversal = "recursive"');
        if (catalog.shape === 'single-file') attributes.push('hostExtensions = [".xnl"]');
      }
      return `    <${tag} #${catalog.id} { ${attributes.join(' ')} }>`;
    }),
    '  ]>', ')>', '',
  ].join('\n');
}

function observationIdentity(value: WorkspaceAppSourceSnapshot): string {
  return digestCanonical({ manifest: value.manifestDigest, skill: value.skillSource,
    authorities: value.authorities.map(({ file, kind, digest, ownerFile }) => ({ file, kind, digest, ownerFile: ownerFile ?? null })),
    lifecycle: value.lifecycle.units.map(unit => ({ file: unit.file, missing: unit.missingFiles, findings: unit.findings })),
    findings: [...value.findings, ...value.lifecycle.findings],
  });
}

/** Membership and full domain rules consume one observed closure. Fresh agent
 * judgments, operation Hooks and Attractor checks are not synthesized here. */
export function inspectCodumentWorkspaceApp(input: WorkspaceAppInspectionInput): WorkspaceAppInspection {
  const { after: observed, catalog } = input;
  const findings = [...observed.findings];
  const error = (file: string, rule: string, message: string) => findings.push({ file, rule, message, severity: 'error' as const });
  if (observationIdentity(input.before) !== observationIdentity(observed)) error('codument', 'workspace.drift', 'App sources changed during observation; retry from current sources.');
  for (const diagnostic of catalog.diagnostics) error(diagnostic.location, diagnostic.code, diagnostic.message);
  const resources = catalog.resources.filter(item => item.sourceRoot === 'codument');
  const apps = resources.filter(item => item.kind === 'SkillApp' && item.logicalPath === 'manifest.xnl');
  if (apps.length !== 1) error('codument/manifest.xnl', 'workspace.app', 'Expected exactly one formal Codument SkillApp.');
  const app = apps[0];
  if (app && app.sourceManifestDigest !== observed.manifestDigest) error('codument/manifest.xnl', 'workspace.manifest-drift', 'Catalog and physical manifest observations disagree.');
  const membership = new Map<string, typeof resources>();
  for (const resource of resources) {
    const file = 'codument/' + resource.logicalPath;
    membership.set(file, [...membership.get(file) ?? [], resource]);
  }
  const canonical = new Set(observed.authorities.filter(item => !item.ownerFile).map(item => item.file));
  for (const authority of observed.authorities) {
    const owner = authority.ownerFile ?? authority.file;
    const records = membership.get(owner) ?? [];
    if (!records.length) error(authority.file, 'workspace.orphan', 'Domain authority is absent from declared App membership: ' + owner);
    if (authority.ownerFile) continue;
    for (const record of records) {
      if (record.kind !== authority.kind) error(authority.file, 'workspace.kind', `Expected ${authority.kind}, received ${record.kind}.`);
      if (record.authorityDigest !== authority.digest) error(authority.file, 'workspace.source-drift', 'Catalog and domain validation did not read the same source bytes.');
    }
  }
  for (const resource of resources) {
    if ((CODUMENT_RESOURCE_KINDS as readonly string[]).includes(resource.kind) && !canonical.has('codument/' + resource.logicalPath)) {
      error('codument/' + resource.logicalPath, 'workspace.misplaced-authority', 'Independent domain resource is outside its canonical product ownership boundary.');
    }
  }
  findings.push(...inspectDomainValidation(observed.lifecycle, { strict: true }).findings);
  for (const knowledge of observed.knowledge) {
    const index = indexKnowledgeSources(knowledge.sources, knowledge.family, knowledge.mode);
    findings.push(...validateKnowledgeIndex(index).map(finding => ({ file: knowledge.directory + '/' + finding.file,
      severity: finding.severity, rule: finding.rule ?? 'knowledge.' + finding.layer, message: finding.message })));
  }
  findings.push(...validateDecisionSources(observed.decisions).map(finding => ({ file: finding.file,
    severity: finding.severity, rule: 'decision.' + (finding.layer ?? 'validation'), message: finding.message })));
  const sourceAt = (file: string) => observed.authorities.find(item => item.file === file)?.source;
  for (const family of ['modeling', 'engineering'] as const) {
    const file = `codument/config/${family}.xnl`;
    try { readKnowledgeSettings(sourceAt(file), family); }
    catch (cause) { error(file, 'workspace.config', String(cause)); }
  }
  try { readAttractorProfileNames(sourceAt('codument/config/attractor-profiles.xnl')); }
  catch (cause) { error('codument/config/attractor-profiles.xnl', 'workspace.config', String(cause)); }
  return { ready: catalog.ready && findings.every(item => item.severity !== 'error'), appId: app?.fqn,
    memberFiles: [...canonical].sort(), ownedFiles: observed.authorities.filter(item => item.ownerFile).map(item => item.file).sort(), findings };
}
