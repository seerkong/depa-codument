import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';
import { isDataElement, orderedElementChildren } from 'depa-codument-domain-logic';
import { resourceRoot } from './resource-oracle';

export const HOOK_KINDS = ['GapLoop', 'AttractorCheck', 'HumanConfirm'] as const;
export type HookKind = typeof HOOK_KINDS[number];

export interface HookPolicy {
  readonly enabled: boolean;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface WorkflowPolicy {
  readonly version: number;
  readonly commitMode: string;
  readonly scope: string;
  readonly event: string;
  readonly independentVerify: boolean;
  readonly unselectedBacklog: string;
  readonly hooks: { readonly [K in HookKind]: HookPolicy };
}

const POLICY_PATH = path.join(import.meta.dir, 'workflow-policy.json');

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as object)) deepFreeze(child);
  }
  return value;
}

function readHook(raw: unknown, kind: HookKind): HookPolicy {
  assert.ok(raw && typeof raw === 'object' && !Array.isArray(raw), `E2E workflow-policy.json hooks.${kind} must be an object`);
  const value = raw as { enabled?: unknown; attributes?: unknown };
  assert.equal(typeof value.enabled, 'boolean', `E2E workflow-policy.json hooks.${kind}.enabled must be a boolean`);
  const attributes = value.attributes === undefined ? {} : value.attributes;
  assert.ok(attributes && typeof attributes === 'object' && !Array.isArray(attributes), `E2E workflow-policy.json hooks.${kind}.attributes must be an object`);
  return { enabled: value.enabled as boolean, attributes: attributes as Record<string, unknown> };
}

export function loadWorkflowPolicy(file = POLICY_PATH): WorkflowPolicy {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  assert.equal(typeof raw.version, 'number', 'E2E workflow-policy.json version must be a number');
  assert.equal(typeof raw.commitMode, 'string', 'E2E workflow-policy.json commitMode must be a string');
  assert.equal(typeof raw.scope, 'string', 'E2E workflow-policy.json scope must be a string');
  assert.equal(typeof raw.event, 'string', 'E2E workflow-policy.json event must be a string');
  assert.equal(typeof raw.independentVerify, 'boolean', 'E2E workflow-policy.json independentVerify must be a boolean');
  assert.equal(typeof raw.unselectedBacklog, 'string', 'E2E workflow-policy.json unselectedBacklog must be a string');
  assert.ok(raw.hooks && typeof raw.hooks === 'object' && !Array.isArray(raw.hooks), 'E2E workflow-policy.json hooks must be an object');
  const hooksRaw = raw.hooks as Record<string, unknown>;
  assert.deepEqual(Object.keys(hooksRaw).sort(), [...HOOK_KINDS].sort(), 'E2E workflow-policy.json hooks must declare GapLoop, AttractorCheck and HumanConfirm');
  return deepFreeze({
    version: raw.version as number,
    commitMode: raw.commitMode as string,
    scope: raw.scope as string,
    event: raw.event as string,
    independentVerify: raw.independentVerify as boolean,
    unselectedBacklog: raw.unselectedBacklog as string,
    hooks: {
      GapLoop: readHook(hooksRaw.GapLoop, 'GapLoop'),
      AttractorCheck: readHook(hooksRaw.AttractorCheck, 'AttractorCheck'),
      HumanConfirm: readHook(hooksRaw.HumanConfirm, 'HumanConfirm'),
    },
  });
}

/** Public file `e2e/workflow-policy.json`. Benchmark choices, not product defaults. */
export const WORKFLOW_POLICY: WorkflowPolicy = loadWorkflowPolicy();

export function selectedChecks(policy: WorkflowPolicy = WORKFLOW_POLICY): ReadonlyArray<{ kind: HookKind; attributes: Readonly<Record<string, unknown>> }> {
  return HOOK_KINDS.filter(kind => policy.hooks[kind].enabled).map(kind => ({ kind, attributes: policy.hooks[kind].attributes }));
}

export function workflowPolicyGuidance(policy: WorkflowPolicy = WORKFLOW_POLICY): string {
  const checks = selectedChecks(policy);
  const hanging = checks.length
    ? 'Every Track, including unselected child backlog, declares exactly these enabled checks on phase:after of its final first-level TaskGroup (highest order, authored order breaks ties). Do not add disabled hook kinds. '
    : 'Do not hang GapLoop, AttractorCheck or HumanConfirm on any Track, including unselected child backlog; follow product auto defaults for those hooks. ';
  return 'These are explicit E2E validation choices from e2e/workflow-policy.json, overriding the operation defaults for auto questioning, not changing product defaults. ' +
    hanging +
    'Keep fresh independent verification separate. Only execute hooks when their selected scope is reached; never complete or run the unselected child backlog just to satisfy this declaration check. ' +
    'Do not remove enabled checks during implementation or reset exhausted rounds. Preserve existing mandatory Mission checks.\n' + JSON.stringify(policy) + '\n';
}

export function assertWorkflowPolicySnapshot(value: unknown, policy: WorkflowPolicy = WORKFLOW_POLICY): void {
  assert.deepEqual(value, policy, 'E2E workflow policy changed or was not recorded; do not retrofit/resume an older trial under a new policy');
}

type Element = ReturnType<typeof resourceRoot>;
function children(node: Element, tag?: string): Element[] {
  return orderedElementChildren(node).filter(isDataElement).filter(child => !tag || child.tag === tag);
}

export function assertTrackWorkflowPolicy(source: string, policy: WorkflowPolicy = WORKFLOW_POLICY): void {
  const root = resourceRoot(source, 'track');
  assert.equal(root.attributes?.commit_mode, policy.commitMode, 'E2E Track commit mode differs from declared policy');
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
    .flatMap(hook => children(hook).filter(check => (HOOK_KINDS as readonly string[]).includes(check.tag))
      .map(check => ({owner, hook, check})))));
  const expectedChecks = selectedChecks(policy);
  assert.equal(checks.length, expectedChecks.length, 'E2E Track must declare exactly the selected checks');
  for (const expected of expectedChecks) {
    const matches = checks.filter(item => item.check.tag === expected.kind);
    assert.equal(matches.length, 1, `E2E Track requires one ${expected.kind}`);
    const actual = matches[0]!;
    assert.equal(actual.owner, finalPhase, `E2E ${expected.kind} must belong to the final first-level phase`);
    assert.equal(actual.hook.attributes?.on, policy.event, 'E2E check event differs from policy');
    assert.notEqual(actual.hook.attributes?.enabled, false, 'E2E check cannot be disabled');
    assert.deepEqual(actual.check.attributes, expected.attributes, `E2E ${expected.kind} parameters differ from policy`);
  }
}
