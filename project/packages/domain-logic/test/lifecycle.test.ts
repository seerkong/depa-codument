import { describe, expect, it } from 'bun:test';
import { MakeWord, parseXnl, stringifyLineBlock, type DataElementNode, type XnlNode } from 'xnl-core';
import type { LifecycleSnapshot, VerificationReceipt } from 'depa-codument-domain-contract';
import {
  archiveMissionState, assertTrackTaskCompletable, bindMissionTrack, completeVerifiedTrackTask,
  missionTrackBindingRequest, readyTrackTasks, setLifecycleGapRound,
  transitionLifecycleResource, transitionLifecycleTask,
} from '../src';

const at = '2026-09-05T12:00:00.000Z';
const receipt: VerificationReceipt = {
  version: 1, id: 'vr-fixture', track: 'example', cwd: '.', command: ['bun', 'test'],
  workspace_fingerprint: 'fixture-fingerprint', exit_code: 0, verified_at: at, reused: false,
};

function snapshot(body = '', kind: 'track' | 'mission' = 'track', attributes?: string): LifecycleSnapshot {
  const tag = kind === 'track' ? 'Track' : 'Mission';
  const status = attributes ?? `status = "${kind === 'track' ? 'in_progress' : 'active'}" revision = 2`;
  const parsed = parseXnl(`<${tag} #example envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 { ${status} } ( ${body} )>`, { textBlockStyle: true });
  expect(parsed.warnings ?? []).toHaveLength(0);
  return { kind, id: 'example', stage: 'active', root: parsed.nodes[0] as DataElementNode };
}

function element(tag: string, id: string, attrs: Record<string, XnlNode> = {}): DataElementNode {
  return { kind: 'DataElement', tag, id: MakeWord(id), metadata: {}, attributes: attrs };
}

function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) frozen(child);
  }
  return value;
}

function text(source: LifecycleSnapshot): string {
  return stringifyLineBlock(source.root, { textBlockStyle: true, textMarkerFactory: () => 'fixture_text' });
}

