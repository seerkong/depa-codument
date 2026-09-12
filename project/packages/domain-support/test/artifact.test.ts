import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createFileArtifactSyncPort, type ArtifactFileEffects } from '../src';
import { syncArtifacts } from 'depa-codument-domain-logic';
const request = {source: 'source', target: 'target', force: true};
const normal: ArtifactFileEffects = {async publish(stage, target, replace) {if (replace) await fs.rename(stage, target); else await fs.link(stage, target);}, async restore(backup, target) {await fs.rename(backup, target);}};
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-artifact-port-'));
  const write = async (file: string, content: string | Uint8Array) => {await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true}); await fs.writeFile(path.join(root, file), content);};
  await write('source/a.bin', new Uint8Array([0, 255, 128])); await write('source/nested/b.md', 'new');
  await write('target/a.bin', 'old'); await write('target/extra', 'keep');
  return {root, write};
}
it('delivers binary files, preserves unrelated files and existing modes; dry-run/conflict are entirely read-only', async () => {
  const {root} = await fixture(), port = createFileArtifactSyncPort(root);
  try {
    await fs.chmod(path.join(root, 'target/a.bin'), 0o640);
    const files = (await fs.readdir(root, {recursive: true})).sort();
    expect((await syncArtifacts(port, {...request, dryRun: true})).status).toBe('dry-run');
    expect((await syncArtifacts(port, {...request, force: false})).status).toBe('conflict');
    expect((await fs.readdir(root, {recursive: true})).sort()).toEqual(files);
    expect(await fs.readFile(path.join(root, 'target/a.bin'), 'utf8')).toBe('old');
    const result = await syncArtifacts(port, request);
    expect(result.status).toBe('synced'); expect(result.changes).toEqual([{path: 'a.bin', status: 'update'}, {path: 'nested/b.md', status: 'create'}]);
    expect(new Uint8Array(await fs.readFile(path.join(root, 'target/a.bin')))).toEqual(new Uint8Array([0, 255, 128]));
    expect((await fs.stat(path.join(root, 'target/a.bin'))).mode & 0o777).toBe(0o640);
    expect(await fs.readFile(path.join(root, 'target/extra'), 'utf8')).toBe('keep');
    expect((await syncArtifacts(port, request)).changes.every(change => change.status === 'unchanged')).toBe(true);
    expect((await fs.readdir(root)).sort()).toEqual(['source', 'target']);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('rejects forged/reused handles, source membership changes and target drift without touching target bytes', async () => {
  const {root, write} = await fixture(), port = createFileArtifactSyncPort(root);
  try {
    const observed = await port.observe(request);
    await expect(port.publish({...observed})).rejects.toThrow('Unknown');
    await write('source/added', 'new source');
    await expect(port.publish(observed)).rejects.toThrow('changed');
    const next = await port.observe(request);
    await write('target/a.bin', 'independent');
    await expect(port.publish(next)).rejects.toThrow('changed');
    expect(await fs.readFile(path.join(root, 'target/a.bin'), 'utf8')).toBe('independent');
    const final = await port.observe(request); await port.publish(final);
    await expect(port.publish(final)).rejects.toThrow('Unknown');
    expect(await fs.exists(path.join(root, '.target.codument-artifact-sync.lock'))).toBe(false);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('rolls back earlier writes when a later publication fails, including a failure after the physical write', async () => {
  for (const afterWrite of [false, true]) {
    const {root} = await fixture(); let calls = 0;
    const port = createFileArtifactSyncPort(root, {...normal, async publish(stage, target, replace) {
      calls++; if (calls === 2 && !afterWrite) throw new Error('injected publish failure');
      await normal.publish(stage, target, replace); if (calls === 2) throw new Error('injected post-write failure');
    }});
    try {
      await expect(syncArtifacts(port, request)).rejects.toThrow('injected');
      expect(await fs.readFile(path.join(root, 'target/a.bin'), 'utf8')).toBe('old');
      expect(await fs.readFile(path.join(root, 'target/extra'), 'utf8')).toBe('keep');
      expect(await fs.exists(path.join(root, 'target/nested'))).toBe(false);
      expect(await fs.exists(path.join(root, '.target.codument-artifact-sync.lock'))).toBe(false);
    } finally {await fs.rm(root, {recursive: true, force: true});}
  }
});
it('preserves backups and the third-party edit when rollback cannot safely restore the target', async () => {
  const {root, write} = await fixture(); let calls = 0;
  const port = createFileArtifactSyncPort(root, {...normal, async publish(stage, target, replace) {
    if (++calls === 2) {await write('target/a.bin', 'new independent authority'); throw new Error('injected failure');}
    await normal.publish(stage, target, replace);
  }});
  try {
    await expect(syncArtifacts(port, request)).rejects.toThrow('recovery required');
    expect(await fs.readFile(path.join(root, 'target/a.bin'), 'utf8')).toBe('new independent authority');
    const lock = path.join(root, '.target.codument-artifact-sync.lock');
    expect(await fs.readFile(path.join(lock, 'backup-0'), 'utf8')).toBe('old');
    const journal = JSON.parse(await fs.readFile(path.join(lock, 'recovery.json'), 'utf8'));
    expect(journal.target).toBe(path.join(root, 'target')); expect(journal.entries[0].backup).toBe('backup-0');
    await expect(syncArtifacts(createFileArtifactSyncPort(root), request)).rejects.toThrow();
    expect(await fs.readFile(path.join(lock, 'backup-0'), 'utf8')).toBe('old');
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('refuses overlap, symlinks, special files and directory conflicts even with force', async () => {
  const {root, write} = await fixture(), port = createFileArtifactSyncPort(root);
  try {
    for (const target of ['source', 'source/inside', '.']) await expect(port.observe({source: 'source', target})).rejects.toThrow('overlap');
    await fs.symlink(path.join(root, 'source'), path.join(root, 'alias'));
    await expect(port.observe({source: 'alias', target: 'target'})).rejects.toThrow('symlink');
    await fs.symlink(path.join(root, 'target/extra'), path.join(root, 'source/link'));
    await expect(port.observe(request)).rejects.toThrow('symlink'); await fs.unlink(path.join(root, 'source/link'));
    await fs.mkdir(path.join(root, 'target/nested/b.md'), {recursive: true});
    await expect(syncArtifacts(port, request)).rejects.toThrow('regular');
    await fs.rmdir(path.join(root, 'target/nested/b.md'));
    const fifo = path.join(root, 'source/pipe');
    expect(await Bun.spawn(['mkfifo', fifo], {stdout: 'pipe', stderr: 'pipe'}).exited).toBe(0);
    await expect(port.observe(request)).rejects.toThrow('regular'); await fs.unlink(fifo);
    await write('source/ok', 'safe');
    expect(await fs.readFile(path.join(root, 'target/a.bin'), 'utf8')).toBe('old');
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('an empty source does not create the destination or bookkeeping directories', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-artifact-empty-'));
  try {
    await fs.mkdir(path.join(root, 'empty'));
    expect(await syncArtifacts(createFileArtifactSyncPort(root), {source: 'empty', target: 'missing/deep'})).toMatchObject({status: 'synced', changes: []});
    expect(await fs.readdir(root)).toEqual(['empty']);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('does not mistake case-alias overlap for two independent filesystem trees', async () => {
  const {root} = await fixture(), port = createFileArtifactSyncPort(root);
  try {
    // On case-sensitive filesystems this is a different, absent path.
    if (await fs.exists(path.join(root, 'SOURCE'))) await expect(port.observe({source: 'source', target: 'SOURCE/nested-output'})).rejects.toThrow('overlap');
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('rechecks even a no-op snapshot, and catches source membership drift during delivery', async () => {
  const {root, write} = await fixture();
  try {
    await fs.mkdir(path.join(root, 'empty'));
    const port = createFileArtifactSyncPort(root), empty = await port.observe({source: 'empty', target: 'absent'});
    await write('empty/new', 'not empty now');
    await expect(port.publish(empty)).rejects.toThrow('changed');
    expect(await fs.exists(path.join(root, 'absent'))).toBe(false);
    const changing = createFileArtifactSyncPort(root, {...normal, async publish(stage, target, replace) {
      await normal.publish(stage, target, replace); await write('source/added-during-sync', 'independent source');
    }});
    await expect(syncArtifacts(changing, request)).rejects.toThrow('changed during delivery');
    expect(await fs.readFile(path.join(root, 'target/a.bin'), 'utf8')).toBe('old');
    expect(await fs.exists(path.join(root, 'target/nested'))).toBe(false);
    expect(await fs.readFile(path.join(root, 'source/added-during-sync'), 'utf8')).toBe('independent source');
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('retains recoverable originals when the restoration effect itself fails', async () => {
  const {root} = await fixture(); let calls = 0;
  const port = createFileArtifactSyncPort(root, {async publish(stage, target, replace) {
    if (++calls === 2) throw new Error('publish failed'); await normal.publish(stage, target, replace);
  }, async restore() {throw new Error('restore failed');}});
  try {
    await expect(syncArtifacts(port, request)).rejects.toThrow('recovery required');
    expect(await fs.readFile(path.join(root, '.target.codument-artifact-sync.lock/backup-0'), 'utf8')).toBe('old');
    expect(await fs.exists(path.join(root, '.target.codument-artifact-sync.lock/recovery.json'))).toBe(true);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('never recursively cleans a different directory substituted for its owned lock', async () => {
  const {root} = await fixture(); let calls = 0;
  const lock = path.join(root, '.target.codument-artifact-sync.lock');
  const port = createFileArtifactSyncPort(root, {...normal, async publish(stage, target, replace) {
    await normal.publish(stage, target, replace);
    if (++calls === 2) {
      await fs.rename(lock, lock + '.retained'); await fs.mkdir(lock);
      await fs.writeFile(path.join(lock, 'independent.txt'), 'preserve me');
    }
  }});
  try {
    const result = await syncArtifacts(port, request);
    expect(result.status).toBe('synced');
    expect(result.maintenanceWarnings?.join(' ')).toContain('lock');
    expect(await fs.readFile(path.join(lock, 'independent.txt'), 'utf8')).toBe('preserve me');
    expect(await fs.exists(lock + '.retained/backup-0')).toBe(true);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
