import { parseXnl, type DataElementNode } from 'xnl-core';
import type { DecisionCreateInput } from 'depa-codument-domain-contract';
import { indexXnlRegistry, isDataElement, requireReadyRegistry } from './registry';
import { appendDecisionSource } from './source-patch';
import { validateDecisionSources } from './decisions';

/** Authoring proposal only. The filesystem owner must compare the source before committing. */
export function proposeDecisionCreation(source: string | undefined, input: DecisionCreateInput): string {
  if (!input.file.toLowerCase().endsWith('.xnl')) throw new Error('Decision scaffold target must be an .xnl file.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(input.id)) throw new Error(`Invalid Decision id '${input.id}'.`);
  const content = source ?? '';
  const sources = new Map([['decisions.xnl', content]]);
  const registry = requireReadyRegistry(indexXnlRegistry(sources, { registryName: 'decision' }, { shouldIndex: node => node.tag === 'decision' }));
  const errors = validateDecisionSources(sources).filter(finding => finding.severity === 'error');
  if (errors.length) throw new Error(errors.map(finding => finding.message).join('\n'));
  if (registry.index.has(input.id)) throw new Error(`Decision '${input.id}' already exists in ${input.file}.`);
  const childSource = decisionSkeleton(input.id, input.parent !== undefined);
  const child = parseXnl(childSource, { textBlockStyle: true }).nodes[0];
  if (!isDataElement(child)) throw new Error('Decision scaffold did not produce a data element.');
  const before = registry.files.get('decisions.xnl')!;
  const after = structuredClone([...before]);
  if (input.parent === undefined) after.push(child);
  else {
    const parent = registry.index.get(input.parent);
    if (!parent) throw new Error(`Decision parent '${input.parent}' was not found in ${input.file}.`);
    // Only direct decision-body ancestry is admitted by validateDecisionSources.
    let node = after[parent.owner.topLevelIndex] as DataElementNode;
    for (const segment of parent.path.slice(1)) {
      if (segment.kind !== 'body') throw new Error('Decision parent is outside the admitted hierarchy.');
      node = node.body![segment.index] as DataElementNode;
    }
    node.body = [...(node.body ?? []), child];
  }
  const proposed = appendDecisionSource(content, before, after, childSource, input.parent);
  const invalid = validateDecisionSources(new Map([['decisions.xnl', proposed]])).filter(finding => finding.severity === 'error');
  if (invalid.length) throw new Error(invalid.map(finding => finding.message).join('\n'));
  return proposed;
}

function decisionSkeleton(id: string, nested: boolean): string {
  const metadata = nested ? '' : ' envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
  return `<decision #${id}${metadata} {
  status = "pending" priority = "P1" blocks = [] durable_candidate = false
} (
  <question ?>待补充决策问题。</?>
  <recommendation ?>待补充推荐方案。</?>
  <options {} [
    <option {key="A" recommended=true} (
      <title ?>待补充推荐选项。</?>
      <description ?>说明该选项的方案、收益与适用条件。</?>
      <tradeoff ?>说明该选项的代价与风险。</?>
    )>
    <option {key="B" recommended=false} (
      <title ?>待补充备选项。</?>
      <description ?>说明该选项的方案、收益与适用条件。</?>
      <tradeoff ?>说明该选项的代价与风险。</?>
    )>
  ]>
)>`;
}
