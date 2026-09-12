import { parseXnl, wordToString, type XnlWord } from 'xnl-core';
import type { BehaviorQueryView, DomainOperationRuntime, DomainQuery, DomainQueryResult, DomainQuerySource, TrackQueryView, ProjectStatusView } from 'depa-codument-domain-contract';
import { lifecycleSourceCodec } from './lifecycle-source';
import { attr, children, descendants, first } from './validation-tree';
import { indexXnlRegistry, isDataElement, requireReadyRegistry } from './registry';
import { validateDecisionSources } from './decisions';
import { historicalCompletion } from './historical-completion';

/** Read projections are not verdicts: no hook activation or mutation admission. */
export function projectTrackQuery(source: DomainQuerySource): TrackQueryView {
  const { root, id } = lifecycleSourceCodec.inspect(source.source, 'track');
  const archiveSelection = source.file === `codument/tracks/archived/${source.id}/track.xnl`;
  if (id !== source.id && !archiveSelection) throw new Error(`Track identity does not match its directory: ${source.file}`);
  const goal = attr(root, 'goal'), created = attr(root, 'created_at') ?? '';
  const rawCommit = attr(root, 'commit_mode');
  const commit = rawCommit === 'auto' || rawCommit === 'manual' ? rawCommit : undefined;
  const historical = historicalCompletion(root, source.file);
  const metadata = { track_id: id, track_name: goal, goal, type: 'feature' as const, status: attr(root, 'status') ?? 'new',
    commit_mode: commit, created_at: created, updated_at: attr(root, 'updated_at') ?? created,
    description: attr(root, 'description') || goal || '', ...(historical ? { historicalCompletion: historical } : {}) };
  const space = first(root, 'TaskSpace');
  let taskSummary: TrackQueryView['taskSummary'];
  if (space) {
    const tasks = descendants(space).filter(node => node.tag === 'Task');
    let completed = 0, in_progress = 0, todo = 0, blocked = 0;
    for (const task of tasks) {
      const state = attr(task, 'status');
      if (state === 'DONE') completed++;
      else if (['ACTIVE', 'DELEGATED', 'FORWARDED'].includes(state ?? '')) in_progress++;
      else if (['REFUSED', 'ABANDONED'].includes(state ?? '')) blocked++;
      else todo++;
    }
    taskSummary = { total_phases: children(first(space, 'SubNodes') ?? space).filter(node => node.tag === 'TaskGroup').length,
      total_tasks: tasks.length, total_subtasks: 0, total_estimated_days: 0, completed, in_progress, todo, blocked, commit_mode: commit };
  }
  return { id, metadata, taskSummary, ...(source.files ? { files: source.files } : {}), ...(source.contents ? { contents: source.contents } : {}) };
}

export function projectBehaviorQuery(source: DomainQuerySource, includeContent = false): BehaviorQueryView {
  const parsed = parseXnl(source.source, { textBlockStyle: true });
  const root = parsed.nodes[0];
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(root) || root.tag !== 'Behavior') throw new Error(`Behavior authority is ambiguous: ${source.file}`);
  if (!wordToString(root.id)) throw new Error(`Behavior requires a stable ID: ${source.file}`);
  if (root.metadata.envelopeVersion !== 'halfcode.resource-envelope/v1' || root.metadata.specVersion !== 1
    || 'apiVersion' in root.metadata || 'version' in root.metadata) throw new Error(`Behavior requires migration or review: ${source.file}`);
  const nodes = descendants(root);
  return { id: source.id, path: source.absolutePath, requirements: nodes.filter(node => node.tag === 'Requirement').length,
    scenarios: nodes.filter(node => node.tag === 'Case').length, format: 'xnl', ...(includeContent ? { content: source.source } : {}) };
}

