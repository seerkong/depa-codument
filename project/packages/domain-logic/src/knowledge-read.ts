import { parseXnl } from 'xnl-core';
import type { KnowledgeFamily, KnowledgeReadRequest, KnowledgeReadResult, KnowledgeSettings, KnowledgeSourceIndex, KnowledgeSourcePort, KnowledgeThresholds, KnowledgeLintFinding } from 'depa-codument-domain-contract';
import { isDataElement, readStableNodeId } from './registry';
import { indexKnowledgeSources, validateKnowledgeIndex } from './knowledge';

export function readKnowledgeSettings(source: string | undefined, family: KnowledgeFamily): KnowledgeSettings {
  const result: KnowledgeSettings = {enabled: family === 'modeling', thresholds: {maxLines: 400, maxNodes: 8}, mergePolicy: {'same-field': 'human', 'delete-modify': 'human', 'add-add': 'human'}};
  if (source === undefined) return result;
  const parsed = parseXnl(source, {textBlockStyle: true});
  const root = parsed.nodes[0];
  const kind = family === 'modeling' ? 'ModelingConfig' : 'EngineeringConfig';
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(root) || root.tag !== kind
    || root.metadata.envelopeVersion !== 'halfcode.resource-envelope/v1' || root.metadata.specVersion !== 1
    || 'apiVersion' in root.metadata || 'version' in root.metadata) throw new Error(`${kind} requires one current unambiguous resource; migrate or review the original config.`);
  const enabled = root.attributes?.enabled;
  if (enabled !== undefined && typeof enabled !== 'boolean') throw new Error(`${kind} enabled must be boolean.`);
  const lint = root.extend?.children.Lint;
  const thresholds = {...result.thresholds};
  if (lint) {
    if (!isDataElement(lint)) throw new Error(`${kind} Lint must be a data element.`);
    if (lint.attributes?.max_lines !== undefined) thresholds.maxLines = threshold(lint.attributes.max_lines);
    if (lint.attributes?.max_nodes !== undefined) thresholds.maxNodes = threshold(lint.attributes.max_nodes);
  }
  const mergePolicy = {...result.mergePolicy};
  const merge = root.extend?.children.MergePolicy;
  if (merge) {
    if (!isDataElement(merge)) throw new Error(`${kind} MergePolicy must be a data element.`);
    const conflicts = merge.extend?.children.Conflicts;
    if (conflicts && !isDataElement(conflicts)) throw new Error(`${kind} Conflicts must be a collection.`);
    const seen = new Set<string>();
    for (const entry of conflicts?.body ?? []) {
      if (!isDataElement(entry) || entry.tag !== 'Conflict') throw new Error(`${kind} Conflicts must contain Conflict entries.`);
      const type = entry.attributes?.type, resolve = entry.attributes?.resolve;
      if (typeof type !== 'string' || !Object.hasOwn(mergePolicy, type) || seen.has(type)
        || typeof resolve !== 'string' || !['human', 'ours', 'theirs', 'base'].includes(resolve)) throw new Error(`${kind} conflict policy is unknown or duplicated.`);
      seen.add(type); mergePolicy[type as keyof typeof mergePolicy] = resolve as typeof mergePolicy[keyof typeof mergePolicy];
    }
  }
  return {enabled: enabled ?? result.enabled, thresholds, mergePolicy};
}
function threshold(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Knowledge lint thresholds must be non-negative integers.');
  return value;
}
export function lintKnowledgeIndex(index: KnowledgeSourceIndex, thresholds: KnowledgeThresholds): readonly KnowledgeLintFinding[] {
  threshold(thresholds.maxLines); threshold(thresholds.maxNodes);
  if (!index.ready) throw new Error(index.findings.map(finding => `${finding.file}: ${finding.message}`).join('\n'));
  const findings: KnowledgeLintFinding[] = [];
  for (const [file, owner] of index.owners) {
    const lines = index.registry.sources.get(file)!.split('\n').length;
    const nodeCount = (owner.body ?? []).filter(node => isDataElement(node) && readStableNodeId(node)).length;
    const reasons: string[] = [];
    if (lines > thresholds.maxLines) reasons.push(`${lines} lines > ${thresholds.maxLines}`);
    if (nodeCount > thresholds.maxNodes) reasons.push(`${nodeCount} nodes > ${thresholds.maxNodes}`);
    if (reasons.length) findings.push({file, lines, nodeCount, reasons});
  }
  return findings.sort((left, right) => left.file.localeCompare(right.file));
}
export async function runKnowledgeRead(port: KnowledgeSourcePort, request: KnowledgeReadRequest): Promise<KnowledgeReadResult> {
  const input = structuredClone(request);
  if (!['modeling', 'engineering'].includes(input.family) || !['validate', 'lint'].includes(input.operation)) throw new Error('Unknown knowledge query.');
  if (input.directory !== undefined && !input.directory.trim()) throw new Error('Knowledge directory must be nonempty.');
  if (input.directory !== undefined && input.deltas !== undefined) throw new Error('Choose an explicit knowledge directory or --deltas, not both.');
  if (input.deltas !== undefined && input.operation !== 'validate') throw new Error('--deltas is supported only by knowledge validate.');
  const explicit = input.directory !== undefined || input.deltas !== undefined;
  const source = !explicit || input.operation === 'lint' ? await port.readConfig(input.family) : undefined;
  const settings = readKnowledgeSettings(source, input.family);
  if (input.operation === 'validate' && !explicit && !settings.enabled) return {kind: 'skipped', family: input.family};
  const thresholds = {maxLines: input.maxLines ?? settings.thresholds.maxLines, maxNodes: input.maxNodes ?? settings.thresholds.maxNodes};
  if (input.operation === 'lint') { threshold(thresholds.maxLines); threshold(thresholds.maxNodes); }
  const observed = await port.observe(input);
  const index = indexKnowledgeSources(observed.sources, input.family, input.deltas === undefined ? 'registry' : 'deltas');
  if (input.operation === 'validate') return {kind: 'validated', family: input.family, directory: observed.directory, findings: validateKnowledgeIndex(index)};
  return {kind: 'linted', family: input.family, directory: observed.directory, findings: lintKnowledgeIndex(index, thresholds)};
}
