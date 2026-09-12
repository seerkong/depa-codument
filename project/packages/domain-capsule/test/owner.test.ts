import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { MakeWord, type DataElementNode } from 'xnl-core';
import type { DomainOperationRuntime, OwnedLifecycleSnapshot, VerificationReceipt } from 'depa-codument-domain-contract';
import { createDomainOwner } from '../src';

const at = '2026-09-05T12:00:00.000Z';
function element(tag: string, id: string, attributes: Record<string, string> = {}, body: DataElementNode[] = []): DataElementNode {
  return { kind: 'DataElement', tag, id: MakeWord(id), metadata: {}, attributes, body };
}
function fixture() {
  const trace: string[] = [];
  let revision = 1;
  let current: OwnedLifecycleSnapshot = {
    kind: 'track', id: 'example', stage: 'active', root: element('Track', 'example', { status: 'in_progress' }, [element('Task', 'T1', { status: 'ACTIVE' })]),
    sourceRevision: '1', directory: 'codument/tracks/active/example', file: 'codument/tracks/active/example/track.xnl',
  };
  const receipts = new Map<string, VerificationReceipt>();
  const runtime: DomainOperationRuntime = {
    clock: { nowIso: () => at },
    verification: {
      clock: { nowIso: () => at }, digest: { sha256: (value) => createHash('sha256').update(value).digest('hex') },
      workspace: { async fingerprint() { return 'workspace-content'; } },
      receipts: { async read(_track, id) { return receipts.get(id); }, async write(receipt) { trace.push('receipt'); receipts.set(receipt.id, receipt); } },
      execution: { async run() { trace.push('verify'); return { exitCode: 0 }; } },
    },
    repository: {
      async load() { trace.push('load'); return structuredClone(current); },
      async commit(source, update) {
        trace.push('commit');
        if (source.sourceRevision !== String(revision)) throw new Error('Source changed');
        revision++;
        current = { ...current, ...structuredClone(update), sourceRevision: String(revision) };
        return { directory: current.directory };
      },
      async resolveTrack(trackId, request) { return { trackId, projectRef: request.projectRef, authority: `codument/tracks/active/${trackId}/track.xnl` }; },
    },
  };
  return { runtime, trace, state: () => current, edit: (root?: DataElementNode) => {
    revision++;
    current = { ...current, sourceRevision: String(revision), ...(root ? { root } : {}) };
  } };
}

