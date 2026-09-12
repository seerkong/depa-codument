import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import type { VerificationReceipt, VerificationRequest, VerificationRuntime } from 'depa-codument-domain-contract';
import { projectTrackVerificationContract, runTrackVerification } from '../src';

const at = '2026-09-05T12:00:00.000Z';
const request: VerificationRequest = { track: 'sample', command: ['bun', 'test'] };

function fixture() {
  let content = 'content-v1';
  let executions = 0;
  const receipts = new Map<string, unknown>();
  const trace: string[] = [];
  const runtime: VerificationRuntime = {
    workspace: { async fingerprint(track) { trace.push('fingerprint:' + track); return content; } },
    receipts: {
      async read(track, id) { trace.push('read'); return receipts.get(track + ':' + id); },
      async write(receipt) { trace.push('write'); receipts.set(receipt.track + ':' + receipt.id, structuredClone(receipt)); },
    },
    execution: { async run() { trace.push('execute'); executions++; return { exitCode: 0 }; } },
    digest: { sha256: (value) => createHash('sha256').update(value).digest('hex') },
    clock: { nowIso: () => at },
  };
  return { runtime, receipts, trace, executions: () => executions, content: (value: string) => { content = value; } };
}

describe('verification receipt owner processor', () => {
  it('retains every obligation and extension while ignoring only owned progress fields', () => {
    const source = '<Track #sample {status="in_progress" goal="source authority" updated_at="before" gap_round=0} (<TaskSpace #TS (<SubNodes [<TaskGroup #G {status="ACTIVE"} (<SubNodes [<Task #T {status="ACTIVE"} (<Acceptance [<Criterion #C {checked=false} ?>observable behavior</?>]>)>]><Gate [<Criterion #GAC {checked=false} ?>integration</?>]>)>]>)><Hooks [<Hook {on="task:after"} (<GapLoop {max_rounds=3 on_exhausted="block" verify_round=true}><AttractorCheck {use="security"}>)>]><Extension {status="business" checked=false}>)>';
    const before = projectTrackVerificationContract(source);
    expect(projectTrackVerificationContract('<!-- human obligation -->' + source)).not.toBe(before);
    expect(projectTrackVerificationContract(source + '<!-- one -->')).not.toBe(projectTrackVerificationContract(source + '<!-- two -->'));
    const progress = source.replaceAll('status="ACTIVE"', 'status="DONE"').replace('status="in_progress"', 'status="completed"')
      .replace('updated_at="before"', 'updated_at="after"').replace('gap_round=0', 'gap_round=4').replaceAll('<Criterion #C {checked=false}', '<Criterion #C {checked=true}')
      .replace('<Criterion #GAC {checked=false}', '<Criterion #GAC {checked=true}');
    expect(projectTrackVerificationContract(progress)).toBe(before);
    for (const [from, to] of [['source authority', 'other goal'], ['observable behavior', 'new acceptance'], ['integration', 'new gate'],
      ['max_rounds=3', 'max_rounds=4'], ['on_exhausted="block"', 'on_exhausted="continue"'], ['verify_round=true', 'verify_round=false'],
      ['use="security"', 'use="other"'], ['task:after', 'task:before'], ['status="business"', 'status="changed"'],
      ['<Extension {status="business" checked=false}>', '<Extension {status="business" checked=true}>']]) {
      expect(projectTrackVerificationContract(source.replace(from, to))).not.toBe(before);
    }
    for (const unknown of ['not xnl', '<Unknown #x {status="ACTIVE"}>', '<Track #a><Track #b>']) expect(projectTrackVerificationContract(unknown)).toBe(unknown);
  });
  it('reuses matching evidence, invalidates source/command/track changes, and preserves old receipt keys', async () => {
    const test = fixture();
    const first = await runTrackVerification(test.runtime, request);
    expect(first).toMatchObject({ reused: false, exit_code: 0, cwd: '.', verified_at: at });
    expect(test.trace).toEqual(['fingerprint:sample', 'read', 'execute', 'fingerprint:sample', 'write']);
    const expectedId = 'vr-' + createHash('sha256').update(JSON.stringify({ version: 1, track: 'sample', cwd: '.', command: ['bun', 'test'], fingerprint: 'content-v1' })).digest('hex').slice(0, 20);
    expect(first.id).toBe(expectedId);
    const cached = await runTrackVerification(test.runtime, request);
    expect(cached).toMatchObject({ id: first.id, reused: true });
    expect(test.executions()).toBe(1);
    test.content('content-v2');
    expect((await runTrackVerification(test.runtime, request)).reused).toBe(false);
    expect((await runTrackVerification(test.runtime, { ...request, command: ['bun', 'test', '--new'] })).reused).toBe(false);
    expect((await runTrackVerification(test.runtime, { ...request, track: 'other' })).reused).toBe(false);
    expect(test.executions()).toBe(4);
  });

  it('always executes --fresh, even when a valid receipt already exists', async () => {
    const test = fixture();
    await runTrackVerification(test.runtime, request);
    test.trace.length = 0;
    expect((await runTrackVerification(test.runtime, { ...request, fresh: true })).reused).toBe(false);
    expect(test.trace).toEqual(['fingerprint:sample', 'execute', 'fingerprint:sample', 'write']);
    expect(test.executions()).toBe(2);
  });

  it('does not write success evidence for a failed or missing command', async () => {
    const test = fixture();
    for (const run of [async () => ({ exitCode: 7 }), async () => { throw new Error('ENOENT'); }]) {
      await expect(runTrackVerification({ ...test.runtime, execution: { run } }, request)).rejects.toThrow('Verification command');
    }
    expect(test.receipts.size).toBe(0);
    await expect(runTrackVerification(test.runtime, { ...request, command: [] })).rejects.toThrow('required');
    expect(test.executions()).toBe(0);
  });

  it('does not treat malformed or mismatched cache files as valid evidence', async () => {
    const test = fixture();
    const receipt = await runTrackVerification(test.runtime, request);
    const key = 'sample:' + receipt.id;
    const invalid: unknown[] = [null, [], 42, {}, { ...receipt, id: 'wrong' }, { ...receipt, version: 2 }, { ...receipt, exit_code: 1 }, { ...receipt, cwd: '/other' }, { ...receipt, verified_at: '' }];
    for (const value of invalid) {
      test.receipts.set(key, value);
      expect((await runTrackVerification(test.runtime, request)).reused).toBe(false);
    }
    expect(test.executions()).toBe(invalid.length + 1);
  });

  it('observes post-command content and snapshots caller input before awaits', async () => {
    const test = fixture();
    const input = { ...request, command: ['bun', 'test'] };
    const runtime: VerificationRuntime = { ...test.runtime, execution: { async run(command, capture) {
      expect(command).toEqual(['bun', 'test']);
      expect(capture).toBe(true);
      test.content('after-build');
      return { exitCode: 0 };
    } } };
    const pending = runTrackVerification(runtime, { ...input, captureOutput: true });
    input.command[0] = 'mutated';
    const receipt = await pending;
    expect(receipt.workspace_fingerprint).toBe('after-build');
    expect(receipt.command).toEqual(['bun', 'test']);
    expect((await runTrackVerification(runtime, request)).reused).toBe(true);
  });

  it('isolates runtimes and propagates receipt-store failure', async () => {
    const first = fixture();
    const second = fixture();
    await runTrackVerification(first.runtime, request);
    expect((await runTrackVerification(second.runtime, request)).reused).toBe(false);
    const runtime = { ...first.runtime, receipts: { ...first.runtime.receipts, async write(_receipt: VerificationReceipt) { throw new Error('disk full'); } } };
    await expect(runTrackVerification(runtime, { ...request, fresh: true })).rejects.toThrow('disk full');
  });
});
