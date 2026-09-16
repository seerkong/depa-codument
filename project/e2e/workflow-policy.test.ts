import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { WORKFLOW_POLICY, assertTrackWorkflowPolicy, assertWorkflowPolicySnapshot, loadWorkflowPolicy, selectedChecks, workflowPolicyGuidance, type WorkflowPolicy } from './workflow-policy';
import { createRun, treeHash, writeJson } from './runtime';
import { runCase } from './workload';
import { lockRun } from './integrity';

const PUBLIC_POLICY = path.join(import.meta.dir, 'workflow-policy.json');
const hooks = '<Hooks [<Hook {on="phase:after"} (<GapLoop {max_rounds=5 on_exhausted="block" verify_round=false}>)><Hook {on="phase:after"} (<AttractorCheck {use="coding"}>)>]>';
function track(first = '', last = hooks): string {
  return `<Track #example envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {status="new" commit_mode="manual"} (
    <TaskSpace #space (<SubNodes [
      <TaskGroup #first {order=0} (${first})>
      <TaskGroup #last {order=1} (${last})>
    ]>)>
  )>`;
}

function enabledPolicy(): WorkflowPolicy {
  return {
    ...WORKFLOW_POLICY,
    hooks: {
      GapLoop: { enabled: true, attributes: WORKFLOW_POLICY.hooks.GapLoop.attributes },
      AttractorCheck: { enabled: true, attributes: WORKFLOW_POLICY.hooks.AttractorCheck.attributes },
      HumanConfirm: WORKFLOW_POLICY.hooks.HumanConfirm,
    },
  };
}

test('public workflow-policy.json owns hook enablement and defaults all hanging off', () => {
  const copy = JSON.parse(JSON.stringify(WORKFLOW_POLICY));
  assertWorkflowPolicySnapshot(copy);
  expect(loadWorkflowPolicy(PUBLIC_POLICY)).toEqual(WORKFLOW_POLICY);
  expect(JSON.parse(fs.readFileSync(PUBLIC_POLICY, 'utf8'))).toEqual(copy);
  expect(JSON.parse(workflowPolicyGuidance().trim().split('\n').at(-1)!)).toEqual(copy);
  expect(workflowPolicyGuidance()).toContain('Do not hang GapLoop, AttractorCheck or HumanConfirm');
  expect(selectedChecks()).toEqual([]);
  expect(WORKFLOW_POLICY.hooks.GapLoop.enabled).toBe(false);
  expect(WORKFLOW_POLICY.hooks.AttractorCheck.enabled).toBe(false);
  expect(WORKFLOW_POLICY.hooks.HumanConfirm.enabled).toBe(false);
  expect(() => assertWorkflowPolicySnapshot(undefined)).toThrow('do not retrofit');
  copy.hooks.GapLoop.enabled = true;
  expect(() => assertWorkflowPolicySnapshot(copy)).toThrow('changed');
  expect(WORKFLOW_POLICY.hooks.GapLoop.enabled).toBe(false);
  expect(WORKFLOW_POLICY.hooks.GapLoop.attributes.max_rounds).toBe(5);
});

test('enabling GapLoop and AttractorCheck in the public file selects those checks', () => {
  const tmp = path.join(os.tmpdir(), `e2e-workflow-policy-${Date.now()}.json`);
  const enabled = JSON.parse(fs.readFileSync(PUBLIC_POLICY, 'utf8'));
  enabled.hooks.GapLoop.enabled = true;
  enabled.hooks.AttractorCheck.enabled = true;
  fs.writeFileSync(tmp, JSON.stringify(enabled));
  try {
    const policy = loadWorkflowPolicy(tmp);
    expect(selectedChecks(policy).map(check => check.kind)).toEqual(['GapLoop', 'AttractorCheck']);
    expect(workflowPolicyGuidance(policy)).toContain('declares exactly these enabled checks');
  } finally { fs.rmSync(tmp, { force: true }); }
});

test('resume rejects missing or changed policy before altering any historical run bytes', async () => {
  const run = createRun('/usr/bin/true', 'todo');
  try {
    writeJson(path.join(run.root, 'result.json'), { status: 'failed', attempts: [{ attempt: 0, error: 'original' }] });
    for (const changed of [undefined, { ...WORKFLOW_POLICY, version: 0 }]) {
      if (changed) writeJson(path.join(run.root, 'workflow-policy.json'), changed);
      const before = treeHash(run.root);
      await expect(runCase('/usr/bin/true', '/missing-auth', 'todo', run.root)).rejects.toThrow('do not retrofit');
      expect(treeHash(run.root)).toBe(before);
    }
    writeJson(path.join(run.root, 'workflow-policy.json'), WORKFLOW_POLICY);
    const unlock = lockRun(run);
    try {
      const before = treeHash(run.root);
      // Matching policy reaches the normal ownership gate, still without a model.
      await expect(runCase('/usr/bin/true', '/missing-auth', 'todo', run.root)).rejects.toThrow('already owned');
      expect(treeHash(run.root)).toBe(before);
    } finally { unlock(); }
  } finally { fs.rmSync(run.root, { recursive: true, force: true }); }
});

test('default policy admits empty Tracks and rejects hung GapLoop or AttractorCheck', () => {
  const empty = track('', '');
  assertTrackWorkflowPolicy(empty);
  expect(empty).toBe(track('', ''));
  expect(() => assertTrackWorkflowPolicy(track())).toThrow('exactly');
  expect(() => assertTrackWorkflowPolicy(track(hooks, ''))).toThrow('exactly');
});

test('selected checks belong to the final phase without completing an unselected backlog', () => {
  const policy = enabledPolicy();
  const source = track();
  assertTrackWorkflowPolicy(source, policy);
  // Declaration admission does not require DONE, invent receipts or mutate authority.
  expect(source).toBe(track());
  assertTrackWorkflowPolicy(track(hooks, '').replace('order=0', 'order=2'), policy);
  expect(() => assertTrackWorkflowPolicy(track(hooks, ''), policy)).toThrow('final first-level phase');
  expect(() => assertTrackWorkflowPolicy(track('', ''), policy)).toThrow('exactly');
  expect(() => assertTrackWorkflowPolicy(track(hooks), policy)).toThrow('exactly');
  expect(() => assertTrackWorkflowPolicy(track('', `<Extension (${hooks})>`), policy)).toThrow('exactly');
  expect(() => assertTrackWorkflowPolicy(source.replace('phase:after', 'task:after'), policy)).toThrow('event');
  expect(() => assertTrackWorkflowPolicy(source.replace('on="phase:after"', 'on="phase:after" enabled=false'), policy)).toThrow('disabled');
});

test('removed, weakened, stronger or substituted checks are different benchmark policies', () => {
  const policy = enabledPolicy();
  for (const [before, after] of [
    ['max_rounds=5', 'max_rounds=4'],
    ['max_rounds=5', 'max_rounds=6'],
    ['on_exhausted="block"', 'on_exhausted="continue"'],
    ['verify_round=false', 'verify_round=true'],
    ['use="coding"', 'use="docs"'],
    ['<AttractorCheck {use="coding"}>', '<HumanConfirm>'],
    ['commit_mode="manual"', 'commit_mode="auto"'],
  ]) expect(() => assertTrackWorkflowPolicy(track().replace(before!, after!), policy)).toThrow();
  expect(() => assertTrackWorkflowPolicy(track().replace('<GapLoop {max_rounds=5 on_exhausted="block" verify_round=false}>', ''), policy)).toThrow();
});
