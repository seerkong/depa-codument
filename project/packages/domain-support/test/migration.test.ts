import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { applyResourceMigration, planResourceMigration, readAttractorProfileNames } from 'depa-codument-domain-logic';
import { createFileResourceMigrationPort } from '../src/migration';

const file = 'codument/config/attractor-profiles.xnl';
const original = '<!-- user policy -->\n<AttractorProfiles #profiles apiVersion="codument.tech/v1alpha1" version="1" (<Profiles [<Profile #depa {enabled=true}>]>)>\n';
async function fixture(run: (root: string) => Promise<void>): Promise<void> {
  const directory = await fs.mkdtemp(join(tmpdir(), 'codument-migration-port-'));
  const root = await fs.realpath(directory);
  try {
    await fs.mkdir(join(root, dirname(file)), {recursive: true});
    await fs.writeFile(join(root, file), original, {mode: 0o640});
    await fs.writeFile(join(root, 'codument/user.txt'), 'independent business material');
    await run(root);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
}
const plan = () => planResourceMigration({path: file, source: original});
const validate = async (root: string) => {
  try { readAttractorProfileNames(await fs.readFile(join(root, file), 'utf8')); return []; }
  catch (cause) { return [{severity: 'error' as const, message: String(cause)}]; }
};

describe('migration backup, guarded publication and recovery', () => {
  test('boots without a SkillApp, validates before write, preserves backup/mode and repeats without resource writes', () => fixture(async root => {
    const files = createFileResourceMigrationPort(root);
    const result = await applyResourceMigration({files, validate: async (candidate, plan) => {
      expect(await fs.readFile(join(root, file), 'utf8')).toBe(original);
      expect(plan.targetKind).toBe('AttractorProfiles');
      expect(candidate).not.toBe(root);
      return validate(candidate);
    }}, plan());
    expect(result.status).toBe('applied');
    expect(await fs.readFile(result.backupPath!, 'utf8')).toBe(original);
    expect((await fs.stat(join(root, file))).mode & 0o777).toBe(0o640);
    const source = await fs.readFile(join(root, file), 'utf8'), before = await fs.stat(join(root, file));
    expect(readAttractorProfileNames(source)).toEqual(['depa']);
    const repeat = await applyResourceMigration({files, validate}, planResourceMigration({path: file, source}));
    expect(repeat.status).toBe('noop');
    expect((await fs.stat(join(root, file))).ino).toBe(before.ino);
    expect(await fs.readFile(join(root, file), 'utf8')).toBe(source);
    expect(await fs.readdir(dirname(result.backupPath!))).toEqual(expect.arrayContaining(['source.backup', 'plan.json', 'committed.json']));
    expect(await fs.stat(join(dirname(result.backupPath!), 'stage')).catch(() => undefined)).toBeUndefined();
  }));

  test('semantic failure returns review with exact backup and no business writes', () => fixture(async root => {
    const files = createFileResourceMigrationPort(root);
    const result = await applyResourceMigration({files, validate: async () => [{severity: 'error', message: 'cross-resource reference missing'}]}, plan());
    expect(result.status).toBe('review-required');
    expect(result.diagnostics).toContain('cross-resource reference missing');
    expect(await fs.readFile(join(root, file), 'utf8')).toBe(original);
    expect(await fs.readFile(result.backupPath!, 'utf8')).toBe(original);
    const input = 'codument/decision.md';
    await fs.writeFile(join(root, input), '# keep human decision');
    const review = await applyResourceMigration({files, validate: async () => { throw new Error('review must not be admitted'); }}, planResourceMigration({path: input, source: '# keep human decision'}));
    expect(review.status).toBe('review-required');
    expect(await fs.readFile(review.backupPath!, 'utf8')).toBe('# keep human decision');
  }));

  test('rejects stale/forged plans before backup and rejects context drift before publication', () => fixture(async root => {
    const files = createFileResourceMigrationPort(root);
    await expect(applyResourceMigration({files, validate}, {...plan(), proposal: {source: '<Track #evil>'}})).rejects.toThrow('altered');
    await expect(applyResourceMigration({files, validate: async () => {
      await fs.writeFile(join(root, 'codument/user.txt'), 'concurrent edit'); return [];
    }}, plan())).rejects.toThrow('context drift');
    expect(await fs.readFile(join(root, file), 'utf8')).toBe(original);
    expect(await fs.readFile(join(root, 'codument/user.txt'), 'utf8')).toBe('concurrent edit');
  }));

  test('refuses symlink escape and competing cooperative writers', () => fixture(async root => {
    const files = createFileResourceMigrationPort(root);
    await fs.symlink(join(root, file), join(root, 'codument/alias.xnl'));
    await expect(files.read('codument/alias.xnl')).rejects.toThrow('Unsafe');
    await fs.unlink(join(root, 'codument/alias.xnl'));
    const prepared = await files.prepare(await files.read(file), plan());
    await expect(files.prepare(await files.read(file), plan())).rejects.toThrow();
    await prepared.abort(); await prepared.abort();
    expect(await fs.readFile(join(root, file), 'utf8')).toBe(original);
  }));

  test('detects staged additions and retains independent content for recovery', () => fixture(async root => {
    const files = createFileResourceMigrationPort(root);
    let candidate = '';
    await expect(applyResourceMigration({files, validate: async stage => {
      candidate = stage;
      await fs.writeFile(join(stage, 'codument/unobserved.txt'), 'independent staging change'); return [];
    }}, plan())).rejects.toThrow('recovery');
    expect(await fs.readFile(join(root, file), 'utf8')).toBe(original);
    expect(await fs.readFile(join(candidate, 'codument/unobserved.txt'), 'utf8')).toBe('independent staging change');
  }));

  test('recovers rename-then-throw, but never overwrites an independent post-publication edit', () => fixture(async root => {
    let fail = true;
    const files = createFileResourceMigrationPort(root, {...fs, rename: async (from, to) => {
      await fs.rename(from, to);
      if (fail && to === join(root, file)) {fail = false; throw new Error('after publication');}
    }});
    await expect(applyResourceMigration({files, validate}, plan())).rejects.toThrow('after publication');
    expect(await fs.readFile(join(root, file), 'utf8')).toBe(original);
    const edited = createFileResourceMigrationPort(root, {...fs, rename: async (from, to) => {
      await fs.rename(from, to);
      if (to === join(root, file)) {await fs.writeFile(to, 'independent post-publication edit'); throw new Error('after independent edit');}
    }});
    await expect(applyResourceMigration({files: edited, validate}, plan())).rejects.toThrow('recovery');
    expect(await fs.readFile(join(root, file), 'utf8')).toBe('independent post-publication edit');
  }));

  test('retires an empty forest only after validation, retains bytes outside the App', () => fixture(async root => {
    const input = {path: 'codument/decisions.xnl', source: '<!-- historical explanation -->\n'};
    await fs.writeFile(join(root, input.path), input.source);
    const result = await applyResourceMigration({files: createFileResourceMigrationPort(root), validate: async () => []}, planResourceMigration(input));
    expect(result.status).toBe('removed');
    expect(await fs.stat(join(root, input.path)).catch(() => undefined)).toBeUndefined();
    expect(await fs.readFile(result.backupPath!, 'utf8')).toBe(input.source);
    expect(await fs.readFile(join(dirname(result.backupPath!), 'retired-source'), 'utf8')).toBe(input.source);
  }));

  test('XML publication retires the old authority, rejects target conflicts, and rolls back an interrupted relocation', () => fixture(async root => {
    const input = {path: 'codument/config/attractor-profiles.xml', source: '<AttractorProfiles><Profile name="depa" enabled="true"/></AttractorProfiles>'};
    await fs.writeFile(join(root, input.path), input.source);
    const files = createFileResourceMigrationPort(root), proposed = planResourceMigration(input);
    const conflict = await applyResourceMigration({files, validate}, proposed);
    expect(conflict.status).toBe('review-required');
    expect(await fs.readFile(join(root, input.path), 'utf8')).toBe(input.source);
    await fs.unlink(join(root, file));
    let fail = true;
    const failure = createFileResourceMigrationPort(root, {...fs, rename: async (from, to) => {
      await fs.rename(from, to);
      if (fail && from === join(root, input.path)) {fail = false; throw new Error('after retirement');}
    }});
    await expect(applyResourceMigration({files: failure, validate}, proposed)).rejects.toThrow('after retirement');
    expect(await fs.readFile(join(root, input.path), 'utf8')).toBe(input.source);
    expect(await fs.stat(join(root, file)).catch(() => undefined)).toBeUndefined();
    const result = await applyResourceMigration({files, validate}, proposed);
    expect(result.status).toBe('applied');
    expect(await fs.stat(join(root, input.path)).catch(() => undefined)).toBeUndefined();
    expect(await fs.readFile(result.backupPath!, 'utf8')).toBe(input.source);
    expect(readAttractorProfileNames(await fs.readFile(join(root, file), 'utf8'))).toEqual(['depa']);
  }));
});
