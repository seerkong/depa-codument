import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { lifecycleSourceCodec, proposeScaffold } from 'depa-codument-domain-logic';
import { createFileScaffoldSourcePort } from '../src';
const at = '2026-09-06T12:00:00Z';
const request = { kind: 'Track' as const, id: 'example', stage: 'pending' as const };
it('publishes complete resource closures, refuses occupied/foreign targets and serializes competing creators', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-scaffold-store-'));
  try {
    const port = createFileScaffoldSourcePort(root, lifecycleSourceCodec);
    await expect(port.observe(request)).rejects.toThrow('not initialized');
    await fs.mkdir(path.join(root, 'codument'));
    const first = await port.observe(request), second = await port.observe(request);
    await expect(port.publish({ ...first }, proposeScaffold(first, at))).rejects.toThrow('Unknown');
    await expect(port.publish(first, { '../escape': 'bad' })).rejects.toThrow('closure');
    const attempts = await Promise.allSettled([port.publish(first, proposeScaffold(first, at)), port.publish(second, proposeScaffold(second, at))]);
    expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1);
    const directory = path.join(root, first.directory);
    expect((await fs.stat(directory)).mode & 0o777).toBe(0o777 & ~process.umask());
    expect((await fs.readdir(directory)).sort()).toEqual(['design.md', 'proposal.md', 'track.xnl']);
    expect(await fs.readFile(path.join(directory, 'track.xnl'), 'utf8')).toContain('specVersion=1');
    await expect(port.observe(request)).rejects.toThrow('already exists');
    expect(await fs.readdir(path.dirname(directory))).toEqual(['example']);
    expect(await fs.readdir(path.join(root, 'codument'))).toEqual(['tracks']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
it('failed directory publication cleans only owned staging/reservation and permits a fresh retry', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-scaffold-fault-'));
  try {
    await fs.mkdir(path.join(root, 'codument'));
    const port = createFileScaffoldSourcePort(root, lifecycleSourceCodec, { async rename() { throw new Error('injected publication failure'); } });
    const source = await port.observe(request);
    await expect(port.publish(source, proposeScaffold(source, at))).rejects.toThrow('injected');
    expect(await fs.readdir(path.join(root, 'codument/tracks/pending'))).toEqual([]);
    expect(await fs.readdir(path.join(root, 'codument'))).toEqual(['tracks']);
    const next = createFileScaffoldSourcePort(root, lifecycleSourceCodec);
    const retry = await next.observe(request);
    await next.publish(retry, proposeScaffold(retry, at));
    expect(await fs.readFile(path.join(root, retry.directory, 'proposal.md'), 'utf8')).toBe('# Track: example\n');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
it('patch creation retains existing companion files and rejects changed, ambiguous or symlinked ownership', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-patch-store-'));
  try {
    await fs.mkdir(path.join(root, 'codument'));
    const port = createFileScaffoldSourcePort(root, lifecycleSourceCodec);
    const track = await port.observe(request);
    await port.publish(track, proposeScaffold(track, at));
    const patchRequest = { kind: 'BehaviorPatch' as const, id: 'example', capability: 'auth.login' };
    const stale = await port.observe(patchRequest);
    const file = path.join(root, track.directory, 'track.xnl');
    await fs.appendFile(file, '<!-- external edit -->');
    await expect(port.publish(stale, proposeScaffold(stale, at))).rejects.toThrow('source changed');
    const patch = await port.observe(patchRequest);
    await fs.mkdir(path.join(root, patch.directory), { recursive: true });
    await fs.writeFile(path.join(root, patch.directory, 'notes.md'), 'authored notes');
    await port.publish(patch, proposeScaffold(patch, at));
    expect(await fs.readFile(path.join(root, patch.directory, 'notes.md'), 'utf8')).toBe('authored notes');
    expect((await fs.readdir(path.join(root, patch.directory))).sort()).toEqual(['delta.xnl', 'notes.md']);
    await expect(port.observe(patchRequest)).rejects.toThrow('already exists');
    await fs.mkdir(path.join(root, 'codument/tracks/active/example'), { recursive: true });
    await expect(port.observe({ ...patchRequest, capability: 'other' })).rejects.toThrow('2 eligible');
    await fs.symlink(path.join(root, track.directory), path.join(root, 'codument/tracks/pending/alias'));
    await expect(port.observe({ ...request, id: 'alias' })).rejects.toThrow('symlink');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
