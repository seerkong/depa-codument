import { expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyWorkspaceMigration, planWorkspaceResourceMigration } from 'depa-codument-domain-logic';
import type { WorkspaceMigrationSnapshot } from 'depa-codument-domain-contract';
import { createFileWorkspaceMigrationPort } from '../src/workspace-migration';
import { createFileResourceMigrationPort } from '../src/migration';

const path = 'codument/config/attractor-profiles.xml';
const original = '<AttractorProfiles><Profile name="depa" enabled="true"/></AttractorProfiles>';
const planner = (snapshot: WorkspaceMigrationSnapshot) => planWorkspaceResourceMigration(snapshot, snapshot.files.filter(file => /\.(?:xnl|xml)$/u.test(file.path)).map(file => file.path));
async function fixture(run: (root: string) => Promise<void>) {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'codument-app-migration-')));
  try {
    await fs.mkdir(join(root, 'codument/config'), {recursive: true});
    await fs.writeFile(join(root, path), original, {mode: 0o640});
    await fs.writeFile(join(root, 'codument/opaque.bin'), Buffer.from([0xff, 0xfe, 0, 32]), {mode: 0o750});
    await run(root);
  } finally {await fs.rm(root, {recursive: true, force: true});}
}

test('App migration validates the entire candidate before publication, preserves opaque bytes, modes and exact old backup, repeats without rewriting App', () => fixture(async root => {
  const files = createFileWorkspaceMigrationPort(root), before = await files.observe();
  const runtime = {files, plan: planner, validate: async (candidate: string) => {
    expect(candidate).not.toBe(root);
    expect(await fs.readFile(join(root, path), 'utf8')).toBe(original);
    expect(await fs.readFile(join(candidate, 'codument/config/attractor-profiles.xnl'), 'utf8')).toContain('envelopeVersion');
    expect(await fs.stat(join(candidate, path)).catch(() => undefined)).toBeUndefined();
    return [];
  }};
  const result = await applyWorkspaceMigration(runtime, planner(before));
  expect(result.status).toBe('applied');
  expect(await fs.readFile(join(result.backupPath!, 'config/attractor-profiles.xml'), 'utf8')).toBe(original);
  expect(await fs.readFile(join(root, 'codument/opaque.bin'))).toEqual(Buffer.from([0xff, 0xfe, 0, 32]));
  expect((await fs.stat(join(root, 'codument/opaque.bin'))).mode & 0o777).toBe(0o750);
  expect((await fs.stat(join(root, 'codument/config/attractor-profiles.xnl'))).mode & 0o777).toBe(0o640);
  const inode = (await fs.stat(join(root, 'codument'))).ino;
  const repeat = await applyWorkspaceMigration({...runtime, validate: async () => []}, planner(await files.observe()));
  expect(repeat.status).toBe('noop');
  expect((await fs.stat(join(root, 'codument'))).ino).toBe(inode);
}));

test('App migration refuses stale plans, source drift, candidate drift and independent writers without changing business authority', () => fixture(async root => {
  const files = createFileWorkspaceMigrationPort(root), plan = planner(await files.observe());
  await expect(applyWorkspaceMigration({files, plan: planner, validate: async () => []}, {...plan, changes: []})).rejects.toThrow('altered');
  for (const where of ['source', 'candidate']) {
    await expect(applyWorkspaceMigration({files, plan: planner, validate: async candidate => {
      await fs.writeFile(join(where === 'source' ? root : candidate, `codument/${where}-new.txt`), 'independent'); return [];
    }}, planner(await files.observe()))).rejects.toThrow('drift');
    expect(await fs.readFile(join(root, path), 'utf8')).toBe(original);
  }
  const prepared = await files.prepare(await files.observe(), planner(await files.observe()));
  await expect(files.observe()).rejects.toThrow('locked');
  await expect(createFileResourceMigrationPort(root).read(path)).rejects.toThrow('locked');
  await prepared.abort(); await prepared.abort();
  await fs.mkdir(join(root, 'codument/config/.attractor-profiles.xml.write-lock'));
  await expect(files.observe()).rejects.toThrow('active resource writer');
}));

