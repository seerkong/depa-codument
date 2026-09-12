import { expect, test } from 'bun:test';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { CODUMENT_WORKSPACE_ASSETS } from '../src/workspace-assets';
import { createCodumentWorkspaceBlueprint } from '../src/workspace-app';
import { indexKnowledgeSources, validateKnowledgeIndex, inspectStdDocumentation } from 'depa-codument-domain-logic';

test('embedded assets have one complete source index, local route closure and no Kind copies', async () => {
  const root = join(import.meta.dir, '../src/workspace-assets');
  const files = (await readdir(root, { recursive: true })).filter(path => /\.(md|xnl)$/.test(path)).sort();
  const assets = new Map<string, string>(CODUMENT_WORKSPACE_ASSETS.map(asset => [asset.path, asset.source]));
  const directories = new Set(createCodumentWorkspaceBlueprint().directories.map(path => `codument/${path}/`));
  expect([...assets.keys()].sort()).toEqual(files);
  for (const [path, source] of assets) {
    expect(source).toBe(await readFile(join(root, path), 'utf8'));
    expect(path.split('/')).not.toContain('KindDefinitions');
    for (const match of source.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
      const ref = match[1]!.split('#')[0]!;
      if (!ref || /^[a-z]+:|^\/|[{}<>*]/i.test(ref)) continue;
      const target = posix.normalize(posix.join(dirname(path), ref));
      // References in historical compatibility material may document old inputs;
      // current entrypoints and standards must resolve in the distributed App.
      if (!path.includes('/compat/')) expect(assets.has(target), `${path} -> ${ref}`).toBe(true);
    }
    if (path.startsWith('skills/') && path.endsWith('/SKILL.md')) {
      const route = source.match(/@\/(codument\/std\/operations\/[a-z-]+\.md)/)?.[1];
      expect(route, path).toBeDefined(); expect(assets.has(route!), path).toBe(true);
    }
    if (path.startsWith('codument/config/')) for (const match of source.matchAll(/vfs:\/\/@\/(codument\/[^"\s]+)/g)) expect(assets.has(match[1]!) || directories.has(match[1]!), `${path} -> ${match[1]}`).toBe(true);
  }
  expect(inspectStdDocumentation({ root: 'codument/std', sources: new Map([...assets].filter(([path]) => path.startsWith('codument/std/'))
    .map(([path, source]) => [path.slice('codument/std/'.length), source])) }).findings).toEqual([]);
});

test('distributed current knowledge owner examples pass the same product semantic validators', () => {
  for (const [path, family, file, mode] of [
    ['codument/std/spec/modeling-registry.md', 'modeling', 'domain/orders/index.xnl', 'registry'],
    ['codument/std/spec/engineering-delta.md', 'engineering', 'backend/howto/orders.xnl', 'deltas'],
  ] as const) {
    const text = CODUMENT_WORKSPACE_ASSETS.find(asset => asset.path === path)!.source;
    const source = text.match(/```xnl\n([\s\S]+?)\n```/)![1]!;
    const index = indexKnowledgeSources(new Map([[file, source]]), family, mode);
    expect(index.ready, path).toBe(true);
    expect(validateKnowledgeIndex(index).filter(f => f.severity === 'error'), path).toEqual([]);
  }
});
