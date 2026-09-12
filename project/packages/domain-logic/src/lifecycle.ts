import { MakeWord, wordToString, type DataElementNode, type ElementNode, type TextElementNode, type XnlNode } from 'xnl-core';
import { LIFECYCLE_ROOT_STATES, LIFECYCLE_TASK_STATES } from 'depa-codument-domain-contract/lifecycle';
import { hasHistoricalCompletion } from './historical-completion';
import type {
  LifecycleKind, LifecycleSnapshot, LifecycleUpdate, MissionTrackBinding,
  ReadyTrackTask, TrackLinkTarget, VerificationReceipt,
} from 'depa-codument-domain-contract/lifecycle';

const TRACK_STATES = new Set(LIFECYCLE_ROOT_STATES.track);
const MISSION_STATES = new Set(LIFECYCLE_ROOT_STATES.mission.filter((status) => status !== 'archived'));
const TRACK_TASK_STATES = new Set(LIFECYCLE_TASK_STATES.track);
const MISSION_TASK_STATES = new Set(LIFECYCLE_TASK_STATES.mission);

/** No IO, clock reads, in-place source edits, or reduced DTO serialization. */
export function transitionLifecycleResource(source: LifecycleSnapshot, status: string, at: string): LifecycleUpdate {
  if (hasHistoricalCompletion(source.root)) throw new Error('Historical completion is a preserved declaration, not current verification. Explicit migration review is required before reopening.');
  const allowed = source.kind === 'track' ? TRACK_STATES : MISSION_STATES;
  if (!allowed.has(status)) throw new Error(`Invalid ${source.kind} status '${status}'.`);
  const root = copyRoot(source);
  const from = scalar(root.attributes?.status) ?? (source.kind === 'track' && source.stage === 'pending' ? 'new' : source.stage);
  assertRootTransition(source.kind, from, status);
  if (status === 'completed') assertCompletionReady(source.kind, root);
  const stage = status === 'active' || (source.kind === 'track' && status === 'in_progress') ? 'active' : source.stage;
  if (source.stage === 'archived' && stage !== 'active') throw new Error('Archived resources must be reopened before editing.');
  root.attributes = { ...(root.attributes ?? {}), status };
  touch(root, source.kind, at);
  return { ...source, root, stage, from, to: status, subject: source.id };
}

export function transitionLifecycleTask(source: LifecycleSnapshot, taskId: string, status: string, at: string): LifecycleUpdate {
  assertEditable(source);
  const allowed = source.kind === 'track' ? TRACK_TASK_STATES : MISSION_TASK_STATES;
  if (!allowed.has(status)) throw new Error(`Invalid ${source.kind} task status '${status}'.`);
  if (source.kind === 'track' && status === 'DONE') {
    throw new Error('Track tasks must use `codument track task complete <id> <task-id> -- <verification-command>` to enter DONE.');
  }
  const root = copyRoot(source);
  const task = requireTask(root, source, taskId);
  const from = taskStatus(task);
  task.attributes = { ...(task.attributes ?? {}), status };
  touch(root, source.kind, at);
  return { ...source, root, from, to: status, subject: `${source.id}:${taskId}` };
}

/** Run this before launching verification: an unfinished group must not run it. */
export function assertTrackTaskCompletable(source: LifecycleSnapshot, taskId: string): void {
  assertTrack(source);
  assertEditable(source);
  assertRoot(source);
  const task = requireTask(source.root, source, taskId);
  if (task.tag === 'TaskGroup') assertTaskGroupReady(task);
}

/**
 * The caller supplies a receipt admitted by the verification owner against the
 * current workspace. This processor cannot prove freshness from receipt data.
 */
