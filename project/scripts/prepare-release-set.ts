import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { releaseSetDigest, type ReleaseSet } from './verification/release-set';

// Prepare local product artifacts, not a publication. Shared dependencies must
// already refer to an immutable Halfcode release candidate (no source aliases).
const root = resolve(import.meta.dir, '..');
const output = process.argv[2];
assert.ok(output?.startsWith('/'), 'Usage: prepare-release-set.ts /absolute/new/output');
const temporary = await mkdtemp(join(tmpdir(), 'codument-product-release-'));
try {
  const product = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const sources = await Promise.all((await readdir(join(root, 'packages')))
    .filter(directory => existsSync(join(root, 'packages', directory, 'package.json'))).map(async directory => {
    const source = join(root, 'packages', directory);
    return { directory, source, manifest: JSON.parse(await readFile(join(source, 'package.json'), 'utf8')) };
  }));
  const versions = new Map(sources.map(({ manifest }) => [manifest.name, manifest.version]));
  const set: ReleaseSet = { format: 'halfcode-local-release-set/v1', artifacts: [] };
  await mkdir(output); // Never overwrite an existing candidate.
  for (const { directory, source, manifest } of sources) {
    if (manifest.os || manifest.cpu) continue; // Native distributions are separate release projections.
    const staging = join(temporary, directory);
    await cp(source, staging, { recursive: true, filter: file => !file.split('/').some(part => ['node_modules', '.git', 'dist', 'test'].includes(part)) });
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        if (String(range).startsWith('workspace:')) {
          assert.ok(versions.has(name), `Unknown workspace ${name}`);
          manifest[field][name] = versions.get(name);
        }
      }
    }
    delete manifest.devDependencies;
    delete manifest.scripts;
    if (directory === 'cli') {
      // Source builds read the root authority; packed builds carry its immutable
      // value, never reach outside the installed package to a consumer manifest.
      await writeFile(join(staging, 'src/version.ts'), `export const VERSION = ${JSON.stringify(product.version)};\n`);
    }
    await writeFile(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    const archive = join(temporary, directory + '.tgz');
    const child = Bun.spawn([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', archive], { cwd: staging, stdout: 'pipe', stderr: 'pipe' });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    assert.equal(code, 0, stdout + stderr);
    const bytes = await readFile(archive);
    const file = createHash('sha256').update(bytes).digest('hex') + '.tgz';
    await writeFile(join(output, file), bytes, { flag: 'wx' });
    set.artifacts.push({ name: manifest.name, version: manifest.version, file,
      integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'), role: 'product' });
  }
  set.artifacts.sort((a, b) => a.name.localeCompare(b.name));
  const digest = releaseSetDigest(set);
  await writeFile(join(output, 'release-set.json'), JSON.stringify({ digest, set, productVersion: product.version, publishedToNpm: false }, null, 2) + '\n');
  console.log(JSON.stringify({ output, digest, count: set.artifacts.length }));
} finally { await rm(temporary, { recursive: true, force: true }); }
