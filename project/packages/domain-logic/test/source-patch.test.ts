import { describe, expect, it } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import type { LifecycleSnapshot, VerificationReceipt } from 'depa-codument-domain-contract';
import { bindMissionTrack, completeVerifiedTrackTask, patchLifecycleSource, setLifecycleGapRound, transitionLifecycleResource } from '../src';

const at = '2026-09-05T12:00:00.000Z';
function root(source: string): DataElementNode { return parseXnl(source, { textBlockStyle: true }).nodes[0] as DataElementNode; }
function snapshot(source: string, kind: 'track' | 'mission' = 'track'): LifecycleSnapshot {
  return { kind, id: 'example', stage: 'active', root: root(source) };
}
const receipt: VerificationReceipt = { version: 1, id: 'vr-test', track: 'example', cwd: '.', command: ['bun', 'test'], workspace_fingerprint: 'test', exit_code: 0, reused: false, verified_at: at };

describe('source-preserving lifecycle patches', () => {
  it('changes only scalar value tokens and retains original comments, spacing and line endings', () => {
    const source = '<!-- before -->\r\n<Track #example { status = \'new\' <!-- beside value --> updated_at = "old" }><!-- after -->\r\n';
    const input = snapshot(source);
    const proposed = transitionLifecycleResource(input, 'in_progress', at);
    const result = patchLifecycleSource(source, input.root, proposed.root);
    expect(result).toBe(source.replace("'new'", '"in_progress"').replace('"old"', JSON.stringify(at)));
    expect(root(result)).toEqual(proposed.root);
  });

  it('does not tokenize apparent nodes or quotes inside text blocks or string values', () => {
    const opaque = '<Description ?DOC>quotes " \' and <Task #fake> <!-- keep in text --> </?other>\nUnicode 中文</?DOC>';
    const source = '<Track #example memo={ nested=[<Info { value="<Task #fake>" }>] } { status="in_progress" custom="<Criterion ?>fake</?>" } ( '
      + opaque + ' <TaskSpace #TS (<SubNodes [<Task #T1 {status="ACTIVE"} (<Acceptance [<Criterion #C1 {checked=false} ?C>criterion <!-- keep --> <Task #fake></?C>]>)> ]>)>)>';
    const input = snapshot(source);
    const proposed = completeVerifiedTrackTask(input, 'T1', receipt, at);
    const result = patchLifecycleSource(source, input.root, proposed.root);
    expect(result).toContain(opaque);
    expect(result).toContain('criterion <!-- keep --> <Task #fake>');
    expect(result).toContain('custom="<Criterion ?>fake</?>"');
    expect(result).toContain('checked=true');
    expect(result).toContain('status="DONE"');
    expect(root(result)).toEqual(proposed.root);
  });

  it('adds absent attribute blocks and attributes while retaining nested anonymous criteria', () => {
    const source = '<Track #example {status="in_progress"} (<TaskSpace #TS (<SubNodes [<Task #T1 (<Acceptance [<Criterion ?>anonymous</?>]>)> ]>)>)>';
    const input = snapshot(source);
    const proposed = completeVerifiedTrackTask(input, 'T1', receipt, at);
    const result = patchLifecycleSource(source, input.root, proposed.root);
    expect(result).toContain('?>anonymous</?>');
    expect(result).toContain('"checked" = true');
    expect(result).toContain('"status" = "DONE"');
    expect(root(result)).toEqual(proposed.root);
  });

  it('patches Mission revision and binding identity without rewriting ProjectRefs or comments', () => {
    const source = '<Mission #example {status="active" revision=2} (<ProjectRefs [<ProjectRef #library {kind="external"}>]> <Task #M1 {status="NOT_STARTED"} (<TrackLink #candidate <!-- link note --> {state="candidate" project_ref="library"}>)>)>';
    const input = snapshot(source, 'mission');
    const proposed = bindMissionTrack(input, 'M1', { trackId: 'bound-track', authority: 'codument/tracks/active/bound-track/track.xnl', projectRef: 'library' }, at);
    const result = patchLifecycleSource(source, input.root, proposed.root);
    expect(result).toContain('#bound-track <!-- link note -->');
    expect(result).toContain('revision=3');
    expect(result).toContain('<ProjectRef #library {kind="external"}>');
    expect(root(result)).toEqual(proposed.root);
  });

  it('handles attributes after body sections and metadata string keys without confusing braces', () => {
    const source = '<Track #example "opaque key"={stuff=[1 {other="value"}]} [<Task #T1>] { status="in_progress" }>';
    const input = snapshot(source);
    const proposed = setLifecycleGapRound(input, 3, at);
    const result = patchLifecycleSource(source, input.root, proposed.root);
    expect(result).toContain('"opaque key"={stuff=[1 {other="value"}]} [<Task #T1>]');
    expect(root(result)).toEqual(proposed.root);
  });

  it('fails closed on structural edits, scalar removals or stale semantic sources', () => {
    const source = '<Track #example {status="in_progress"} [<Task #T1>]>';
    const before = root(source);
    const structural = structuredClone(before);
    structural.body = [];
    expect(() => patchLifecycleSource(source, before, structural)).toThrow('retain source for review');
    const removed = structuredClone(before);
    delete removed.attributes!.status;
    expect(() => patchLifecycleSource(source, before, removed)).toThrow('retain source for review');
    expect(() => patchLifecycleSource(source.replace('in_progress', 'completed'), before, before)).toThrow('source changed');
    const metadata = structuredClone(before);
    metadata.metadata.specVersion = 2;
    expect(() => patchLifecycleSource(source, before, metadata)).toThrow('retain source for review');
  });

  it('leaves no temporary span metadata and no-op calls preserve source exactly', () => {
    const source = '<Track #example __codument_source_span=99 {status="in_progress"}><!-- trailing -->';
    const before = root(source);
    expect(patchLifecycleSource(source, before, structuredClone(before))).toBe(source);
    const proposed = setLifecycleGapRound(snapshot(source), 1, at);
    const result = patchLifecycleSource(source, before, proposed.root);
    expect(result).toContain('__codument_source_span=99');
    expect(result).not.toContain('__codument_source_span_=');
    expect(result).toContain('<!-- trailing -->');
  });

  it('refuses parser ambiguity and malformed source before computing edits', () => {
    const source = '<Track #example (<Task #T1><Task #T2>)>';
    expect(() => patchLifecycleSource(source, root(source), root(source))).toThrow('unambiguous');
    expect(() => patchLifecycleSource('<Track #broken', root('<Track #example>'), root('<Track #example>'))).toThrow();
  });
});