export function completeVerifiedTrackTask(
  source: LifecycleSnapshot, taskId: string, verification: VerificationReceipt, at: string,
): LifecycleUpdate & { readonly verification: VerificationReceipt } {
  assertTrackTaskCompletable(source, taskId);
  if (verification.version !== 1 || verification.track !== source.id || verification.exit_code !== 0
    || verification.cwd !== '.' || !verification.id || !verification.command.length
    || !verification.workspace_fingerprint || !verification.verified_at) {
    throw new Error('Task completion requires a successful, matching verification receipt.');
  }
  const root = copyRoot(source);
  const task = requireTask(root, source, taskId);
  const from = taskStatus(task);
  task.attributes = { ...(task.attributes ?? {}), status: 'DONE' };
  markOwnedCriteriaChecked(task);
  rollUpReadyTaskGroups(root);
  touch(root, 'track', at);
  return { ...source, root, from, to: 'DONE', subject: `${source.id}:${taskId}`, verification: structuredClone(verification) };
}

export function readyTrackTasks(source: LifecycleSnapshot): { track: string; ready: ReadyTrackTask[] } {
  assertTrack(source);
  assertRoot(source);
  const taskSpace = children(source.root).find((child) => child.tag === 'TaskSpace');
  return { track: source.id, ready: taskSpace ? readyFromContainer(taskSpace, scheduleDependencies(source.root)) : [] };
}

export function setLifecycleGapRound(source: LifecycleSnapshot, round: number, at: string): LifecycleUpdate {
  assertEditable(source);
  if (!Number.isSafeInteger(round) || round < 0) throw new Error('Gap round must be a non-negative integer.');
  const root = copyRoot(source);
  const from = scalar(root.attributes?.gap_round) ?? '0';
  root.attributes = { ...(root.attributes ?? {}), gap_round: round };
  touch(root, source.kind, at);
  return { ...source, root, from, to: String(round), subject: source.id };
}

/** Return a binding request, not a claim that the referenced workspace exists. */
export function missionTrackBindingRequest(source: LifecycleSnapshot, taskId: string): {
  projectRef?: string; projectKind: 'host' | 'external';
} {
  if (source.kind !== 'mission') throw new Error('Track binding requires a Mission.');
  assertEditable(source);
  assertRoot(source);
  const task = requireTask(source.root, source, taskId);
  if (task.tag !== 'Task') throw new Error(`Mission '${source.id}' has no leaf Task '${taskId}'.`);
  const link = children(task).find((node) => node.tag === 'TrackLink');
  if (!link) throw new Error(`Mission task '${taskId}' has no TrackLink.`);
  const projectRef = scalar(link.attributes?.project_ref);
  if (!projectRef) return { projectKind: 'host' };
  const project = findById(source.root, projectRef, ['ProjectRef']);
  if (!project || project.tag !== 'ProjectRef') throw new Error(`TrackLink references unknown ProjectRef '${projectRef}'.`);
  const projectKind = scalar(project.attributes?.kind);
  if (projectKind !== 'host' && projectKind !== 'external') throw new Error(`ProjectRef '${projectRef}' requires kind 'host' or 'external'.`);
  return { projectRef, projectKind };
}

/** The owner resolves and admits target authority before applying this proposal. */
export function bindMissionTrack(
  source: LifecycleSnapshot, taskId: string, target: TrackLinkTarget, at: string,
): MissionTrackBinding {
  const request = missionTrackBindingRequest(source, taskId);
  if (request.projectRef !== target.projectRef) throw new Error('Track binding ProjectRef does not match the requested authority.');
  if (!target.trackId || !target.authority || target.authority.startsWith('/')
    || target.authority.includes('\\') || target.authority.split('/').some((part) => !part || part === '..' || part === '.')
    || /^[A-Za-z]:/.test(target.authority)) throw new Error('Track binding requires a portable authority path.');
  const root = copyRoot(source);
  const task = requireTask(root, source, taskId);
  const link = children(task).find((node) => node.tag === 'TrackLink')!;
  const from = `${wordToString(link.id) ?? ''}:${scalar(link.attributes?.state) ?? 'candidate'}`;
  link.id = MakeWord(target.trackId);
  link.attributes = { ...(link.attributes ?? {}), state: 'bound' };
  task.attributes = { ...(task.attributes ?? {}), status: 'ACTIVE' };
  touch(root, 'mission', at);
  return { ...source, root, from, to: `${target.trackId}:bound`, subject: `${source.id}:${taskId}`, target: { ...target } };
}

