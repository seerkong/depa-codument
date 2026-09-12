import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { projectTrackVerificationContract, runTrackVerification } from 'depa-codument-domain-logic';
import { createFileVerificationRuntime } from '../src';

const directory = 'codument/tracks/active/example';
const file = directory + '/track.xnl';
const at = '2026-09-05T12:00:00.000Z';
const env = { ...process.env };

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-verification-effect-'));
  await fs.mkdir(path.join(root, directory, 'reports'), { recursive: true });
  await fs.writeFile(path.join(root, file), '<Track #example>');
  await fs.writeFile(path.join(root, 'source.txt'), 'v1');
  const output: string[] = [];
  const bindings = {
    projectTrackContract: projectTrackVerificationContract,
    async locateTrack(id: string) { if (id !== 'example') throw new Error('Missing track'); return { directory, file }; },
    output: { write: (bytes: Uint8Array) => { output.push(new TextDecoder().decode(bytes)); } },
    clock: { nowIso: () => at },
  };
  return { root, bindings, output, runtime: createFileVerificationRuntime({ workspaceRoot: root, env }, bindings) };
}

describe('workspace verification effects', () => {
  it('runs a real verifier, reuses receipts, invalidates content and respects --fresh', async () => {
    const test = await fixture();
    const originalCwd = process.cwd();
    try {
      const counter = directory + '/reports/counter';
      const command = [process.execPath, '-e', `const p=${JSON.stringify(counter)}; const f=Bun.file(p); const n=await f.exists()?Number(await f.text()):0; await Bun.write(p,String(n+1)); console.log('verified');`];
      const input = { track: 'example', command, captureOutput: true };
      const first = await runTrackVerification(test.runtime, input);
      expect(first.reused).toBe(false);
      expect(test.output.join('')).toContain('verified');
      expect(await fs.readFile(path.join(test.root, counter), 'utf8')).toBe('1');
      expect((await runTrackVerification(test.runtime, input)).reused).toBe(true);
      await fs.writeFile(path.join(test.root, file), '<Track #example { gap_round = 4 }>');
      expect((await runTrackVerification(test.runtime, input)).reused).toBe(true);
      await fs.writeFile(path.join(test.root, 'source.txt'), 'v2');
      expect((await runTrackVerification(test.runtime, input)).reused).toBe(false);
      expect((await runTrackVerification(test.runtime, { ...input, fresh: true })).reused).toBe(false);
      expect(await fs.readFile(path.join(test.root, counter), 'utf8')).toBe('3');
      expect(process.cwd()).toBe(originalCwd);
      expect(await fs.readFile(path.join(test.root, file), 'utf8')).toContain('gap_round = 4');
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('rejects failed/missing executables without writing a success receipt', async () => {
    const test = await fixture();
    try {
      await expect(runTrackVerification(test.runtime, { track: 'example', command: [process.execPath, '-e', 'process.exit(7)'], captureOutput: true })).rejects.toThrow('exit code 7');
      await expect(runTrackVerification(test.runtime, { track: 'example', command: ['codument-no-such-verifier-7ba2'], captureOutput: true })).rejects.toThrow('could not start');
      expect(await fs.readdir(path.join(test.root, directory, 'reports'))).toEqual([]);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('invalidates receipts when Track acceptance or hooks change, not only project source', async () => {
    const test = await fixture();
    try {
      const input = { track: 'example', command: [process.execPath, '-e', 'process.exit(0)'], captureOutput: true };
      await runTrackVerification(test.runtime, input);
      await fs.writeFile(path.join(test.root, file), '<Track #example {goal="a new obligation"}>');
      expect((await runTrackVerification(test.runtime, input)).reused).toBe(false);
      await fs.writeFile(path.join(test.root, file), '<Track #example {goal="a new obligation"} (<Hooks [<Hook {on="task:after"} (<AttractorCheck {use="security"}>)>]>)>');
      expect((await runTrackVerification(test.runtime, input)).reused).toBe(false);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('binds receipt paths to the explicit root and rejects symlinks and path escapes', async () => {
    const test = await fixture();
    const external = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-verification-external-'));
    try {
      await fs.symlink(external, path.join(test.root, directory, 'reports/verification'));
      await expect(runTrackVerification(test.runtime, { track: 'example', command: [process.execPath, '-e', 'process.exit(0)'], fresh: true, captureOutput: true })).rejects.toThrow('symlink');
      expect(await fs.readdir(external)).toEqual([]);
      const escaping = createFileVerificationRuntime({ workspaceRoot: test.root, env }, { ...test.bindings, async locateTrack() { return { directory: '../outside', file: '../outside/track.xnl' }; } });
      await expect(escaping.workspace.fingerprint('example')).rejects.toThrow('relative path');
      await expect(test.runtime.receipts.read('example', '../../receipt')).rejects.toThrow('identity');
      expect(() => createFileVerificationRuntime({ workspaceRoot: '.', env }, test.bindings)).toThrow('absolute');
    } finally { await fs.rm(test.root, { recursive: true, force: true }); await fs.rm(external, { recursive: true, force: true }); }
  });

  it('does not share receipt state between two workspaces with the same Track ID', async () => {
    const first = await fixture();
    const second = await fixture();
    try {
      const input = { track: 'example', command: [process.execPath, '-e', 'process.exit(0)'], captureOutput: true };
      expect((await runTrackVerification(first.runtime, input)).reused).toBe(false);
      expect((await runTrackVerification(second.runtime, input)).reused).toBe(false);
      expect((await runTrackVerification(first.runtime, input)).reused).toBe(true);
      expect((await runTrackVerification(second.runtime, input)).reused).toBe(true);
    } finally { await fs.rm(first.root, { recursive: true, force: true }); await fs.rm(second.root, { recursive: true, force: true }); }
  });

  it('fingerprints untracked source bytes and symlink targets but ignores fallback build directories', async () => {
    const test = await fixture();
    try {
      const before = await test.runtime.workspace.fingerprint('example');
      await fs.mkdir(path.join(test.root, 'node_modules/example'), { recursive: true });
      await fs.writeFile(path.join(test.root, 'node_modules/example/data'), 'ignored');
      expect(await test.runtime.workspace.fingerprint('example')).toBe(before);
      await fs.writeFile(path.join(test.root, 'untracked.txt'), 'new');
      const added = await test.runtime.workspace.fingerprint('example');
      expect(added).not.toBe(before);
      await fs.symlink('source.txt', path.join(test.root, 'source-link'));
      const linked = await test.runtime.workspace.fingerprint('example');
      await fs.unlink(path.join(test.root, 'source-link'));
      await fs.symlink('untracked.txt', path.join(test.root, 'source-link'));
      expect(await test.runtime.workspace.fingerprint('example')).not.toBe(linked);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('invalidates evidence, environment and source membership changes while retaining receipt storage isolation', async () => {
    const test = await fixture();
    try {
      const input = { track: 'example', command: [process.execPath, '-e', 'process.exit(0)'], captureOutput: true };
      await runTrackVerification(test.runtime, input);
      expect((await runTrackVerification(test.runtime, input)).reused).toBe(true);
      await fs.mkdir(path.join(test.root, directory, 'analysis'));
      for (const relative of [directory + '/analysis/findings.md', directory + '/reports/semantic.md', 'new-source.ts', 'codument/config/operation-hooks.xnl']) {
        await fs.mkdir(path.dirname(path.join(test.root, relative)), { recursive: true });
        await fs.writeFile(path.join(test.root, relative), 'new authority or evidence');
        expect((await runTrackVerification(test.runtime, input)).reused).toBe(false);
        expect((await runTrackVerification(test.runtime, input)).reused).toBe(true);
        const withSource = await test.runtime.workspace.fingerprint('example');
        await fs.unlink(path.join(test.root, relative));
        expect(await test.runtime.workspace.fingerprint('example')).not.toBe(withSource);
      }
      const changedEnv = createFileVerificationRuntime({ workspaceRoot: test.root, env: { ...env, CODUMENT_TEST_POLICY: 'changed' } }, test.bindings);
      expect((await runTrackVerification(changedEnv, input)).reused).toBe(false);
      const raw = createFileVerificationRuntime({ workspaceRoot: test.root, env }, { ...test.bindings, projectTrackContract: undefined });
      const before = await raw.workspace.fingerprint('example');
      await fs.writeFile(path.join(test.root, file), '<Track #example {gap_round=10}>');
      expect(await raw.workspace.fingerprint('example')).not.toBe(before);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('uses Git tracked and untracked/nonignored files, including missing tracked paths', async () => {
    const test = await fixture();
    async function git(args: string[]) {
      const child = Bun.spawn(['git', ...args], { cwd: test.root, env, stdout: 'pipe', stderr: 'pipe' });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      if (code !== 0) throw new Error(stdout + stderr);
    }
    try {
      await git(['init', '--quiet']);
      await fs.writeFile(path.join(test.root, '.gitignore'), 'ignored.txt\n');
      await git(['add', 'source.txt', '.gitignore']);
      const before = await test.runtime.workspace.fingerprint('example');
      await fs.writeFile(path.join(test.root, 'ignored.txt'), 'ignored');
      expect(await test.runtime.workspace.fingerprint('example')).toBe(before);
      await fs.writeFile(path.join(test.root, 'source.txt'), 'tracked-dirty');
      const tracked = await test.runtime.workspace.fingerprint('example');
      expect(tracked).not.toBe(before);
      await fs.writeFile(path.join(test.root, 'new.txt'), 'untracked');
      const untracked = await test.runtime.workspace.fingerprint('example');
      expect(untracked).not.toBe(tracked);
      await fs.unlink(path.join(test.root, 'source.txt'));
      expect(await test.runtime.workspace.fingerprint('example')).not.toBe(untracked);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });
});