describe('domain resource owner', () => {
  it('snapshots decision query inputs, drains admitted reads and closes their admission with the same owner', async () => {
    const test = fixture();
    const targets: (string | undefined)[] = [];
    let finish!: () => void;
    const held = new Promise<void>(resolve => { finish = resolve; });
    const owner = createDomainOwner({ ...test.runtime, decisions: { async read(target) {
      targets.push(target);
      await held;
      return { display: target ?? '.', sources: new Map(), findings: [] };
    } } });
    const request = { operation: 'validate' as const, target: 'original' };
    const pending = owner.decisions(request);
    request.target = 'changed';
    const closing = owner.close();
    await expect(owner.decisions(request)).rejects.toThrow('closed');
    finish();
    expect(await pending).toEqual({ display: 'original', findings: [], frontier: [] });
    await closing;
    expect(targets).toEqual(['original']);
    await expect(owner.createDecision({ file: 'decisions.xnl', id: 'D1' })).rejects.toThrow('closed');
    expect(test.trace).toEqual([]);
  });
  it('uses one operation to verify then commit a legacy-shaped completion receipt', async () => {
    const test = fixture();
    const owner = createDomainOwner(test.runtime);
    try {
      const result = await owner.apply({ type: 'task-complete', kind: 'track', id: 'example', taskId: 'T1', command: ['bun', 'test'] });
      expect(result).toMatchObject({ kind: 'track', id: 'example:T1', from: 'ACTIVE', to: 'DONE', verification: { reused: false, exit_code: 0 } });
      expect(test.trace).toEqual(['load', 'verify', 'receipt', 'commit']);
      expect(test.state().root.body?.[0]).toMatchObject({ attributes: { status: 'DONE' } });
    } finally { await owner.close(); }
  });

  it('does not verify an unfinished TaskGroup or allow a direct Track DONE command', async () => {
    const test = fixture();
    test.edit(element('Track', 'example', { status: 'in_progress' }, [element('TaskGroup', 'G1', {}, [element('Task', 'T1')])]));
    const owner = createDomainOwner(test.runtime);
    try {
      await expect(owner.apply({ type: 'task-complete', kind: 'track', id: 'example', taskId: 'G1', command: ['bun', 'test'] })).rejects.toThrow('unfinished');
      await expect(owner.apply({ type: 'task-transition', kind: 'track', id: 'example', taskId: 'T1', status: 'DONE' })).rejects.toThrow('must use');
      expect(test.trace).toEqual(['load', 'load']);
    } finally { await owner.close(); }
  });

  it('rejects source changes made during verification instead of overwriting them', async () => {
    const test = fixture();
    const runtime = { ...test.runtime, verification: { ...test.runtime.verification, execution: { async run() {
      test.edit(element('Track', 'example', { status: 'in_progress', user_edit: 'keep' }, [element('Task', 'T1', { status: 'ACTIVE' })]));
      return { exitCode: 0 };
    } } } };
    const owner = createDomainOwner(runtime);
    try {
      await expect(owner.apply({ type: 'task-complete', kind: 'track', id: 'example', taskId: 'T1', command: ['bun', 'test'] })).rejects.toThrow('Source changed');
      expect(test.state().root.attributes?.user_edit).toBe('keep');
      expect(test.state().root.body?.[0]).toMatchObject({ attributes: { status: 'ACTIVE' } });
    } finally { await owner.close(); }
  });

  it('a failed verifier never reaches resource commit and later work still runs', async () => {
    const test = fixture();
    const owner = createDomainOwner({ ...test.runtime, verification: { ...test.runtime.verification, execution: { async run() { return { exitCode: 7 }; } } } });
    try {
      await expect(owner.apply({ type: 'task-complete', kind: 'track', id: 'example', taskId: 'T1', command: ['bun', 'test'] })).rejects.toThrow('exit code 7');
      expect(test.trace).toEqual(['load']);
      expect((await owner.apply({ type: 'gap-round', kind: 'track', id: 'example', round: 2 })).to).toBe('2');
    } finally { await owner.close(); }
  });

  it('serializes same-resource operations, snapshots input, drains on close, and rejects new work', async () => {
    const test = fixture();
    let unblock!: () => void;
    const gate = new Promise<void>((resolve) => { unblock = resolve; });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    let released = 0;
    const runtime = { ...test.runtime, repository: { ...test.runtime.repository, async load() {
      entered(); await gate; return test.runtime.repository.load({ kind: 'track', id: 'example' }, { includeArchived: false });
    } } };
    const owner = createDomainOwner(runtime, { async release() { released++; } });
    const input = { type: 'gap-round' as const, kind: 'track' as const, id: 'example', round: 2 };
    const first = owner.apply(input);
    input.round = 99;
    const second = owner.apply({ ...input, round: 3 });
    await started;
    const closing = owner.close();
    expect(owner.close()).toBe(closing);
    const rejected = owner.ready('example').then(() => false, () => true);
    expect(released).toBe(0);
    unblock();
    expect((await first).to).toBe('2');
    expect((await second).from).toBe('2');
    await closing;
    expect(await rejected).toBe(true);
    expect(released).toBe(1);
    expect(test.state().root.attributes?.gap_round).toBe(3);
  });

  it('keeps different owners isolated and never releases borrowed dependencies implicitly', async () => {
    const first = fixture();
    const second = fixture();
    const a = createDomainOwner(first.runtime);
    const b = createDomainOwner(second.runtime);
    await a.apply({ type: 'gap-round', kind: 'track', id: 'example', round: 4 });
    await a.close();
    expect(second.state().root.attributes?.gap_round).toBeUndefined();
    expect((await b.apply({ type: 'gap-round', kind: 'track', id: 'example', round: 5 })).to).toBe('5');
    await b.close();
    expect(first.state().root.attributes?.gap_round).toBe(4);
  });

  it('propagates owned release errors with idempotent close', async () => {
    let releases = 0;
    const owner = createDomainOwner(fixture().runtime, { async release() { releases++; throw new Error('release failed'); } });
    const closing = owner.close();
    await expect(closing).rejects.toThrow('release failed');
    expect(owner.close()).toBe(closing);
    expect(releases).toBe(1);
  });
});