export function archiveMissionState(source: LifecycleSnapshot, at: string, options: {readonly confirmed?: boolean} = {}): LifecycleUpdate {
  if (source.kind !== 'mission') throw new Error('Mission archive requires a Mission.');
  assertEditable(source);
  const root = copyRoot(source);
  const from = scalar(root.attributes?.status) ?? source.stage;
  if (!['completed', 'cancelled', 'superseded'].includes(from) && options.confirmed !== true) throw new Error('Only terminal Missions can be archived without explicit confirmation.');
  root.attributes = { ...(root.attributes ?? {}), status: 'archived' };
  touch(root, 'mission', at);
  return { ...source, root, stage: 'archived', from, to: 'archived', subject: source.id };
}

function assertRoot(source: LifecycleSnapshot): void {
  let tag: string | undefined;
  if (source.kind === 'track') tag = 'Track';
  if (source.kind === 'mission') tag = 'Mission';
  if (!tag || !isDataElement(source.root) || source.root.tag !== tag || !source.id || wordToString(source.root.id) !== source.id) {
    throw new Error('Lifecycle source kind/id does not match its authority root.');
  }
}

function copyRoot(source: LifecycleSnapshot): DataElementNode {
  assertRoot(source);
  return structuredClone(source.root);
}

function assertEditable(source: LifecycleSnapshot): void {
  if (hasHistoricalCompletion(source.root)) throw new Error('Historical completion requires explicit migration review before editing.');
  if (source.stage === 'archived') throw new Error('Archived resources must be reopened before editing.');
}

function assertTrack(source: LifecycleSnapshot): void {
  if (source.kind !== 'track') throw new Error('This operation requires a Track.');
}

function requireTask(root: DataElementNode, source: LifecycleSnapshot, id: string): DataElementNode {
  const task = findById(root, id, ['Task', 'TaskGroup']);
  if (!task || (task.tag !== 'Task' && task.tag !== 'TaskGroup')) {
    throw new Error(`${source.kind} '${source.id}' has no Task or TaskGroup '${id}'.`);
  }
  return task;
}

function touch(root: DataElementNode, kind: LifecycleKind, at: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(at) || !Number.isFinite(Date.parse(at))) throw new Error('An explicit ISO timestamp is required.');
  root.attributes = { ...(root.attributes ?? {}), updated_at: at };
  if (kind === 'mission') incrementRevision(root);
}

// Ported from the 0.5 lifecycle rules; these helpers only edit the owned clone.
function assertRootTransition(kind: LifecycleKind, from: string, to: string): void {
  if (from === to) return;
  const allowed = kind === 'track'
    ? new Map([
      ['new', new Set(['in_progress', 'cancelled'])],
      ['in_progress', new Set(['completed', 'cancelled'])],
      ['completed', new Set(['in_progress'])],
      ['cancelled', new Set(['in_progress'])],
    ])
    : new Map([
      ['pending', new Set(['active', 'cancelled', 'superseded'])],
      ['active', new Set(['completed', 'cancelled', 'superseded'])],
      ['completed', new Set(['active'])],
      ['cancelled', new Set(['active'])],
      ['superseded', new Set(['active'])],
      ['archived', new Set(['active'])],
    ]);
  if (!allowed.get(from)?.has(to)) throw new Error(`Invalid ${kind} transition '${from}' -> '${to}'.`);
}

