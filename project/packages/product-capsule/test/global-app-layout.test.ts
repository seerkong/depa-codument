import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS as assets, createCodumentGuidanceOperations, createGlobalGuidanceResourceEffect, GLOBAL_APP_ROOT } from '../src/global-guidance';

test('complete App has closed document links and no retired layout', () => {
  const files = new Set(assets.map(asset => asset.path));
  expect(files.has('references/std/compat/operation-alias.md')).toBe(true);
  for (const asset of assets) {
    expect(asset.path).not.toMatch(/^std\/|kernel-pointer|\/commands\/|\/skill\/|\/std\/operations\//);
    for (const match of asset.source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1]!.split('#')[0]!;
      if (!target || /[:< ]/.test(target)) continue;
      expect(files.has(posix.normalize(posix.join(posix.dirname(asset.path), target))), `${asset.path}: ${target}`).toBe(true);
    }
  }
});

test('fixed root loads actual resource metadata, ignores other Apps and fails closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'depa-fixed-app-'));
  try {
    const resources = createGlobalGuidanceResourceEffect(root);
    await expect(createCodumentGuidanceOperations(resources)).rejects.toThrow('manifest is missing');
    for (const asset of assets) {
      const file = join(root, GLOBAL_APP_ROOT, asset.path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, asset.path === 'operations/discuss.md' ? asset.source.replace('command: discuss', 'command: discuss-renamed') : asset.source);
    }
    await mkdir(join(root, 'unrelated'), { recursive: true });
    await writeFile(join(root, 'unrelated/manifest.xnl'), 'malformed unrelated App');
    const operations = await createCodumentGuidanceOperations(resources);
    expect(operations.some(operation => operation.command === 'discuss-renamed')).toBe(true);
    expect(operations.some(operation => operation.command === 'discuss')).toBe(false);
    await writeFile(join(root, GLOBAL_APP_ROOT, 'manifest.xnl'), 'broken');
    await expect(createCodumentGuidanceOperations(resources)).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});
