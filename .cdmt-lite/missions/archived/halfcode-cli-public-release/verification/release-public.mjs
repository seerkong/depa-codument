import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [mode, directory, receiptFile] = process.argv.slice(2);
assert.ok(['audit', 'publish', 'verify'].includes(mode) && directory && receiptFile,
  'Usage: release-public.mjs audit|publish|verify RELEASE_DIRECTORY RECEIPT_FILE');
const registry = 'https://registry.npmjs.com';
const version = '0.2.1';
const expected = [
  'cli-contract', 'cli-logic', 'cli-support', 'cli-capsule', 'cli-shell',
  'skill-app-contract', 'skill-app-logic', 'skill-app-support', 'skill-app-capsule',
  'resource-capsule', 'local-function-capsule', 'browser-capsule', 'page-capsule',
  'serve-capsule', 'mcp-app-capsule', 'management-capsule', 'resource-bundle-support',
  'browser-support', 'live-host-capsule', 'http-shell', 'page-builder-vue-support',
].map(suffix => 'halfcode-lite-' + suffix).sort();
const receipt = JSON.parse(readFileSync(join(directory, 'release-set.json'), 'utf8'));
assert.equal(createHash('sha256').update(JSON.stringify(receipt.set)).digest('hex'), receipt.digest);
const artifacts = receipt.set.artifacts.filter(item => item.role === 'shared');
assert.deepEqual(artifacts.map(item => item.name).sort(), expected, 'Exact authorized public package set');
const records = new Map();
const unpacked = mkdtempSync(join(tmpdir(), 'halfcode-publish-audit-'));
const previous = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, 'utf8')) : null;
if (previous) assert.equal(previous.releaseDigest, receipt.digest, 'Cannot resume a different release');
const events = previous?.events ?? [];
function record(event) {
  events.push({ time: new Date().toISOString(), ...event });
  writeFileSync(receiptFile, JSON.stringify({ mode, registry, version, releaseDigest: receipt.digest, events }, null, 2));
  console.log(JSON.stringify(event));
}
for (const artifact of artifacts) {
  assert.equal(artifact.version, version);
  assert.match(artifact.file, /^[a-f0-9]{64}\.tgz$/);
  const file = resolve(directory, artifact.file);
  const bytes = readFileSync(file);
  assert.equal(createHash('sha256').update(bytes).digest('hex') + '.tgz', artifact.file);
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), artifact.integrity);
  const listing = execFileSync('tar', ['-tzf', file], { encoding: 'utf8' }).trim().split('\n');
  for (const entry of listing) {
    const common = /^package\/(?:src(?:\/|$)|package\.json$|README\.md$|LICENSE(?:\.md)?$)/.test(entry);
    const browserAsset = artifact.name === 'halfcode-lite-browser-support' && entry.startsWith('package/assets/');
    const executionGuide = artifact.name === 'halfcode-lite-skill-app-capsule' && entry === 'package/EXECUTION.md';
    assert.ok(common || browserAsset || executionGuide, artifact.name + ': unexpected file ' + entry);
    assert.ok(!entry.split('/').some(part => part === '..' || part === '.npmrc' || part === '.env' || part === 'node_modules' || part === 'test'), artifact.name + ': excluded file ' + entry);
  }
  const target = join(unpacked, artifact.name);
  mkdirSync(target);
  execFileSync('tar', ['-xzf', file, '-C', target]);
  for (const entry of listing.filter(entry => !entry.endsWith('/'))) {
    const content = readFileSync(join(target, entry), 'utf8');
    assert.ok(!/halfcode-lite-cli-host-/.test(content), artifact.name + ': retired package identity in ' + entry);
    assert.ok(!/npm_[A-Za-z0-9]{30,}|_authToken\s*=\s*[^\s]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content), artifact.name + ': potential credential in ' + entry);
  }
  const manifest = JSON.parse(readFileSync(join(target, 'package/package.json'), 'utf8'));
  assert.equal(manifest.name, artifact.name);
  assert.equal(manifest.version, version);
  assert.equal(manifest.halfcodeClone.identity, 'shared');
  assert.ok(!manifest.private && !manifest.bin && !manifest.scripts && !manifest.devDependencies);
  const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies };
  for (const [name, range] of Object.entries(dependencies)) {
    assert.ok(!/workspace:|file:|link:|127\.0\.0\.1|localhost|composition\./.test(range), name + ': non-public dependency');
    if (name.startsWith('halfcode-lite-')) {
      assert.ok(expected.includes(name), 'Dependency outside public closure: ' + name);
      assert.equal(range, version);
    }
  }
  records.set(artifact.name, { artifact, file, manifest, dependencies });
}
const ordered = [];
const visiting = new Set();
const done = new Set();
function visit(name) {
  if (done.has(name)) return;
  assert.ok(!visiting.has(name), 'Dependency cycle: ' + name);
  visiting.add(name);
  for (const dependency of Object.keys(records.get(name).dependencies)) if (records.has(dependency)) visit(dependency);
  visiting.delete(name);
  done.add(name);
  ordered.push(name);
}
for (const name of expected) visit(name);
record({ stage: 'audit', count: records.size, order: ordered, unpacked });
async function metadata(name) {
  const response = await fetch(registry + '/' + encodeURIComponent(name) + '?fresh=' + Date.now(), {
    signal: AbortSignal.timeout(30000), headers: { 'cache-control': 'no-cache' },
  });
  if (response.status === 404) return null;
  assert.ok(response.ok, name + ': registry HTTP ' + response.status);
  return response.json();
}
if (mode !== 'audit') {
  for (const name of ordered) {
    const { artifact, file } = records.get(name);
    const before = await metadata(name);
    const existing = before?.versions?.[version];
    if (existing) {
      assert.equal(existing.dist.integrity, artifact.integrity, 'Published version differs: ' + name);
      record({ stage: 'already-published', name, version, integrity: artifact.integrity });
      continue;
    }
    assert.equal(mode, 'publish', 'Missing published package: ' + name);
    if (events.some(event => event.stage === 'upload-acknowledged' && event.name === name && event.version === version)) {
      record({ stage: 'awaiting-registry', name, version });
      continue;
    }
    const result = spawnSync('npm', ['publish', file, '--access=public', '--tag=latest', '--ignore-scripts',
      '--registry=' + registry, '--userconfig=/Users/kongweixian/.npmrc'], { encoding: 'utf8', timeout: 120000 });
    if (result.status !== 0) {
      // Do not persist npm diagnostics, which may include environment/config details.
      record({ stage: 'publish-failed', name, version, status: result.status,
        errorCode: result.stderr?.match(/npm error code ([A-Z0-9_]+)/)?.[1] ?? 'unknown' });
      throw new Error('Publication stopped; see sanitized receipt for ' + name);
    }
    record({ stage: 'upload-acknowledged', name, version });
    const after = await metadata(name);
    const integrity = after?.versions?.[version]?.dist?.integrity;
    if (integrity) {
      assert.equal(integrity, artifact.integrity, 'Registry integrity mismatch: ' + name);
      record({ stage: 'published', name, version, integrity: artifact.integrity });
    } else record({ stage: 'awaiting-registry', name, version });
  }
}
record({ stage: mode === 'publish' ? 'submission-complete' : 'complete', count: records.size });
