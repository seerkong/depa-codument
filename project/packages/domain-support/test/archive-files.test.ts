import {afterEach, expect, it} from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {tmpdir} from 'node:os';
import {commitArchiveFiles, observeArchiveFiles, type ArchiveFileEffects} from '../src/archive-files';

const roots: string[] = [];
afterEach(async () => {for (const root of roots.splice(0)) await fs.rm(root, {recursive: true, force: true});});
const native: ArchiveFileEffects = {async publish(stage, target, replace) {if (replace) await fs.rename(stage, target); else await fs.link(stage, target);}, async restore(backup, target) {await fs.rename(backup, target);}, async move(from, to) {await fs.rename(from, to);}};
async function fixture() {
  const workspaceRoot = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'codument-archive-files-'))); roots.push(workspaceRoot);
  const source = path.join(workspaceRoot, 'codument/tracks/active/work'), destination = path.join(workspaceRoot, 'codument/tracks/archived/2026-09/day-work');
  const decisions = path.join(workspaceRoot, 'codument/decisions'), memory = path.join(workspaceRoot, 'codument/memory');
  await fs.mkdir(source, {recursive: true}); await fs.mkdir(decisions, {recursive: true});
  await fs.mkdir(path.join(source, 'empty'), {mode: 0o750});
  await fs.writeFile(path.join(source, 'track.xnl'), 'original root'); await fs.chmod(path.join(source, 'track.xnl'), 0o640);
  await fs.writeFile(path.join(source, 'binary.bin'), new Uint8Array([0, 255, 17, 0]));
  await fs.writeFile(path.join(decisions, 'topic.xnl'), 'original decision');
  const observed = await observeArchiveFiles([source, destination, decisions, memory]);
  const changes = new Map([[path.join(source, 'track.xnl'), 'proposed root'], [path.join(source, 'summary.md'), 'summary'], [path.join(decisions, 'topic.xnl'), 'promoted decision'], [path.join(memory, 'lessons/item.md'), 'promoted memory']]);
  return {workspaceRoot, source, destination, decisions, memory, observed, changes, move: {source, destination}, lock: path.join(workspaceRoot, 'codument/.lifecycle-write.lock')};
}
async function absent(file: string) {try {await fs.lstat(file); return false;} catch (error) {if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; throw error;}}
it('publishes all registries and moves the complete process, retaining binary files, empty directories and modes', async () => {
  const input = await fixture();
  expect(await commitArchiveFiles(input)).toEqual({});
  expect(await absent(input.source)).toBe(true);
  expect(await fs.readFile(path.join(input.destination, 'track.xnl'), 'utf8')).toBe('proposed root');
  expect((await fs.stat(path.join(input.destination, 'track.xnl'))).mode & 0o777).toBe(0o640);
  expect((await fs.stat(path.join(input.destination, 'empty'))).mode & 0o777).toBe(0o750);
  expect([...await fs.readFile(path.join(input.destination, 'binary.bin'))]).toEqual([0, 255, 17, 0]);
  expect(await fs.readFile(path.join(input.decisions, 'topic.xnl'), 'utf8')).toBe('promoted decision');
  expect(await fs.readFile(path.join(input.memory, 'lessons/item.md'), 'utf8')).toBe('promoted memory');
  expect(await absent(input.lock)).toBe(true);
  expect(await fs.readdir(input.decisions)).toEqual(['topic.xnl']);
});
it('rejects stale bytes, empty directory changes, symlinks and occupied destinations before writing', async () => {
  for (const change of ['bytes', 'directory', 'destination', 'symlink']) {
    const input = await fixture();
    if (change === 'bytes') await fs.writeFile(path.join(input.source, 'binary.bin'), 'independent');
    if (change === 'directory') await fs.mkdir(path.join(input.source, 'new-empty'));
    if (change === 'destination') await fs.mkdir(input.destination, {recursive: true});
    if (change === 'symlink') await fs.symlink(input.decisions, path.join(input.source, 'alias'));
    await expect(commitArchiveFiles(input)).rejects.toThrow();
    expect(await fs.readFile(path.join(input.decisions, 'topic.xnl'), 'utf8')).toBe('original decision');
    expect(await fs.readFile(path.join(input.source, 'track.xnl'), 'utf8')).toBe('original root');
    expect(await absent(input.lock)).toBe(true);
  }
});
it('restores every attempted file on write-then-throw, with no leaked derived summary or memory', async () => {
  const input = await fixture(); let calls = 0;
  await expect(commitArchiveFiles(input, {...native, async publish(stage, target, replace) {await native.publish(stage, target, replace); if (++calls === 4) throw new Error('after last write');}})).rejects.toThrow('after last write');
  expect(await fs.readFile(path.join(input.source, 'track.xnl'), 'utf8')).toBe('original root');
  expect((await fs.stat(path.join(input.source, 'track.xnl'))).mode & 0o777).toBe(0o640);
  expect(await fs.readFile(path.join(input.decisions, 'topic.xnl'), 'utf8')).toBe('original decision');
  expect(await absent(path.join(input.source, 'summary.md'))).toBe(true);
  expect(await absent(input.memory)).toBe(true);
  expect(await absent(input.destination)).toBe(true);
  expect(await absent(input.lock)).toBe(true);
});
it('detects move-then-throw and restores the process plus all registry changes', async () => {
  const input = await fixture(); let calls = 0;
  await expect(commitArchiveFiles(input, {...native, async move(from, to) {await native.move(from, to); if (++calls === 1) throw new Error('after move');}})).rejects.toThrow('after move');
  expect(calls).toBe(2);
  expect(await fs.readFile(path.join(input.source, 'track.xnl'), 'utf8')).toBe('original root');
  expect(await fs.readFile(path.join(input.decisions, 'topic.xnl'), 'utf8')).toBe('original decision');
  expect(await absent(input.destination)).toBe(true);
  expect(await absent(input.lock)).toBe(true);
});
it('retains backups instead of overwriting an independent edit during rollback', async () => {
  const input = await fixture(); let calls = 0;
  await expect(commitArchiveFiles(input, {...native, async publish(stage, target, replace) {
    await native.publish(stage, target, replace);
    if (++calls === 3) {await fs.writeFile(path.join(input.source, 'track.xnl'), 'independent author'); throw new Error('interrupted');}
  }})).rejects.toThrow('recovery required');
  expect(await fs.readFile(path.join(input.source, 'track.xnl'), 'utf8')).toBe('independent author');
  expect(await fs.readFile(path.join(input.decisions, 'topic.xnl'), 'utf8')).toBe('original decision');
  expect(await fs.readFile(path.join(input.lock, 'backup-0'), 'utf8')).toBe('original root');
  expect(JSON.parse(await fs.readFile(path.join(input.lock, 'recovery.json'), 'utf8')).move).toEqual(input.move);
  expect(await absent(path.join(input.decisions, '.topic.xnl.write-lock'))).toBe(true);
});
it('preserves foreign additions after a move, retaining recovery state instead of moving an independently changed tree', async () => {
  const input = await fixture();
  await expect(commitArchiveFiles(input, {...native, async move(from, to) {await native.move(from, to); await fs.writeFile(path.join(to, 'independent.md'), 'keep this');}})).rejects.toThrow('recovery required');
  expect(await fs.readFile(path.join(input.destination, 'independent.md'), 'utf8')).toBe('keep this');
  expect(await fs.readFile(path.join(input.destination, 'track.xnl'), 'utf8')).toBe('original root');
  expect(await fs.readFile(path.join(input.decisions, 'topic.xnl'), 'utf8')).toBe('original decision');
  expect(await absent(path.join(input.lock, 'recovery.json'))).toBe(false);
});
it('never steals a cooperating writer lock or recursively removes its contents', async () => {
  const input = await fixture();
  const lock = path.join(input.decisions, '.topic.xnl.write-lock');
  await fs.mkdir(lock); await fs.writeFile(path.join(lock, 'foreign'), 'keep');
  await expect(commitArchiveFiles(input)).rejects.toThrow();
  expect(await fs.readFile(path.join(lock, 'foreign'), 'utf8')).toBe('keep');
  expect(await fs.readFile(path.join(input.source, 'track.xnl'), 'utf8')).toBe('original root');
  expect(await absent(input.lock)).toBe(true);
});
it('reports successful publication separately from foreign recovery-folder contents and never deletes them', async () => {
  const input = await fixture();
  const result = await commitArchiveFiles(input, {...native, async move(from, to) {await native.move(from, to); await fs.writeFile(path.join(input.lock, 'foreign-note'), 'keep');}});
  expect(result.maintenanceWarnings?.[0]).toContain('recovery contents changed');
  expect(await fs.readFile(path.join(input.lock, 'foreign-note'), 'utf8')).toBe('keep');
  expect(await fs.readFile(path.join(input.destination, 'track.xnl'), 'utf8')).toBe('proposed root');
  expect(await absent(path.join(input.lock, 'recovery.json'))).toBe(false);
});
