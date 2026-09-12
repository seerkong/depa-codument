import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { gunzipSync } from 'node:zlib';

interface Entry { path: string; kind: string; hash: string; bytes: string; }
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sourceIndex = JSON.parse(await readFile(join(import.meta.dir, 'legacy-public-fixtures.json'), 'utf8'));
const result = [];
for (const [index, repo, prefix] of [[0, 'H', ''], [1, 'C', 'project/']] as const) {
  const archive = await readFile(join(import.meta.dir, 'cross-repo-baseline', `${repo}.json.gz`));
  const summary = JSON.parse(await readFile(join(import.meta.dir, 'cross-repo-baseline', `${repo}.json`), 'utf8'));
  assert.equal(sha256(archive), summary.archiveSha256);
  const snapshot: { entries: Entry[] } = JSON.parse(gunzipSync(archive).toString());
  const stage = await mkdtemp(join(tmpdir(), 'halfcode-legacy-frozen-'));
  const packagePrefix = `${prefix}packages/skill-app-contract/`;
  try {
    const selected = snapshot.entries.filter(entry => entry.path === `${prefix}package.json`
      || entry.path.startsWith(packagePrefix)
      || new RegExp(`^${prefix}packages/[^/]+/package.json$`).test(entry.path));
    assert.ok(selected.some(entry => entry.path === packagePrefix + 'src/app.ts'));
    for (const entry of selected) {
      assert.equal(entry.kind, 'file');
      const bytes = Buffer.from(entry.bytes, 'base64');
      assert.equal(sha256(bytes), entry.hash);
      const relative = entry.path.slice(prefix.length);
      assert.ok(!posix.isAbsolute(relative) && !relative.split('/').includes('..'));
      const target = join(stage, relative);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx' });
    }
    const temporaryArchive = join(stage, 'legacy.tgz');
    const child = Bun.spawn([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', temporaryArchive], {
      cwd: join(stage, 'packages/skill-app-contract'), stdout: 'pipe', stderr: 'pipe',
    });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    assert.equal(code, 0, stderr + stdout);
    const bytes = await readFile(temporaryArchive);
    const artifactPath = `legacy-artifacts/${repo}-${sha256(bytes)}.tgz`;
    await mkdir(join(import.meta.dir, 'legacy-artifacts'), { recursive: true });
    await writeFile(join(import.meta.dir, artifactPath), bytes, { flag: 'wx' });
    const { packageRoot: _, ...fixture } = sourceIndex[index];
    result.push({ ...fixture, artifactPath, artifactIntegrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'),
      provenance: { baseline: `${repo}.json.gz`, archiveSha256: summary.archiveSha256, sourceDigest: summary.digest,
        trust: 'local frozen source snapshot, not historical npm publisher authentication' } });
  } finally { await rm(stage, { recursive: true, force: true }); }
}
await writeFile(join(import.meta.dir, 'legacy-frozen-fixtures.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result.map(({ id, artifactPath, artifactIntegrity, provenance }) => ({ id, artifactPath, artifactIntegrity, provenance }))));
