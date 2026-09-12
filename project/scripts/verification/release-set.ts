// Verification-only fixture protocol; production packages never import this registry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ReleaseArtifact {
  name: string;
  version: string;
  integrity: string;
  file: string;
  role: 'shared' | 'product' | 'vendor';
}
export interface ReleaseSet {
  format: 'halfcode-local-release-set/v1';
  artifacts: ReleaseArtifact[];
}
export const releaseSetDigest = (value: ReleaseSet) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** A prepared immutable fixture set is sufficient: no source repositories or installed vendor trees are read. */
export async function openReleaseRegistry(directory: string, productDirectories: readonly string[] = []) {
  const receipt = JSON.parse(await readFile(join(directory, 'release-set.json'), 'utf8')) as { digest: string; set: ReleaseSet };
  assert.equal(receipt.set.format, 'halfcode-local-release-set/v1');
  assert.equal(releaseSetDigest(receipt.set), receipt.digest, 'Release index drift');
  const names = new Map<string, Map<string, { manifest: Record<string, unknown>; artifact: ReleaseArtifact }>>();
  const payloads = new Map<string, Uint8Array>();
  const sources = [{ directory, receipt }];
  for (const productDirectory of productDirectories) {
    const productReceipt = JSON.parse(await readFile(join(productDirectory, 'release-set.json'), 'utf8')) as { digest: string; set: ReleaseSet };
    assert.equal(productReceipt.set.format, 'halfcode-local-release-set/v1');
    assert.equal(releaseSetDigest(productReceipt.set), productReceipt.digest, 'Product index drift');
    assert.ok(productReceipt.set.artifacts.every(item => item.role === 'product'), 'Additional sets may only supply consumer products');
    sources.push({ directory: productDirectory, receipt: productReceipt });
  }
  for (const source of sources) for (const artifact of source.receipt.set.artifacts) {
    if (source.directory !== directory) assert.ok(!receipt.set.artifacts.some(item => item.name === artifact.name), 'Consumer cannot replace a base release package');
    assert.match(artifact.file, /^[a-f0-9]{64}\.tgz$/);
    const bytes = await readFile(join(source.directory, artifact.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex') + '.tgz', artifact.file, 'Content-addressed filename drift');
    assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), artifact.integrity, 'Release payload drift');
    const child = Bun.spawn(['tar', '-xOf', join(source.directory, artifact.file), 'package/package.json'], { stdout: 'pipe', stderr: 'pipe' });
    const [code, text, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    assert.equal(code, 0, error);
    const manifest = JSON.parse(text);
    assert.equal(manifest.name, artifact.name);
    assert.equal(manifest.version, artifact.version);
    for (const range of Object.values({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies })) {
      assert.ok(typeof range === 'string' && !/^(workspace:|file:|link:)/.test(range));
    }
    if (!names.has(artifact.name)) names.set(artifact.name, new Map());
    assert.ok(!names.get(artifact.name)!.has(artifact.version), 'Duplicate artifact identity');
    names.get(artifact.name)!.set(artifact.version, { manifest, artifact });
    payloads.set(artifact.file, bytes);
  }
  const requests: string[] = [];
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const url = new URL(request.url);
    requests.push(url.pathname);
    if (url.pathname.startsWith('/artifacts/')) {
      const bytes = payloads.get(url.pathname.slice('/artifacts/'.length));
      return bytes ? new Response(bytes) : new Response('Outside release set', { status: 404 });
    }
    const name = decodeURIComponent(url.pathname.slice(1));
    const versions = names.get(name);
    if (!versions) return new Response('Outside release set', { status: 404 });
    return Response.json({ name, 'dist-tags': { latest: [...versions.keys()].at(-1) },
      versions: Object.fromEntries([...versions].map(([version, { manifest, artifact }]) => [version, {
        ...manifest, dist: { integrity: artifact.integrity, tarball: `${url.origin}/artifacts/${artifact.file}` },
      }])) });
  } });
  return { digest: receipt.digest, set: receipt.set, productDigests: sources.slice(1).map(source => source.receipt.digest),
    url: server.url.origin, requests, close: () => server.stop(true) };
}
