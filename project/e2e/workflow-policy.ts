import assert from 'node:assert/strict';
import { isDataElement, orderedElementChildren } from 'depa-codument-domain-logic';
import { resourceRoot } from './resource-oracle';

/** Benchmark choices, not product defaults or proof that a hook actually ran. */
export const WORKFLOW_POLICY = Object.freeze({
  version: 1,
  commitMode: 'manual',
  scope: 'final-first-level-task-group',
  event: 'phase:after',
  checks: Object.freeze([
    Object.freeze({ kind: 'GapLoop', attributes: Object.freeze({ max_rounds: 5, on_exhausted: 'block', verify_round: false }) }),
    Object.freeze({ kind: 'AttractorCheck', attributes: Object.freeze({ use: 'coding' }) }),
  ] as const),
  independentVerify: true,
  unselectedBacklog: 'declare-only',
});

export function workflowPolicyGuidance(): string {
  return 'These are explicit E2E validation choices, overriding the operation defaults for auto questioning, not changing product defaults. ' +
    'Every Track, including unselected child backlog, declares exactly these checks on phase:after of its final first-level TaskGroup (highest order, authored order breaks ties). ' +
    'Do not add HumanConfirm. Keep fresh independent verification separate. Only execute hooks when their selected scope is reached; never complete or run the unselected child backlog just to satisfy this declaration check. ' +
    'Do not remove checks during implementation or reset exhausted rounds. Preserve existing mandatory Mission checks.\n' + JSON.stringify(WORKFLOW_POLICY) + '\n';
}

export function assertWorkflowPolicySnapshot(value: unknown): void {
  assert.deepEqual(value, WORKFLOW_POLICY, 'E2E workflow policy changed or was not recorded; do not retrofit/resume an older trial under a new policy');
}

type Element = ReturnType<typeof resourceRoot>;
function children(node: Element, tag?: string): Element[] {
  return orderedElementChildren(node).filter(isDataElement).filter(child => !tag || child.tag === tag);
}

export function assertTrackWorkflowPolicy(source: string): void {
  const root = resourceRoot(source, 'track');
  assert.equal(root.attributes?.commit_mode, WORKFLOW_POLICY.commitMode, 'E2E Track commit mode differs from declared policy');
  const spaces = children(root, 'TaskSpace');
  assert.equal(spaces.length, 1, 'E2E Track requires one TaskSpace');
  const phases = children(spaces[0]!, 'SubNodes').flatMap(node => children(node, 'TaskGroup'));
  const ordered = phases.map((node, index) => ({node, index, order: Number(node.attributes?.order ?? index)}))
    .sort((a, b) => a.order - b.order || a.index - b.index);
  assert.ok(ordered.length && ordered.every(item => Number.isFinite(item.order)), 'E2E Track requires an ordered first-level phase');
  const finalPhase = ordered.at(-1)!.node;
  const owners: Element[] = [root];
  function visit(container: Element): void {
    for (const collection of children(container, 'SubNodes')) {
      for (const task of children(collection).filter(node => ['Task', 'TaskGroup'].includes(node.tag))) {
        owners.push(task); visit(task);
      }
    }
  }
  visit(spaces[0]!);
  const checks = owners.flatMap(owner => children(owner, 'Hooks').flatMap(collection => children(collection, 'Hook')
    .flatMap(hook => children(hook).filter(check => ['GapLoop', 'AttractorCheck', 'HumanConfirm'].includes(check.tag))
      .map(check => ({owner, hook, check})))));
  assert.equal(checks.length, WORKFLOW_POLICY.checks.length, 'E2E Track must declare exactly the selected checks');
  for (const expected of WORKFLOW_POLICY.checks) {
    const matches = checks.filter(item => item.check.tag === expected.kind);
    assert.equal(matches.length, 1, `E2E Track requires one ${expected.kind}`);
    const actual = matches[0]!;
    assert.equal(actual.owner, finalPhase, `E2E ${expected.kind} must belong to the final first-level phase`);
    assert.equal(actual.hook.attributes?.on, WORKFLOW_POLICY.event, 'E2E check event differs from policy');
    assert.notEqual(actual.hook.attributes?.enabled, false, 'E2E check cannot be disabled');
    assert.deepEqual(actual.check.attributes, expected.attributes, `E2E ${expected.kind} parameters differ from policy`);
  }
}
