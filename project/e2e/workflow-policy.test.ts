import { expect, test } from 'bun:test';
import { WORKFLOW_POLICY, assertTrackWorkflowPolicy, assertWorkflowPolicySnapshot, workflowPolicyGuidance } from './workflow-policy';

const hooks = '<Hooks [<Hook {on="phase:after"} (<GapLoop {max_rounds=5 on_exhausted="block" verify_round=false}>)><Hook {on="phase:after"} (<AttractorCheck {use="coding"}>)>]>';
function track(first = '', last = hooks): string {
  return `<Track #example envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {status="new" commit_mode="manual"} (
    <TaskSpace #space (<SubNodes [
      <TaskGroup #first {order=0} (${first})>
      <TaskGroup #last {order=1} (${last})>
    ]>)>
  )>`;
}

test('one immutable E2E policy drives choices and snapshot admission, not a product default', () => {
  const copy = JSON.parse(JSON.stringify(WORKFLOW_POLICY));
  assertWorkflowPolicySnapshot(copy);
  expect(JSON.parse(workflowPolicyGuidance().trim().split('\n').at(-1)!)).toEqual(copy);
  expect(() => assertWorkflowPolicySnapshot(undefined)).toThrow('do not retrofit');
  copy.checks[0].attributes.max_rounds = 6;
  expect(() => assertWorkflowPolicySnapshot(copy)).toThrow('changed');
  expect(WORKFLOW_POLICY.checks[0]!.attributes.max_rounds).toBe(5);
});

test('selected checks belong to the final phase without completing an unselected backlog', () => {
  const source = track();
  assertTrackWorkflowPolicy(source);
  // Declaration admission does not require DONE, invent receipts or mutate authority.
  expect(source).toBe(track());
  assertTrackWorkflowPolicy(track(hooks, '').replace('order=0', 'order=2'));
  expect(() => assertTrackWorkflowPolicy(track(hooks, ''))).toThrow('final first-level phase');
  expect(() => assertTrackWorkflowPolicy(track('', ''))).toThrow('exactly');
  expect(() => assertTrackWorkflowPolicy(track(hooks))).toThrow('exactly');
  expect(() => assertTrackWorkflowPolicy(track('', `<Extension (${hooks})>`))).toThrow('exactly');
  expect(() => assertTrackWorkflowPolicy(source.replace('phase:after', 'task:after'))).toThrow('event');
  expect(() => assertTrackWorkflowPolicy(source.replace('on="phase:after"', 'on="phase:after" enabled=false'))).toThrow('disabled');
});

test('removed, weakened, stronger or substituted checks are different benchmark policies', () => {
  for (const [before, after] of [
    ['max_rounds=5', 'max_rounds=4'],
    ['max_rounds=5', 'max_rounds=6'],
    ['on_exhausted="block"', 'on_exhausted="continue"'],
    ['verify_round=false', 'verify_round=true'],
    ['use="coding"', 'use="docs"'],
    ['<AttractorCheck {use="coding"}>', '<HumanConfirm>'],
    ['commit_mode="manual"', 'commit_mode="auto"'],
  ]) expect(() => assertTrackWorkflowPolicy(track().replace(before!, after!))).toThrow();
  expect(() => assertTrackWorkflowPolicy(track().replace('<GapLoop {max_rounds=5 on_exhausted="block" verify_round=false}>', ''))).toThrow();
});