export async function runDomainQuery(runtime: Pick<DomainOperationRuntime, 'queries' | 'decisions'>, input: DomainQuery): Promise<DomainQueryResult> {
  const port = runtime.queries;
  if (!port) throw new Error('Domain query source port is not configured.');
  await port.ensureWorkspace();
  if (input.operation === 'status') return { kind: 'status', value: projectStatusQuery(await port.tracks({})) };
  if (input.operation === 'list') {
    if (input.behaviors) return { kind: 'specs', value: (await port.behaviors()).map(source => projectBehaviorQuery(source)) };
    return { kind: 'tracks', value: (await port.tracks({})).map(projectTrackQuery) };
  }
  if (!input.type || input.type === 'track') {
    const source = (await port.tracks({ id: input.id, detail: true, includeContent: input.includeContent }))[0];
    if (source) return { kind: 'track', value: projectTrackQuery(source) };
    if (input.type) throw new Error(`Track not found: ${input.id}`);
  }
  if (!input.type || input.type === 'spec') {
    const source = (await port.behaviors(input.id))[0];
    if (source) return { kind: 'spec', value: projectBehaviorQuery(source, true) };
    if (input.type) throw new Error(`Spec not found: ${input.id}`);
  }
  if (!runtime.decisions) throw new Error('Decision source port is not configured.');
  const source = await runtime.decisions.read('codument/decisions');
  const findings = [...source.findings, ...validateDecisionSources(source.sources)];
  const errors = findings.filter(finding => finding.severity === 'error');
  // A missing optional registry means an absent item, not an invented authority.
  if (errors.length && source.sources.size) throw new Error(errors.map(finding => finding.message).join('\n'));
  const registry = requireReadyRegistry(indexXnlRegistry(source.sources, { registryName: 'decision' }, {
    shouldIndex: node => node.tag === 'decision', uriFor: (_file, id) => `decision://${id}`,
  }));
  const id = input.id.replace(/^decision:\/\//, '');
  const resolved = registry.index.get(id);
  if (!resolved) throw new Error(`Item not found: ${input.id}`);
  const field = (key: string): string | undefined => {
    const value = resolved.node.attributes?.[key] ?? resolved.node.metadata[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (!value || typeof value !== 'object') return undefined;
    return (!Array.isArray(value) ? wordToString(value as XnlWord) : undefined) ?? JSON.stringify(value);
  };
  return { kind: 'decision', value: { id: resolved.id, uri: resolved.uri, owner_file: resolved.file, owner: resolved.owner,
    status: field('status'), source: field('source'), provenance: field('provenance'),
    ancestors: resolved.ancestors.map(({ tag, id }) => ({ tag, id })), parent: resolved.parent, path: resolved.path, node: resolved.node } };
}

/** Status is a read projection over the same admitted authorities as list/show. */
export function projectStatusQuery(sources: readonly DomainQuerySource[]): ProjectStatusView {
  const tracks = sources.map(projectTrackQuery);
  const tasks = { total: 0, completed: 0, inProgress: 0, todo: 0, blocked: 0 };
  for (const track of tracks) {
    const summary = track.taskSummary;
    if (!summary) continue;
    tasks.total += summary.total_tasks; tasks.completed += summary.completed;
    tasks.inProgress += summary.in_progress; tasks.todo += summary.todo; tasks.blocked += summary.blocked;
  }
  const counts = { total: tracks.length, completed: tracks.filter(track => track.metadata.status === 'completed').length,
    inProgress: tracks.filter(track => track.metadata.status === 'in_progress').length,
    new: tracks.filter(track => track.metadata.status === 'new').length };
  const active = tracks.find(track => track.metadata.status === 'in_progress');
  let current: { track: string; phase?: string; task?: string; nextTask?: string } | undefined;
  if (active) {
    current = { track: active.id };
    const { root } = lifecycleSourceCodec.inspect(sources.find(source => source.id === active.id)!.source, 'track');
    const space = first(root, 'TaskSpace');
    if (space) for (const phase of children(first(space, 'SubNodes') ?? space).filter(node => node.tag === 'TaskGroup')) {
      for (const task of descendants(phase).filter(node => node.tag === 'Task')) {
        const name = attr(task, 'name') ?? wordToString(task.id) ?? '';
        if (!current.task && attr(task, 'status') === 'ACTIVE') {
          current.task = name; current.phase = attr(phase, 'name') ?? wordToString(phase.id) ?? '';
        }
        if (!current.nextTask && attr(task, 'status') === 'NOT_STARTED') current.nextTask = name;
      }
    }
  }
  let status: ProjectStatusView['status'] = 'On Track';
  if (tasks.blocked) status = 'Blocked';
  else if (!counts.total) status = 'No Tracks';
  else if (counts.completed === counts.total) status = 'Complete';
  return { schema: 'codument.status/v1', status, tracks, current,
    statistics: { tracks: counts, tasks, progress: tasks.total ? Math.round(tasks.completed * 100 / tasks.total) : 0 } };
}
