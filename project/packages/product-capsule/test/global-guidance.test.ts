import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { createWorkspaceResourceCatalog } from 'halfcode-lite-skill-app-support/resources/workspace-resource-catalog';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS, CODUMENT_GLOBAL_SKILL, CODUMENT_OPERATION_ROUTES, createCodumentGuidanceOperations } from '../src/global-guidance';

test('every original Skill remains discoverable and becomes an admitted CommandOperation', async () => {
  const original = join(import.meta.dir, '../src/workspace-assets/skills');
  const description = parse(CODUMENT_GLOBAL_SKILL.split('---')[1]!).description;
  const operations = await createCodumentGuidanceOperations();
  expect(operations).toHaveLength(14);
  for (const route of CODUMENT_OPERATION_ROUTES) {
    const old = parse((await readFile(join(original, route.legacySkill, 'SKILL.md'), 'utf8')).split('---')[1]!);
    expect(description).toContain(old.name);
    // Discovery summaries may be shorter/localized; CLI metadata is resource-owned.
    expect(description).toMatch(new RegExp(old.name + '（[^）]+）'));
    const operation = operations.find(item => item.command === route.command)!;
    expect(operation).toBeDefined();
    expect(operation.markdown.length).toBeGreaterThan(100);
    expect(operation.markdown).not.toContain('@/codument/std/');
  }
  expect(operations.some(item => item.command === 'validate' || item.command === 'migrate')).toBe(false);
});

test('installed global guidance is an independent resource-first App without copied Kinds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'depa-guidance-app-'));
  try {
    for (const asset of CODUMENT_GLOBAL_GUIDANCE_ASSETS) {
      const file = join(root, asset.path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, asset.source);
      expect(asset.path).not.toContain('KindDefinitions');
    }
    const snapshot = await createWorkspaceResourceCatalog(root, [{ root: '.', scope: 'root', origin: 'isolated-global' }]).snapshot();
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.ready).toBe(true);
    expect(snapshot.resources.filter(item => item.kind === 'CommandOperation')).toHaveLength(14);
    expect(snapshot.resources.some(item => item.fqn === 'Codument.Guidance')).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
