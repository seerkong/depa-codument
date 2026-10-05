import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const [mode, lockFile, output] = process.argv.slice(2);
assert.ok(['observe', 'rewrite'].includes(mode) && lockFile && output);
const text = readFileSync(lockFile, 'utf8');
const lock = Bun.JSONC.parse(text);
const entries = Object.entries(lock.packages).filter(([, value]) => !value[0].includes('@workspace:'));
const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < entries.length) {
    const [key, value] = entries[cursor++];
    const index = value[0].lastIndexOf('@');
    const name = value[0].slice(0, index);
    const version = value[0].slice(index + 1);
    const url = 'https://registry.npmjs.org/' + encodeURIComponent(name) + '/' + encodeURIComponent(version);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) { results.push({ key, name, version, status: response.status }); continue; }
    const metadata = await response.json();
    assert.equal(metadata.name, name);
    assert.equal(metadata.version, version);
    assert.ok(metadata.dist.integrity && /^https:\/\/registry\.npmjs\.(?:org|com)\//.test(metadata.dist.tarball));
    results.push({ key, name, version, status: response.status, tarball: metadata.dist.tarball, integrity: metadata.dist.integrity });
  }
}));
results.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(output, JSON.stringify(results, null, 2));
const failures = results.filter(item => item.status !== 200);
console.log(JSON.stringify({ lockFile, total: results.length, failures }));
if (mode === 'rewrite') {
  assert.equal(failures.length, 0, 'All exact locked versions must exist on npmjs');
  // Preserve the lock graph and exact versions; replace only registry URL and publisher integrity.
  for (const item of results) {
    lock.packages[item.key][1] = item.tarball;
    lock.packages[item.key][3] = item.integrity;
  }
  writeFileSync(lockFile, JSON.stringify(lock, null, 2) + '\n');
}