function assertCompletionReady(kind: LifecycleKind, root: DataElementNode): void {
  const terminal = kind === 'track'
    ? new Set(['DONE', 'ABANDONED'])
    : new Set(['DONE', 'ABANDONED', 'SUPERSEDED']);
  const unfinished: string[] = [];
  const visit = (node: DataElementNode): void => {
    if (node.tag === 'Task' || node.tag === 'TaskGroup') {
      const status = scalar(node.attributes?.status) ?? 'NOT_STARTED';
      if (!terminal.has(status)) unfinished.push(`${wordToString(node.id) ?? node.tag}:${status}`);
    }
    for (const child of children(node)) visit(child);
  };
  visit(root);
  if (unfinished.length > 0) {
    throw new Error(`${kind} completion gate has unfinished tasks: ${unfinished.join(', ')}`);
  }
  if (kind === 'track') {
    const unchecked = collectCriteria(root).filter((criterion) => scalar(criterion.attributes?.checked) !== 'true');
    if (unchecked.length > 0) {
      throw new Error(`track completion gate has unchecked criteria: ${unchecked.map(elementLabel).join(', ')}`);
    }
  }
}

function assertTaskGroupReady(group: DataElementNode): void {
  const unfinished = taskChildren(group).filter((child) => !TRACK_COMPLETED_TASK_STATES.has(taskStatus(child)));
  if (unfinished.length > 0) {
    throw new Error(`TaskGroup '${elementLabel(group)}' has unfinished children: ${unfinished.map((child) => `${elementLabel(child)}:${taskStatus(child)}`).join(', ')}`);
  }
}

const TRACK_COMPLETED_TASK_STATES = new Set(['DONE', 'ABANDONED']);

function markOwnedCriteriaChecked(task: DataElementNode): void {
  for (const child of elementChildren(task)) {
    if (!isDataElement(child) || (child.tag !== 'Acceptance' && child.tag !== 'Gate')) continue;
    for (const criterion of collectCriteria(child)) {
      criterion.attributes = { ...(criterion.attributes ?? {}), checked: true };
    }
  }
}

function rollUpReadyTaskGroups(root: DataElementNode): void {
  const visit = (node: DataElementNode): void => {
    for (const child of children(node)) visit(child);
    if (node.tag !== 'TaskGroup' || taskStatus(node) === 'DONE') return;
    const directTasks = taskChildren(node);
    if (directTasks.length === 0 || directTasks.some((child) => !TRACK_COMPLETED_TASK_STATES.has(taskStatus(child)))) return;
    const uncheckedOwned = ownedCriteria(node).some((criterion) => scalar(criterion.attributes?.checked) !== 'true');
    if (!uncheckedOwned) node.attributes = { ...(node.attributes ?? {}), status: 'DONE' };
  };
  visit(root);
}

function readyFromContainer(
  container: DataElementNode,
  dependencies: Map<string, Map<string, string[]>>,
): ReadyTrackTask[] {
  const direct = taskChildren(container);
  if (direct.length === 0) return [];
  const byId = new Map(direct.map((child) => [elementLabel(child), child]));
  const ownerId = elementLabel(container);
  const childMode = scalar(container.attributes?.child_mode) ?? 'sequential';
  const eligible = childMode === 'dag'
    ? direct.filter((child) => (dependencies.get(ownerId)?.get(elementLabel(child)) ?? [])
      .every((predecessor) => {
        const dependency = byId.get(predecessor);
        return dependency ? TRACK_COMPLETED_TASK_STATES.has(taskStatus(dependency)) : false;
      }))
    : direct.slice(0, Math.max(0, direct.findIndex((child) => !TRACK_COMPLETED_TASK_STATES.has(taskStatus(child))) + 1))
      .filter((child) => !TRACK_COMPLETED_TASK_STATES.has(taskStatus(child)));

  return eligible.flatMap((child) => {
    const status = taskStatus(child);
    if (TRACK_COMPLETED_TASK_STATES.has(status) || ['REFUSED', 'DELEGATED', 'FORWARDED'].includes(status)) return [];
    if (child.tag === 'TaskGroup') {
      const nested = taskChildren(child);
      if (nested.length > 0 && nested.every((task) => TRACK_COMPLETED_TASK_STATES.has(taskStatus(task)))) {
        return [readySummary(child, container)];
      }
      return readyFromContainer(child, dependencies);
    }
    return [readySummary(child, container)];
  });
}

