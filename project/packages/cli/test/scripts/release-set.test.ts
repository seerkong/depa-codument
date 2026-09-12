import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openReleaseRegistry, releaseSetDigest, type ReleaseSet } from '../../../../scripts/verification/release-set';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture(name: string, role: 'shared' | 'product' = 'shared', dependencies: Record<string, string> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'release-registry-proof-'));
  roots.push(root);
  await mkdir(join(root, 'package'));
  await writeFile(join(root, 'package/package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', exports: './index.js', dependencies }));
  await writeFile(join(root, 'package/index.js'), 'export const value = 1;');
  const child = Bun.spawn(['tar', '-czf', join(root, 'payload.tgz'), '-C', root, 'package'], { stdout: 'pipe', stderr: 'pipe' });
  expect(await child.exited).toBe(0);
  const bytes = await readFile(join(root, 'payload.tgz'));
  const file = createHash('sha256').update(bytes).digest('hex') + '.tgz';
  await writeFile(join(root, file), bytes);
  const set: ReleaseSet = { format: 'halfcode-local-release-set/v1', artifacts: [{ name, version: '1.0.0', role, file,
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') }] };
  async function save() { await writeFile(join(root, 'release-set.json'), JSON.stringify({ set, digest: releaseSetDigest(set) })); }
  await save();
  return { root, set, save, bytes };
}

test('consumer products extend a fixed set without replacing its digest or proxying unknown packages', async () => {
  const base = await fixture('fixture-core'), product = await fixture('fixture-product', 'product');
  const registry = await openReleaseRegistry(base.root, [product.root]);
  try {
    expect(registry.digest).toBe(releaseSetDigest(base.set));
    expect(registry.productDigests).toEqual([releaseSetDigest(product.set)]);
    const metadata = await (await fetch(registry.url + '/fixture-product')).json() as { versions: Record<string, { dist: { tarball: string } }> };
    const tarball = await fetch(metadata.versions['1.0.0'].dist.tarball);
    expect(Buffer.from(await tarball.arrayBuffer())).toEqual(product.bytes);
    expect((await fetch(registry.url + '/not-in-the-set')).status).toBe(404);
  } finally { await registry.close(); }
  await expect(fetch(registry.url + '/fixture-core')).rejects.toThrow();
});

test('a product cannot replace a base name, append shared mechanisms or duplicate an artifact identity', async () => {
  const base = await fixture('fixture-core'), replacement = await fixture('fixture-core', 'product');
  await expect(openReleaseRegistry(base.root, [replacement.root])).rejects.toThrow('cannot replace');
  const shared = await fixture('fixture-shared');
  await expect(openReleaseRegistry(base.root, [shared.root])).rejects.toThrow('only supply consumer products');
  const product = await fixture('fixture-product', 'product');
  await expect(openReleaseRegistry(base.root, [product.root, product.root])).rejects.toThrow('Duplicate artifact identity');
});

test('index, payload, content-address, manifest and dependency drift fail before a server exists', async () => {
  const index = await fixture('fixture-index');
  await writeFile(join(index.root, 'release-set.json'), JSON.stringify({ set: index.set, digest: 'forged' }));
  await expect(openReleaseRegistry(index.root)).rejects.toThrow('Release index drift');
  const payload = await fixture('fixture-payload');
  await writeFile(join(payload.root, payload.set.artifacts[0].file), Buffer.from('corrupt'));
  await expect(openReleaseRegistry(payload.root)).rejects.toThrow('filename drift');
  const integrity = await fixture('fixture-integrity');
  integrity.set.artifacts[0].integrity = 'sha512-forged';
  await integrity.save();
  await expect(openReleaseRegistry(integrity.root)).rejects.toThrow('Release payload drift');
  const manifest = await fixture('fixture-manifest');
  manifest.set.artifacts[0].name = 'forged-name';
  await manifest.save();
  await expect(openReleaseRegistry(manifest.root)).rejects.toThrow();
  for (const range of ['workspace:*', 'file:../private', 'link:../private']) {
    const dependency = await fixture('fixture-dependency', 'shared', { 'private-source': range });
    await expect(openReleaseRegistry(dependency.root)).rejects.toThrow();
  }
});
