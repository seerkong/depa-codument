import { parseXnl, type DataElementNode } from 'xnl-core';
import type { KnowledgeScaffoldRequest, KnowledgeScaffoldSnapshot } from 'depa-codument-domain-contract';
import { indexKnowledgeSources } from './knowledge';
import { patchRootBodySource } from './source-patch';
import { renderModelingKnowledgeNode } from './modeling-scaffold';
import { renderEngineeringKnowledgeNode } from './engineering-scaffold';
import { validateModelingNode } from './modeling-schema';
import { validateEngineeringNode } from './engineering-schema';

/** Authoring policy is injected into the filesystem adapter, not copied there. */
export function knowledgeScaffoldFile(input: KnowledgeScaffoldRequest): string {
  const names = [input.name, input.plane];
  if (input.family === 'modeling') names.push(input.context);
  else if (input.family === 'engineering') names.push(input.category, input.topic);
  else throw new Error('Unknown knowledge scaffold family.');
  if (names.some(name => typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name))) throw new Error('Knowledge scaffold names must be safe single identifier segments.');
  if (input.track !== undefined && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input.track)) throw new Error('Knowledge scaffold Track must be a safe resource identity.');
  if (input.family === 'modeling') {
    if (!['entity', 'object', 'state-machine', 'enum', 'module'].includes(input.kind)) throw new Error(`modeling scaffold: unsupported kind '${input.kind}' (entity|object|state-machine|enum|module)`);
    for (const state of input.states ?? []) if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(state)) throw new Error('Knowledge scaffold state must be a safe identifier.');
    for (const field of input.fields ?? []) if (!/^[A-Za-z_$][A-Za-z0-9_$]*\??:[^\r\n]+$/.test(field) || field.includes('</?')) throw new Error('Knowledge scaffold fields require name:type without text-delimiter injection.');
    return input.track ? `${input.plane}/${input.context}.xnl` : `${input.plane}/${input.context}/index.xnl`;
  }
  if (!['rule', 'howto', 'reference', 'code-map', 'overview'].includes(input.kind)) throw new Error(`engineering scaffold: unsupported kind '${input.kind}' (rule|howto|reference|code-map|overview)`);
  return `${input.plane}/${input.category}/${input.topic}.xnl`;
}

/** One bounded body insertion, checked against the complete source tree. */
export function proposeKnowledgeScaffold(input: KnowledgeScaffoldRequest, observed: KnowledgeScaffoldSnapshot): string {
  const file = knowledgeScaffoldFile(input);
  if (JSON.stringify(input) !== JSON.stringify(observed.request) || file !== observed.file) throw new Error('Knowledge scaffold request differs from the observed source.');
  const mode = input.track ? 'deltas' : 'registry';
  const index = indexKnowledgeSources(observed.sources, input.family, mode);
  if (!index.ready) throw new Error(index.findings.map(finding => `${finding.file}: ${finding.message}`).join('\n'));
  const kind = input.family === 'modeling' ? 'ModelingRegistry' : 'EngineeringRegistry';
  const ownerId = ['codument', input.family, input.plane, ...(input.family === 'modeling' ? [input.context] : [input.category, input.topic])].join('.');
  const newOwner = `<${kind} #${ownerId} envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 ${input.family === 'modeling' ? '{modeling_schema="data-topology/v1"}' : '{}'} []>\n`;
  const source = observed.sources.get(file) ?? newOwner;
  const before = parseXnl(source, {textBlockStyle: true}).nodes[0] as DataElementNode;
  const after = structuredClone(before);
  const nodeSource = input.family === 'modeling'
    ? renderModelingKnowledgeNode(input.kind, input.name, {plane: input.plane, context: input.context, fields: [...input.fields ?? []], states: [...input.states ?? []]})
    : renderEngineeringKnowledgeNode(input.kind, input.name, {plane: input.plane, category: input.category, topic: input.topic});
  const parsed = parseXnl(nodeSource, {textBlockStyle: true});
  if (parsed.warnings?.length || parsed.nodes.length !== 1) throw new Error('Generated knowledge scaffold is ambiguous.');
  const node = parsed.nodes[0];
  const errors = input.family === 'modeling' ? validateModelingNode(node, 'data-topology/v1') : validateEngineeringNode(node);
  if (errors.length) throw new Error(errors.join('\n'));
  after.body = [...before.body ?? [], node];
  const proposed = patchRootBodySource(source, before, after, {insert: nodeSource});
  const nextSources = new Map(observed.sources).set(file, proposed);
  const next = indexKnowledgeSources(nextSources, input.family, mode);
  if (!next.ready) throw new Error(next.findings.map(finding => `${finding.file}: ${finding.message}`).join('\n'));
  return proposed;
}
