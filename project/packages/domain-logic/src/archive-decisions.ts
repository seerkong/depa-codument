import type { DataElementNode, XnlNode } from 'xnl-core';
import type { DecisionFinding } from 'depa-codument-domain-contract';
import { appendDecisionSource, readDataForestSourceFragments } from './source-patch';
import { indexXnlRegistry, isDataElement, readStableNodeId, requireReadyRegistry } from './registry';
import { validateDecisionSources } from './decisions';

interface Candidate {file: string; root: DataElementNode; source: string}
/** Select complete ancestor closures, not flattened Decision records. No IO or
 * state commit occurs here; the archive transaction owns source guards/moves. */
export function proposeArchiveDecisions(input: {
  readonly processSources: ReadonlyMap<string, string>;
  readonly canonicalSources: ReadonlyMap<string, string>;
}): {readonly updates: ReadonlyMap<string, string>; readonly warnings: readonly DecisionFinding[]} {
  const candidates: Candidate[] = [];
  const processIndex = requireReadyRegistry(indexXnlRegistry(input.processSources, {registryName: 'decision'}, {shouldIndex: node => node.tag === 'decision'}));
  for (const [file, source] of processIndex.sources) {
    const roots = readDataForestSourceFragments(source);
    if (roots.some(item => item.node.tag !== 'decision')) throw new Error('Archive Decision sources must contain decision roots.');
    const selected = roots.filter(item => hasDurableCandidate(item.node));
    if (!selected.length) continue;
    if (file === 'decisions.xnl') throw new Error(`Durable root decisions require AI review and a business-semantic owner path under decisions/**: ${selected.map(item => readStableNodeId(item.node)).join(', ')}`);
    if (!file.startsWith('decisions/') || !file.endsWith('.xnl')) throw new Error('Durable Decision source requires a business owner path under decisions/**.');
    const owner = file.slice('decisions/'.length);
    if (owner.split('/').some(segment => segment.startsWith('.'))) throw new Error('Durable Decision owner must participate in the visible registry.');
    for (const item of selected) candidates.push({file: owner, root: item.node, source: item.source});
  }
  if (!candidates.length) return {updates: new Map(), warnings: []};
  const canonical = requireReadyRegistry(indexXnlRegistry(input.canonicalSources, {registryName: 'decision'}, {shouldIndex: node => node.tag === 'decision'}));
  assertValid(input.canonicalSources);
  const knownRoots = new Map<string, XnlNode>();
  for (const [id, ref] of canonical.index) knownRoots.set(id, canonical.files.get(ref.owner.file)![ref.owner.topLevelIndex]);
  const additions = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const ids = decisionIds(candidate.root);
    const known = ids.filter(id => knownRoots.has(id));
    if (known.length === ids.length) {
      if (!known.every(id => semanticEqual(knownRoots.get(id), candidate.root))) throw new Error(`Decision tree '${candidate.file}' changes an existing owner or hierarchy.`);
      continue;
    }
    if (known.length) throw new Error(`Decision tree '${candidate.file}' partially overlaps the existing registry.`);
    const list = additions.get(candidate.file) ?? [];
    list.push(candidate); additions.set(candidate.file, list);
    for (const id of ids) knownRoots.set(id, candidate.root);
  }
  const proposed = new Map(input.canonicalSources), updates = new Map<string, string>();
  for (const [file, added] of additions) {
    const source = proposed.get(file) ?? '';
    const before = canonical.files.get(file) ?? [];
    const after = [...before, ...added.map(item => item.root)];
    const publication = appendDecisionSource(source, before, after, added.map(item => item.source).join('\n\n'));
    proposed.set(file, publication); updates.set(file, publication);
  }
  const warnings = assertValid(proposed);
  return {updates, warnings};
}
function assertValid(sources: ReadonlyMap<string, string>): readonly DecisionFinding[] {
  const findings = validateDecisionSources(sources), errors = findings.filter(finding => finding.severity === 'error');
  if (errors.length) throw new Error(errors.map(finding => `${finding.file}: ${finding.decision}: ${finding.message}`).join('\n'));
  return findings;
}
function hasDurableCandidate(node: DataElementNode): boolean {
  const prop = (name: string) => node.attributes?.[name] ?? node.metadata[name];
  const durable = prop('durable_candidate') ?? prop('durable-candidate');
  if (node.tag === 'decision' && String(durable).toLowerCase() === 'true' && ['accepted', 'resolved'].includes(String(prop('status')).toLowerCase())) return true;
  return (node.body ?? []).some(child => isDataElement(child) && hasDurableCandidate(child));
}
function decisionIds(node: DataElementNode): string[] {
  if (node.tag !== 'decision') throw new Error('Decision tree closure contains a non-decision child.');
  const id = readStableNodeId(node);
  if (!id) throw new Error('Decision tree closure requires stable identities.');
  return [id, ...(node.body ?? []).flatMap(child => {
    if (!isDataElement(child)) throw new Error('Decision tree closure contains a non-data child.');
    return decisionIds(child);
  })];
}
function semanticEqual(left: unknown, right: unknown): boolean {
  const normalize = (_key: string, value: unknown): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).filter(key => !(object.kind === 'TextElement' && key === 'textMarker')).sort().map(key => [key, object[key]]));
  };
  return JSON.stringify(left, normalize) === JSON.stringify(right, normalize);
}
