import { MODELING_SCHEMAS, type KnowledgeFamily, type KnowledgeMode, type KnowledgeFinding, type KnowledgeSourceIndex, type ModelingSchema } from 'depa-codument-domain-contract';
import type { DataElementNode } from 'xnl-core';
import { indexXnlRegistry, isDataElement, readStableNodeId } from './registry';
import { validateModelingNode } from './modeling-schema';
import { validateEngineeringNode } from './engineering-schema';

function property(node: DataElementNode, key: string): unknown { return node.attributes?.[key] ?? node.metadata?.[key]; }
function location(file: string, family: KnowledgeFamily, mode: KnowledgeMode) {
  const parts = file.split('/');
  return { plane: parts[0] ?? '', context: family === 'modeling' && mode === 'deltas' ? (parts[1] ?? '').replace(/\.xnl$/i, '') : parts[1] ?? '',
    category: parts[1] ?? '', topic: (parts[2] ?? '').replace(/\.xnl$/i, '') };
}
function knowledgeUri(file: string, id: string, family: KnowledgeFamily, mode: KnowledgeMode): string {
  const loc = location(file, family, mode);
  return `${family}://${loc.plane}/${family === 'modeling' ? loc.context : loc.category + '/' + loc.topic}/${id.split('.').at(-1)}`;
}

/** Structural owner/index admission; retains original bytes even when an author error blocks use. */
export function indexKnowledgeSources(sources: ReadonlyMap<string, string>, family: KnowledgeFamily, mode: KnowledgeMode = 'registry'): KnowledgeSourceIndex {
  const kind = family === 'modeling' ? 'ModelingRegistry' : 'EngineeringRegistry';
  const registry = indexXnlRegistry(sources, { registryName: family }, {
    shouldIndex: (node, context) => context.ancestors.length > 0 && (Boolean(readStableNodeId(node)) || property(node, 'kind') !== undefined || context.path.length === 2 && context.path[1].kind === 'body'),
    uriFor: (file, id) => knowledgeUri(file, id, family, mode),
  });
  const findings: KnowledgeFinding[] = registry.issues.map(issue => ({ file: issue.file, line: issue.line,
    layer: issue.kind === 'syntax' ? 'syntax' : 'hierarchy', severity: 'error', rule: issue.kind === 'syntax' ? 'xnl.syntax' : `${family}.registry-load`, message: issue.message }));
  const owners = new Map<string, DataElementNode>();
  const ownerIds = new Map<string, string>();
  function error(file: string, rule: string, message: string) { findings.push({file, layer: 'schema', severity: 'error', rule: `${family}.${rule}`, message}); }
  for (const [file, forest] of registry.files) {
    const root = forest[0];
    if (forest.length !== 1 || !isDataElement(root) || root.tag !== kind
      || root.metadata.envelopeVersion !== 'halfcode.resource-envelope/v1' || root.metadata.specVersion !== 1
      || 'apiVersion' in root.metadata || 'version' in root.metadata) {
      error(file, 'owner-migration', `Knowledge authority requires one current ${kind} owner; migrate or review the original forest.`);
      continue;
    }
    const id = readStableNodeId(root);
    if (!id) { error(file, 'owner-id', 'Knowledge owner requires a stable identity.'); continue; }
    if (ownerIds.has(id)) error(file, 'owner-id', `Duplicate knowledge owner '${id}' in '${ownerIds.get(id)}' and '${file}'.`);
    ownerIds.set(id, file);
    if (family === 'modeling' && !(MODELING_SCHEMAS as readonly unknown[]).includes(root.attributes?.modeling_schema)) error(file, 'schema-profile', 'Unknown or missing modeling_schema; migration or review is required.');
    if ((root.body ?? []).some(node => !isDataElement(node))) error(file, 'owner-body', 'Knowledge owner body must contain knowledge nodes.');
    owners.set(file, root);
  }
  const uris = new Map<string, string>();
  for (const member of registry.index.values()) {
    if (member.uri && uris.has(member.uri)) error(member.file, 'duplicate-uri', `Different knowledge identities resolve to the same URI '${member.uri}'.`);
    if (member.uri) uris.set(member.uri, member.id);
    const override = property(member.node, 'modeling_schema');
    if (family === 'modeling' && override !== undefined && !(MODELING_SCHEMAS as readonly unknown[]).includes(override)) error(member.file, 'schema-profile', `#${member.id}: unknown modeling_schema override.`);
  }
  return { family, mode, registry, owners, findings, ready: findings.length === 0 };
}

function references(node: DataElementNode, family: KnowledgeFamily): string[] {
  const values = new Set<string>();
  const schemes = family === 'modeling' ? ['modeling://', 'behavior://'] : ['engineering://', 'modeling://', 'behavior://', 'decision://'];
  function visit(value: unknown): void {
    if (typeof value === 'string') { if (schemes.some(scheme => value.startsWith(scheme))) values.add(value); }
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  }
  visit(node.attributes); visit(node.metadata);
  return [...values];
}