test('validation failure and unknown input retain an exact backup and return review instead of partial upgrades', () => fixture(async root => {
  const files = createFileWorkspaceMigrationPort(root);
  const failed = await applyWorkspaceMigration({files, plan: planner, validate: async () => [{severity: 'error', message: 'dangling Track reference'}]}, planner(await files.observe()));
  expect(failed.status).toBe('review-required');
  expect(await fs.readFile(join(root, path), 'utf8')).toBe(original);
  expect(await fs.readFile(join(failed.backupPath!, 'config/attractor-profiles.xml'), 'utf8')).toBe(original);
  await fs.writeFile(join(root, 'codument/unknown.xnl'), '<Unknown #owner>');
  const review = await applyWorkspaceMigration({files, plan: planner, validate: async () => {throw new Error('must not validate unknown plan');}}, planner(await files.observe()));
  expect(review.status).toBe('review-required');
  expect(await fs.readFile(join(root, path), 'utf8')).toBe(original);
}));

test('failure after each App rename restores the original complete directory, including its inode', async () => {
  for (const phase of ['retire', 'publish']) await fixture(async root => {
    const inode = (await fs.stat(join(root, 'codument'))).ino;
    let fail = true;
    const files = createFileWorkspaceMigrationPort(root, {...fs, rename: async (from, to) => {
      await fs.rename(from, to);
      if (fail && (phase === 'retire' ? from === join(root, 'codument') : to === join(root, 'codument'))) {
        fail = false; throw new Error('injected after ' + phase);
      }
    }});
    await expect(applyWorkspaceMigration({files, plan: planner, validate: async () => []}, planner(await files.observe()))).rejects.toThrow('injected');
    expect(await fs.readFile(join(root, path), 'utf8')).toBe(original);
    expect((await fs.stat(join(root, 'codument'))).ino).toBe(inode);
    expect(await fs.stat(join(root, '.codument-migration.lock')).catch(() => undefined)).toBeUndefined();
  });
});

test('independent edit after publication is not rolled back over; originals remain in recovery material', () => fixture(async root => {
  const files = createFileWorkspaceMigrationPort(root, {...fs, rename: async (from, to) => {
    await fs.rename(from, to);
    if (to === join(root, 'codument')) {await fs.writeFile(join(to, 'independent.txt'), 'preserve me'); throw new Error('external editor');}
  }});
  await expect(applyWorkspaceMigration({files, plan: planner, validate: async () => []}, planner(await files.observe()))).rejects.toThrow('recovery');
  expect(await fs.readFile(join(root, 'codument/independent.txt'), 'utf8')).toBe('preserve me');
  const [receipt] = await fs.readdir(join(root, '.codument/workspace-migrations'));
  expect(await fs.readFile(join(root, '.codument/workspace-migrations', receipt!, 'retired-codument/config/attractor-profiles.xml'), 'utf8')).toBe(original);
}));

test('rejects symlink sources and colliding migration targets without overwriting either', () => fixture(async root => {
  const files = createFileWorkspaceMigrationPort(root);
  await fs.symlink(join(root, path), join(root, 'codument/alias'));
  await expect(files.observe()).rejects.toThrow('Unsafe');
  await fs.unlink(join(root, 'codument/alias'));
  await fs.writeFile(join(root, 'codument/config/attractor-profiles.xnl'), '<AttractorProfiles #different>');
  const plan = planner(await files.observe());
  expect(plan.status).toBe('review-required');
  expect(plan.diagnostics.join('\n')).toContain('conflicts');
}));

test('Finder retirement exception does not authorize hidden writes or hidden ancestor traversal', () => fixture(async root => {
  const files = createFileWorkspaceMigrationPort(root);
  for (const change of [
    { path: 'codument/std/.DS_Store', source: 'new contents' },
    { path: 'codument/std/.secret', source: null },
    { path: 'codument/std/.private/.DS_Store', source: null },
    { path: 'codument/config/.DS_Store', source: null },
  ]) {
    const snapshot = await files.observe();
    await expect(files.prepare(snapshot, { ...planner(snapshot), changes: [change] })).rejects.toThrow('Unsafe');
    expect(await fs.readFile(join(root, path), 'utf8')).toBe(original);
  }
}));