function readySummary(node: DataElementNode, parent: DataElementNode): ReadyTrackTask {
  const criteria = ownedCriteria(node);
  return {
    id: elementLabel(node),
    kind: node.tag as 'Task' | 'TaskGroup',
    ...(scalar(node.attributes?.name) ? { name: scalar(node.attributes?.name) } : {}),
    status: taskStatus(node),
    parent: elementLabel(parent),
    criteria: {
      checked: criteria.filter((criterion) => scalar(criterion.attributes?.checked) === 'true').length,
      total: criteria.length,
    },
  };
}

function scheduleDependencies(root: DataElementNode): Map<string, Map<string, string[]>> {
  const result = new Map<string, Map<string, string[]>>();
  const visit = (node: DataElementNode): void => {
    if (node.tag === 'Dag') {
      const owner = scalar(node.attributes?.for);
      if (owner) {
        const nodes = new Map<string, string[]>();
        for (const child of children(node).filter((candidate) => candidate.tag === 'Node')) {
          nodes.set(elementLabel(child), children(child)
            .filter((candidate) => candidate.tag === 'After')
            .map((after) => scalar(after.attributes?.ref))
            .filter((ref): ref is string => Boolean(ref)));
        }
        result.set(owner, nodes);
      }
    }
    for (const child of children(node)) visit(child);
  };
  visit(root);
  return result;
}

function ownedCriteria(node: DataElementNode): ElementNode[] {
  return elementChildren(node).flatMap((child) => {
    if (!isDataElement(child) || (child.tag !== 'Acceptance' && child.tag !== 'Gate')) return [];
    return collectCriteria(child);
  });
}

function collectCriteria(root: DataElementNode): ElementNode[] {
  const out: ElementNode[] = [];
  const visit = (node: ElementNode): void => {
    if (node.tag === 'Criterion') out.push(node);
    if (isDataElement(node)) for (const child of elementChildren(node)) visit(child);
  };
  visit(root);
  return out;
}

function taskChildren(node: DataElementNode): DataElementNode[] {
  const direct = children(node);
  const subNodes = direct.find((child) => child.tag === 'SubNodes');
  const candidates = subNodes ? children(subNodes) : direct;
  return candidates.filter((child) => child.tag === 'Task' || child.tag === 'TaskGroup');
}

function taskStatus(node: DataElementNode): string {
  return scalar(node.attributes?.status) ?? 'NOT_STARTED';
}

function elementLabel(node: ElementNode): string {
  return wordToString(node.id) ?? node.tag;
}

function incrementRevision(root: DataElementNode): void {
  const current = Number(scalar(root.attributes?.revision) ?? '0');
  root.attributes = { ...(root.attributes ?? {}), revision: Number.isFinite(current) ? current + 1 : 1 };
}

function findById(root: DataElementNode, id: string, tags: readonly string[]): DataElementNode | undefined {
  const matches: DataElementNode[] = [];
  const visit = (node: DataElementNode): void => {
    if (tags.includes(node.tag) && wordToString(node.id) === id) matches.push(node);
    for (const child of children(node)) visit(child);
  };
  visit(root);
  if (matches.length > 1) throw new Error(`Ambiguous resource identity '${id}'.`);
  return matches[0];
}

function children(node: DataElementNode): DataElementNode[] {
  return elementChildren(node).filter(isDataElement);
}

function elementChildren(node: DataElementNode): ElementNode[] {
  const out: ElementNode[] = [];
  for (const key of node.extend?.order ?? []) {
    const child = node.extend?.children[key];
    if (isElement(child)) out.push(child);
  }
  for (const child of node.body ?? []) if (isElement(child)) out.push(child);
  return out;
}

function scalar(value: XnlNode | undefined): string | undefined {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : undefined;
}

function isDataElement(value: XnlNode | undefined): value is DataElementNode {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'kind' in value
    && (value as DataElementNode | TextElementNode).kind === 'DataElement');
}

function isElement(value: XnlNode | undefined): value is ElementNode {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'kind' in value
    && ((value as ElementNode).kind === 'DataElement' || (value as ElementNode).kind === 'TextElement'));
}