/** Full knowledge semantics over the same parsed snapshot; no source re-read or implicit Hook verdict. */
export function validateKnowledgeIndex(index: KnowledgeSourceIndex): readonly KnowledgeFinding[] {
  const {family, mode, registry, owners} = index;
  const findings: KnowledgeFinding[] = [...index.findings];
  const uris = new Set([...registry.index.values()].map(member => member.uri));
  function add(file: string, rule: string | undefined, message: string, severity: 'error' | 'warning' = 'error') {
    findings.push({file, layer: 'hierarchy', severity, rule, message});
  }
  for (const member of registry.index.values()) {
    const owner = owners.get(member.file);
    if (!owner) continue;
    const profile = property(member.node, 'modeling_schema') ?? owner.attributes?.modeling_schema;
    const errors = family === 'modeling' ? validateModelingNode(member.node, profile as ModelingSchema) : validateEngineeringNode(member.node);
    findings.push(...errors.map(message => ({file: member.file, layer: 'schema' as const, severity: 'error' as const, message})));
    const loc = location(member.file, family, mode);
    const parts = member.id.split('.');
    if (family === 'modeling') {
      if (parts.length < 2) add(member.file, undefined, `#${member.id}: id has no namespace context segment; expected '<context>.<name>' with context '${loc.context}'`);
      else {
        if (parts.at(-2) !== loc.context) add(member.file, 'modeling.id-context-mismatch', `#${member.id}: id context '${parts.at(-2)}' does not match path context '${loc.context}' (${member.file})`);
        if (parts.length >= 3 && parts.at(-3) !== loc.plane) add(member.file, 'modeling.id-plane-mismatch', `#${member.id}: id plane prefix '${parts.at(-3)}' does not match path plane '${loc.plane}' (${member.file})`);
      }
    } else if (parts.length < 4) add(member.file, 'engineering.id-format', `#${member.id}: id must be '#<plane>.<category>.<topic>.<name>'`);
    else {
      for (const [position, field] of (['plane', 'category', 'topic'] as const).entries()) {
        if (parts[position] !== loc[field]) add(member.file, `engineering.id-${field}-mismatch`, `#${member.id}: id ${field} '${parts[position]}' does not match path ${field} '${loc[field]}' (${member.file})`);
      }
    }
    for (const ref of references(member.node, family)) {
      if (ref.startsWith(`${family}://`)) {
        if (!uris.has(ref)) add(member.file, `${family}.dangling-reference`, `#${member.id}: dangling ${family} reference '${ref}'`);
      } else {
        const minimum = ref.startsWith('modeling://') ? 3 : ref.startsWith('behavior://') ? 2 : 1;
        if (ref.slice(ref.indexOf('://') + 3).split('/').filter(Boolean).length < minimum) add(member.file, `${family}.malformed-reference`, `#${member.id}: malformed reference '${ref}'`);
      }
    }
  }
  const planes = new Set<string>();
  const modelingPlanes = ['domain', 'backend', 'surface', 'cli', 'agent'];
  const engineeringPlanes = ['global', 'backend', 'surface', 'runtime', 'storage', 'pipelines', 'agents', 'operations', 'cli'];
  const categories = ['overview', 'howto', 'rules', 'examples', 'reference', 'troubleshooting', 'runbooks', 'code-map'];
  for (const file of registry.sources.keys()) {
    const loc = location(file, family, mode); planes.add(loc.plane);
    if (family === 'engineering') {
      if (!loc.plane || !loc.category || !loc.topic) add(file, 'engineering.path-format', "engineering file path must be '<plane>/<category>/<topic>.xnl' or '<plane>/<category>/<topic>/index.xnl'");
      else if (!categories.includes(loc.category)) add(file, 'engineering.unknown-category', `unknown engineering category '${loc.category}' (custom categories are allowed; verify it is intentional)`, 'warning');
    } else if (!loc.plane || !loc.context || mode === 'registry' && /\.xnl$/i.test(loc.context)) add(file, 'modeling.path-format', "modeling registry requires '<plane>/<context>/...xnl'; deltas require '<plane>/<context>.xnl'");
  }
  const hasContent = registry.index.size > 0 || index.findings.length > 0;
  if (family === 'modeling' && !hasContent) add('.', undefined, 'modeling registry is empty; a domain plane is required once modeling nodes are added', 'warning');
  else if (family === 'modeling' && !planes.has('domain')) add('.', 'modeling.missing-domain-plane', `modeling registry must contain a 'domain' plane (found planes: ${[...planes].sort().join(', ') || '(none)'})`);
  if (family === 'engineering' && !planes.has('global')) add('.', 'engineering.missing-global-plane', "engineering registry has no 'global' plane; this is allowed but cross-plane knowledge usually belongs there", 'warning');
  for (const plane of planes) if (plane && !(family === 'modeling' ? modelingPlanes : engineeringPlanes).includes(plane)) add('.', family === 'modeling' ? 'modeling.unknown-derived-plane' : undefined, `unknown ${family} plane '${plane}' (custom planes are allowed; verify it is intentional)`, 'warning');
  return findings;
}
