import { expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCodumentResourceMigrator } from '../src/migration';

async function fixture(run: (root: string, put: (file: string, value: string) => Promise<void>) => Promise<void>): Promise<void> {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'codument-migration-product-')));
  async function put(file: string, value: string) {await fs.mkdir(dirname(join(root, file)), {recursive: true}); await fs.writeFile(join(root, file), value);}
  try {await run(root, put);} finally {await fs.rm(root, {recursive: true, force: true});}
}

test('public migration boots without manifest or std and admits through the actual built-in compiler', () => fixture(async (root, put) => {
  const file = 'codument/config/attractor-profiles.xml';
  const source = '<AttractorProfiles><Profile name="depa" enabled="true"><Description>keep my policy</Description></Profile></AttractorProfiles>';
  await put(file, source);
  const migration = createCodumentResourceMigrator(root);
  expect((await migration.inspect(file)).format).toBe('xml');
  const plan = await migration.plan(file);
  expect(plan.status).toBe('planned');
  const result = await migration.apply(plan);
  expect(result.diagnostics).toEqual([]);
  expect(result.status).toBe('applied');
  expect(await fs.readFile(result.backupPath!, 'utf8')).toBe(source);
  expect((await migration.upgrade(result.targetPath!)).status).toBe('noop');
  const records = await fs.readdir(join(root, '.codument/migrations'));
  expect(await migration.verify(result.targetPath!)).toMatchObject({valid: true, diagnostics: []});
  expect(await fs.readdir(join(root, '.codument/migrations'))).toEqual(records);
  expect(await fs.stat(join(root, 'codument/manifest.xnl')).catch(() => undefined)).toBeUndefined();
  expect(await fs.stat(join(root, 'codument/KindDefinitions')).catch(() => undefined)).toBeUndefined();
}));

test('semantic and source-contract failures leave the old resource intact with review receipts', () => fixture(async (root, put) => {
  const lifecycle = 'codument/tracks/active/incomplete/track.xnl';
  const old = '<Track #incomplete apiVersion="codument.tech/v1alpha1" {status="new"}>';
  await put(lifecycle, old);
  const migration = createCodumentResourceMigrator(root);
  const missing = await migration.upgrade(lifecycle);
  expect(missing.status).toBe('review-required');
  expect(missing.diagnostics.join('\n')).toContain('required resource file');
  await put('codument/tracks/active/incomplete/proposal.md', '# Proposal');
  await put('codument/tracks/active/incomplete/design.md', '# Design');
  const semantics = await migration.upgrade(lifecycle);
  expect(semantics.status).toBe('review-required');
  expect(semantics.diagnostics.join('\n')).toMatch(/TaskSpace|Ports|BehaviorPatch/u);
  expect(await fs.readFile(join(root, lifecycle), 'utf8')).toBe(old);
}));

test('knowledge and Decision validation sees peer resources, not only a parseable changed header', () => fixture(async (root, put) => {
  const path = 'codument/decisions/global.xnl';
  const source = '<decision #same apiVersion="codument.tech/v1alpha1" {status="pending"}>';
  await put(path, source);
  await put('codument/decisions/peer.xnl', '<decision #same envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {status="pending"}>');
  const result = await createCodumentResourceMigrator(root).upgrade(path);
  expect(result.status).toBe('review-required');
  expect(result.diagnostics.join('\n')).toContain('Duplicate');
  expect(await fs.readFile(join(root, path), 'utf8')).toBe(source);
}));
