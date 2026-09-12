import { parseXnl } from 'xnl-core';
import type { DomainOperationRuntime, ScaffoldLocation, ScaffoldReceipt, ScaffoldRequest } from 'depa-codument-domain-contract';
import { isDataElement } from './registry';

export function validateScaffoldRequest(request: ScaffoldRequest): void {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(request.id)) throw new Error(`Invalid ${request.kind} id '${request.id}': expected lowercase kebab-case`);
  if (request.kind === 'BehaviorPatch') {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(request.capability)) throw new Error('Invalid BehaviorPatch capability: expected lowercase kebab or dotted name');
  } else if (!['Track', 'Mission'].includes(request.kind) || !['pending', 'active'].includes(request.stage)) {
    throw new Error('Scaffold requires Track or Mission and stage pending|active.');
  }
}

/** Skeletons deliberately require authoring. Structural validity is not a
 * successful semantic verdict and does not skip subsequent validate/hook gates. */
export function proposeScaffold(location: ScaffoldLocation, timestamp: string): Readonly<Record<string, string>> {
  const input = location.request;
  validateScaffoldRequest(input);
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) throw new Error('Scaffold requires an observed ISO timestamp.');
  const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
  if (input.kind === 'BehaviorPatch') {
    return { 'delta.xnl': `<BehaviorPatch #track.${input.id}.behavior_patch.${input.capability} ${envelope} {capability=${JSON.stringify(input.capability)}} (<Mutations []>)>\n` };
  }
  const kind = input.kind, id = input.id;
  let status: string = input.stage;
  if (kind === 'Track') status = input.stage === 'active' ? 'in_progress' : 'new';
  const fields = [
    `  status = ${JSON.stringify(status)}`, `  goal = "To be authored by codument-plan-${kind.toLowerCase()}."`,
    `  description = "To be authored by codument-plan-${kind.toLowerCase()}."`, '  question_mode = "decision-tree"', '  question_severity = "auto"',
    kind === 'Track' ? '  commit_mode = "manual"' : '  revision = 1', `  created_at = ${JSON.stringify(timestamp)}`, `  updated_at = ${JSON.stringify(timestamp)}`,
  ];
  if (kind === 'Track' && location.gitHead) {
    if (!/^[a-f0-9]{40,64}$/.test(location.gitHead)) throw new Error('Invalid observed Git HEAD.');
    fields.push(`  modeling_base_commit = "${location.gitHead}"`, `  engineering_base_commit = "${location.gitHead}"`);
  }
  const slots = [`  <Ports { scope = "${kind.toLowerCase()}" }>`];
  if (kind === 'Mission') {
    slots.push('  <ProjectRefs [<ProjectRef #host {kind="host"}>]>',
      '  <ActorSets {default="default-control-loop"} [<ActorSet #default-control-loop [',
      ...['MissionPlanner', 'MissionObserver', 'MissionReconciler', 'MissionApplier'].map(role => `    <Actor {role="${role}" project_ref="host"} (<Description ?>${role} for ${id}.</?>)>`),
      '  ]>]>');
  }
  slots.push(`  <TaskSpace #space_${id} {name="${id}" version="1"${kind === 'Mission' ? ' child_mode="dag"' : ''}} (<SubNodes []>)>`, '  <Schedule []>', '  <Hooks []>');
  const source = `<${kind} #${id} ${envelope} {\n${fields.join('\n')}\n} (\n${slots.join('\n')}\n)>\n`;
  const parsed = parseXnl(source, { textBlockStyle: true });
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(parsed.nodes[0]) || parsed.nodes[0].tag !== kind) throw new Error('Scaffold proposal must be one unambiguous resource.');
  return { [kind.toLowerCase() + '.xnl']: source, 'proposal.md': `# ${kind}: ${id}\n`, 'design.md': `# Design: ${id}\n` };
}

export async function applyScaffold(runtime: Pick<DomainOperationRuntime, 'scaffolds' | 'clock'>, input: ScaffoldRequest): Promise<ScaffoldReceipt> {
  validateScaffoldRequest(input);
  if (!runtime.scaffolds) throw new Error('Scaffold source port is not configured.');
  const location = await runtime.scaffolds.observe(input);
  const observed = location.request;
  if (observed.kind !== input.kind || observed.id !== input.id
    || (input.kind === 'BehaviorPatch' && (observed.kind !== 'BehaviorPatch' || observed.capability !== input.capability))
    || (input.kind !== 'BehaviorPatch' && (observed.kind === 'BehaviorPatch' || observed.stage !== input.stage))) throw new Error('Scaffold location returned a mismatched request.');
  const files = proposeScaffold(location, runtime.clock.nowIso());
  const receipt = await runtime.scaffolds.publish(location, files);
  return { kind: input.kind === 'Mission' ? 'Mission' : 'Track', id: input.id, stage: location.stage, directory: location.directory,
    specVersion: 1, files: Object.keys(files), ...receipt };
}
