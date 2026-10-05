import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const upstream = '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const consumer = '/Users/kongweixian/infra-dev/depa-codument/project';
const retired = ['halfcode-lite-cli', 'host', ''].join('-');
for (const root of [upstream, consumer]) {
  const packages = readdirSync(join(root, 'packages')).map(dir => join(root, 'packages', dir, 'package.json'))
    .filter(existsSync).map(file => JSON.parse(readFileSync(file, 'utf8')));
  assert.equal(new Set(packages.map(item => item.name)).size, packages.length);
  for (const manifest of [JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')), ...packages]) {
    assert.ok(!manifest.name.startsWith(retired));
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        assert.ok(!name.startsWith(retired), manifest.name + ': retired dependency');
        if (root === consumer && name.startsWith('halfcode-lite-')) assert.equal(range, '0.2.1');
      }
    }
  }
  const files = execFileSync('rg', ['--files', 'packages', 'scripts'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  for (const file of files) {
    if (!/\.(ts|tsx|js|mjs|json|md|txt)$/.test(file)) continue;
    assert.ok(!readFileSync(join(root, file), 'utf8').includes(retired), 'Retired identity: ' + join(root, file));
  }
  if (root === upstream) {
    const shared = packages.filter(item => item.halfcodeClone?.identity === 'shared');
    assert.equal(shared.length, 21);
    assert.ok(shared.every(item => item.version === '0.2.1'));
    for (const role of ['contract', 'logic', 'support', 'capsule', 'shell']) {
      assert.ok(shared.some(item => item.name === 'halfcode-lite-cli-' + role));
    }
    assert.equal(packages.find(item => item.name === 'halfcode-lite-product-cli-shell').halfcodeClone.identity, 'product');
  }
}
const lockText = readFileSync(join(consumer, 'bun.lock'), 'utf8');
assert.ok(!/127\.0\.0\.1|localhost|composition\.12/.test(lockText));
const lock = Bun.JSONC.parse(lockText);
let shared = 0;
for (const [name, value] of Object.entries(lock.packages)) {
  if (value[0].includes('@workspace:')) continue;
  assert.match(value[1], /^https:\/\/registry\.npmjs\.(org|com)\//);
  if (name.startsWith('halfcode-lite-')) {
    assert.equal(value[0], name + '@0.2.1');
    shared++;
  }
}
assert.equal(shared, 21);
console.log(JSON.stringify({ shared, newCliNames: 5, productShellDistinct: true, retiredReferences: 0, publicLock: true }));