describe('pure lifecycle proposals', () => {
  it('starts pending resources without mutating the source and retains explicit timestamps', () => {
    for (const kind of ['track', 'mission'] as const) {
      const source = frozen({ ...snapshot('', kind, `status = "${kind === 'track' ? 'new' : 'pending'}"`), stage: 'pending' as const });
      const before = structuredClone(source);
      const updated = transitionLifecycleResource(source, kind === 'track' ? 'in_progress' : 'active', at);
      expect(updated.stage).toBe('active');
      expect(updated.root.attributes?.updated_at).toBe(at);
      expect(updated.root.attributes?.revision).toBe(kind === 'mission' ? 1 : undefined);
      expect(source).toEqual(before);
    }
  });

  it('preserves the existing legal root-transition matrix, including reopening', () => {
    const matrices = {
      track: { new: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: ['in_progress'], cancelled: ['in_progress'] },
      mission: { pending: ['active', 'cancelled', 'superseded'], active: ['completed', 'cancelled', 'superseded'], completed: ['active'], cancelled: ['active'], superseded: ['active'] },
    };
    for (const kind of ['track', 'mission'] as const) {
      const matrix: Record<string, string[]> = matrices[kind];
      for (const [from, allowed] of Object.entries(matrix)) {
        const source = snapshot('', kind, `status = "${from}"`);
        for (const to of Object.keys(matrix)) {
          if (to === from || allowed.includes(to)) expect(transitionLifecycleResource(source, to, at).to).toBe(to);
          else expect(() => transitionLifecycleResource(source, to, at)).toThrow('Invalid');
        }
      }
    }
  });

  it('reopens archived resources but does not permit in-place edits of an archive', () => {
    const track = { ...snapshot('', 'track', 'status = "completed"'), stage: 'archived' as const };
    expect(transitionLifecycleResource(track, 'in_progress', at).stage).toBe('active');
    expect(() => transitionLifecycleResource(track, 'completed', at)).toThrow('reopened');
    expect(() => setLifecycleGapRound(track, 3, at)).toThrow('reopened');
    const mission = { ...snapshot('', 'mission', 'status = "archived" revision = 5'), stage: 'archived' as const };
    expect(transitionLifecycleResource(mission, 'active', at).root.attributes?.revision).toBe(6);
  });

  it('retains all task states and prevents bypassing verified Track DONE', () => {
    const track = snapshot('<Task #T1 { status = "NOT_STARTED" }>');
    for (const status of ['NOT_STARTED', 'ACTIVE', 'DELEGATED', 'FORWARDED', 'REFUSED', 'ABANDONED']) {
      expect(transitionLifecycleTask(track, 'T1', status, at).to).toBe(status);
    }
    expect(() => transitionLifecycleTask(track, 'T1', 'DONE', at)).toThrow('must use');
    expect(() => transitionLifecycleTask(track, 'T1', 'invented', at)).toThrow('Invalid');
    const mission = snapshot('<Task #M1>', 'mission');
    for (const status of ['NOT_STARTED', 'ACTIVE', 'DONE', 'BLOCKED', 'ABANDONED', 'SUPERSEDED']) {
      expect(transitionLifecycleTask(mission, 'M1', status, at).root.attributes?.revision).toBe(3);
    }
  });

  it('rejects incomplete groups before verification and requires a separate owned Gate check', () => {
    const source = frozen(snapshot(`<TaskSpace #TS { child_mode = "sequential" } (
      <SubNodes [<TaskGroup #P1 { status = "ACTIVE" } (
        <SubNodes [<Task #T1 { status = "ACTIVE" } (<Acceptance [<Criterion #C1 { checked = false } ?>leaf</?>]>)> ]>
        <Gate [<Criterion #G1 { checked = false } ?>gate</?>]>
      )>]>
    )>`));
    expect(() => assertTrackTaskCompletable(source, 'P1')).toThrow('unfinished children');
    const leaf = completeVerifiedTrackTask(source, 'T1', receipt, at);
    expect(text(leaf)).toContain('<TaskGroup #P1 { status = "ACTIVE" }');
    expect(text(leaf)).toContain('<Criterion #G1 { checked = false }');
    expect(readyTrackTasks(leaf).ready).toMatchObject([{ id: 'P1', criteria: { checked: 0, total: 1 } }]);
    expect(() => transitionLifecycleResource(leaf, 'completed', at)).toThrow('unfinished tasks');
    const gate = completeVerifiedTrackTask(leaf, 'P1', receipt, at);
    expect(text(gate)).toContain('<Criterion #G1 { checked = true }');
    expect(transitionLifecycleResource(gate, 'completed', at).to).toBe('completed');
    expect(text(source)).toContain('<Task #T1 { status = "ACTIVE" }');
  });

  it('rolls up completed nested groups without Gates, leaving unrelated extensions unchanged', () => {
    const source = snapshot(`<TaskSpace #TS (<SubNodes [<TaskGroup #P1 { status = "ACTIVE" } (<SubNodes [
      <TaskGroup #P2 { status = "ACTIVE" } (<SubNodes [<Task #T1 { status = "ACTIVE" }> ]>)>
    ]>)> ]>)>`);
    source.root.metadata.extra = { flags: [true, 7], note: 'opaque metadata' };
    source.root.attributes!.extension = { nested: ['a', { unknown: 42 }] };
    source.root.body = [{ kind: 'Comment', value: 'keep this comment' }, element('FutureExtension', 'X1', { value: [1, false] })];
    const updated = completeVerifiedTrackTask(frozen(source), 'T1', receipt, at);
    expect(text(updated)).toContain('<TaskGroup #P1 { status = "DONE" }');
    expect(text(updated)).toContain('<TaskGroup #P2 { status = "DONE" }');
    expect(updated.root.metadata).toEqual(source.root.metadata);
    expect(updated.root.attributes?.extension).toEqual(source.root.attributes?.extension);
    expect(updated.root.body!.slice(-2)).toEqual(source.root.body!.slice(-2));
    expect(updated.root.body!.at(-1)).not.toBe(source.root.body!.at(-1));
  });

  it('still rejects unchecked criteria even when all tasks are terminal', () => {
    const source = snapshot('<Task #T1 { status = "ABANDONED" } (<Acceptance [<Criterion #C1 { checked = false } ?>required</?>]>)>');
    expect(() => transitionLifecycleResource(source, 'completed', at)).toThrow('unchecked criteria');
    const mission = snapshot('<Task #T1 { status = "SUPERSEDED" }>', 'mission');
    expect(transitionLifecycleResource(mission, 'completed', at).to).toBe('completed');
    expect(() => transitionLifecycleResource(snapshot('<Task #T1 { status = "BLOCKED" }>', 'mission'), 'completed', at)).toThrow('unfinished tasks');
  });

  it('checks receipt identity and success without claiming to prove external freshness', () => {
    const source = frozen(snapshot('<Task #T1>'));
    for (const change of [{ version: 2 }, { track: 'other' }, { exit_code: 7 }, { cwd: '/other' }, { command: [] }, { workspace_fingerprint: '' }]) {
      expect(() => completeVerifiedTrackTask(source, 'T1', { ...receipt, ...change } as VerificationReceipt, at)).toThrow('matching verification');
    }
    const updated = completeVerifiedTrackTask(source, 'T1', receipt, at);
    expect(updated.verification).toEqual(receipt);
    expect(updated.verification).not.toBe(receipt);
  });

  it('projects sequential readiness, including delegated/refused blockers', () => {
    const source = snapshot('<TaskSpace #TS (<SubNodes [<Task #T1 { name = "first" status = "ACTIVE" }> <Task #T2 { status = "NOT_STARTED" }>]>)>');
    expect(readyTrackTasks(source).ready).toMatchObject([{ id: 'T1', parent: 'TS', name: 'first', criteria: { total: 0 } }]);
    for (const status of ['DELEGATED', 'FORWARDED', 'REFUSED']) {
      expect(readyTrackTasks(transitionLifecycleTask(source, 'T1', status, at)).ready).toEqual([]);
    }
    const completed = completeVerifiedTrackTask(source, 'T1', receipt, at);
    expect(readyTrackTasks(completed).ready.map((task) => task.id)).toEqual(['T2']);
    expect(readyTrackTasks(completeVerifiedTrackTask(completed, 'T2', receipt, at)).ready).toEqual([]);
  });

  it('projects DAG readiness and requires missing dependencies to remain blocked', () => {
    const source = snapshot(`<TaskSpace #TS { child_mode = "dag" } (<SubNodes [
      <Task #T1 { status = "DONE" }> <Task #T2> <Task #T3> <Task #T4>
    ]>)><Schedule (<Dag #D1 { for = "TS" } [
      <Node #T2 [<After { ref = "T1" }>]>
      <Node #T3 [<After { ref = "T2" }>]>
      <Node #T4 [<After { ref = "missing" }>]>
    ]>)>`);
    expect(readyTrackTasks(source).ready.map((task) => task.id)).toEqual(['T2']);
    expect(readyTrackTasks(completeVerifiedTrackTask(source, 'T2', receipt, at)).ready.map((task) => task.id)).toEqual(['T3']);
  });

  it('rejects ambiguous IDs and mismatched roots instead of choosing an authority', () => {
    const duplicate = snapshot('<TaskSpace [<Task #T1><Task #T1>]>');
    expect(() => transitionLifecycleTask(duplicate, 'T1', 'ACTIVE', at)).toThrow('Ambiguous');
    expect(() => transitionLifecycleTask(snapshot('<Task #T1>'), 'missing', 'ACTIVE', at)).toThrow('has no');
    expect(() => transitionLifecycleResource({ ...snapshot(), id: 'other' }, 'completed', at)).toThrow('authority root');
    expect(() => readyTrackTasks(snapshot('', 'mission'))).toThrow('requires a Track');
  });

  it('preserves GapLoop state and does not silently reset a requested round', () => {
    const source = frozen(snapshot('<Hooks [<Hook #H1 { rounds = 8 }>]> <GapLoop { max_rounds = 7 }>', 'mission'));
    const updated = setLifecycleGapRound(source, 3, at);
    expect(updated).toMatchObject({ from: '0', to: '3' });
    expect(updated.root.attributes).toMatchObject({ gap_round: 3, revision: 3 });
    expect(updated.root.body).toEqual(source.root.body);
    expect(updated.root.extend).toEqual(source.root.extend);
    for (const round of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => setLifecycleGapRound(source, round, at)).toThrow('non-negative integer');
    expect(() => setLifecycleGapRound(source, 0, 'not-a-date')).toThrow('timestamp');
  });

  it('retains ProjectRef and nested mission links during a portable Track binding', () => {
    const source = frozen(snapshot(`<ProjectRefs [<ProjectRef #library { kind = "external" }>]>
      <Task #M1 (<TrackLink #candidate { state = "candidate" project_ref = "library" }>)>
      <MissionLink #nested { state = "bound" }>`, 'mission'));
    expect(missionTrackBindingRequest(source, 'M1')).toEqual({ projectRef: 'library', projectKind: 'external' });
    const updated = bindMissionTrack(source, 'M1', { trackId: 'bound-track', projectRef: 'library', authority: 'codument/tracks/active/bound-track/track.xnl' }, at);
    expect(updated).toMatchObject({ from: 'candidate:candidate', to: 'bound-track:bound', subject: 'example:M1' });
    expect(updated.root.attributes?.revision).toBe(3);
    expect(text(updated)).toContain('<TrackLink #bound-track { state = "bound" project_ref = "library" }>');
    expect(text(updated)).toContain('<MissionLink #nested { state = "bound" }>');
    expect(text(source)).toContain('<TrackLink #candidate');
    expect(() => bindMissionTrack(source, 'M1', { trackId: 'bound-track', authority: 'track.xnl' }, at)).toThrow('ProjectRef');
    expect(() => bindMissionTrack(source, 'M1', { trackId: 'bound-track', projectRef: 'library', authority: '../track.xnl' }, at)).toThrow('portable');
  });

  it('refuses unknown ProjectRefs, non-leaf tasks, and nonterminal archives', () => {
    expect(() => missionTrackBindingRequest(snapshot('<Task #M1 (<TrackLink #x { project_ref = "missing" }>)>', 'mission'), 'M1')).toThrow('unknown ProjectRef');
    expect(() => missionTrackBindingRequest(snapshot('<TaskGroup #M1>', 'mission'), 'M1')).toThrow('leaf Task');
    expect(() => archiveMissionState(snapshot('', 'mission'), at)).toThrow('terminal');
    for (const state of ['completed', 'cancelled', 'superseded']) {
      const result = archiveMissionState(snapshot('', 'mission', `status = "${state}" revision = 8`), at);
      expect(result.stage).toBe('archived');
      expect(result.root.attributes).toMatchObject({ status: 'archived', revision: 9 });
    }
  });
});
