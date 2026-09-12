import { expect, it } from 'bun:test';
import { projectBehaviorQuery, projectTrackQuery, projectStatusQuery, runDomainQuery } from '../src';
import type { DomainQuerySource } from 'depa-codument-domain-contract';

const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
function snapshot(source: string): DomainQuerySource { return { id: 'example', file: 'source.xnl', absolutePath: '/explicit/source.xnl', source }; }
it('projects current phase, next task, totals and blocked state without executing a lifecycle', () => {
  const source = snapshot(`<Track #example ${envelope} {status="in_progress"} (
    <TaskSpace (<SubNodes [<TaskGroup #G1 {name="Implementation"} (<SubNodes [
      <Task #T1 {status="DONE"}><Task #T2 {status="ACTIVE" name="Build"}>
      <Task #T3 {status="NOT_STARTED" name="Verify"}><Task #T4 {status="REFUSED"}>
    ]>)>]>)>)>`);
  const before = structuredClone(source);
  expect(projectStatusQuery([source])).toMatchObject({ status: 'Blocked',
    current: { track: 'example', phase: 'Implementation', task: 'Build', nextTask: 'Verify' },
    statistics: { tracks: { total: 1, inProgress: 1 }, tasks: { total: 4, completed: 1, inProgress: 1, todo: 1, blocked: 1 }, progress: 25 },
  });
  expect(source).toEqual(before);
  expect(projectStatusQuery([]).status).toBe('No Tracks');
  expect(projectStatusQuery([snapshot(`<Track #example ${envelope} {status="completed"}>`)]).status).toBe('Complete');
});
it('projects legacy Track metadata/status totals directly from the complete current tree without mutating sources', () => {
  const source = snapshot(`<Track #example ${envelope} {status="in_progress" goal="Read" created_at="today" commit_mode="manual" unknown={preserved=[1 true]}} (
    <TaskSpace (<SubNodes [<TaskGroup #G1 (<SubNodes [${['DONE', 'ACTIVE', 'DELEGATED', 'FORWARDED', 'REFUSED', 'ABANDONED', 'NOT_STARTED'].map((status, index) => `<Task #T${index} {status="${status}"}>`).join('')}]>)>]>)>
  )>`);
  const before = structuredClone(source);
  const view = projectTrackQuery(source);
  expect(view.metadata).toMatchObject({ track_id: 'example', type: 'feature', goal: 'Read', description: 'Read', updated_at: 'today' });
  expect(view.taskSummary).toEqual({ total_phases: 1, total_tasks: 7, total_subtasks: 0, total_estimated_days: 0, completed: 1, in_progress: 3, blocked: 2, todo: 1, commit_mode: 'manual' });
  expect(source).toEqual(before);
  expect(() => projectTrackQuery({ ...source, id: 'foreign' })).toThrow('identity');
  expect(() => projectTrackQuery(snapshot('<Track #example {status="new"}>'))).toThrow('migration');
});
it('counts Behavior requirements/cases while keeping content explicit and rejecting ambiguous envelopes', () => {
  const source = snapshot(`<Behavior #behavior.id ${envelope} (<Requirements [<Requirement #R1 (<Statement ?>Preserved</?> <Suites [<Suite #S (<Cases [<Case #C1><Case #C2>]>)>]>)>]>)>`);
  expect(projectBehaviorQuery(source)).toEqual({ id: 'example', path: source.absolutePath, requirements: 1, scenarios: 2, format: 'xnl' });
  expect(projectBehaviorQuery(source, true).content).toBe(source.source);
  expect(() => projectBehaviorQuery(snapshot(source.source.replace('specVersion=1', 'specVersion=2')))).toThrow('migration');
  expect(() => projectBehaviorQuery(snapshot(source.source + source.source))).toThrow('ambiguous');
});
it('queries acquire only the required observation port and never treat invalid Decision sources as an empty successful view', async () => {
  const calls: string[] = [];
  const queries = { async ensureWorkspace() { calls.push('workspace'); }, async tracks() { calls.push('tracks'); return []; }, async behaviors() { calls.push('behaviors'); return []; } };
  expect(await runDomainQuery({ queries }, { operation: 'list' })).toEqual({ kind: 'tracks', value: [] });
  expect(calls).toEqual(['workspace', 'tracks']);
  calls.length = 0;
  expect(await runDomainQuery({ queries }, { operation: 'list', behaviors: true })).toEqual({ kind: 'specs', value: [] });
  expect(calls).toEqual(['workspace', 'behaviors']);
  const decisions = { async read() { return { display: 'decisions', sources: new Map([['bad.xnl', '<decision #old>']]), findings: [] }; } };
  await expect(runDomainQuery({ queries, decisions }, { operation: 'show', id: 'old', type: 'decision' })).rejects.toThrow('migration');
});
