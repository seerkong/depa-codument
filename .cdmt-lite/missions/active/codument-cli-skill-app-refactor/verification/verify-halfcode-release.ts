import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openReleaseRegistry } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/release-set';

const release = resolve(process.argv[2] ?? join(import.meta.dir, 'host-release-round-15'));
const label = process.argv[3] ?? 'round-15-halfcode-release';
assert.match(label, /^[a-z0-9-]+$/);
const temporary = await mkdtemp(join(tmpdir(), 'halfcode-immutable-consumer-'));
async function run(args: string[]) {
  const child = Bun.spawn([process.execPath, ...args], { cwd: temporary, stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, NODE_PATH: '', BUN_INSTALL_CACHE_DIR: join(temporary, 'cache'),
      npm_config_userconfig: join(temporary, 'empty.npmrc') } });
  const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
  assert.equal(code, 0, stderr + stdout);
  return stdout + stderr;
}
try {
  const registry = await openReleaseRegistry(release);
  await writeFile(join(temporary, 'empty.npmrc'), '');
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ name: 'halfcode-immutable-consumer', type: 'module', private: true,
    dependencies: { 'halfcode-cli-lite-cli': '0.1.0', 'halfcode-cli-lite-skill-app-capsule': '0.1.0', '@modelcontextprotocol/sdk': '^1.30.0' } }));
  try { await run(['install', '--save-text-lockfile', '--ignore-scripts', '--registry', registry.url]); }
  finally { await registry.close(); }
  const native = registry.set.artifacts.find(item => item.name === '@halfcode-cli-lite/skill-app-contract')!;
  const fixtures = JSON.parse(await readFile(join(import.meta.dir, 'legacy-frozen-fixtures.json'), 'utf8'));
  const historical = fixtures.find((item: { id: string }) => item.id === 'halfcode-legacy');
  const installedArtifact = { name: native.name, version: native.version, integrity: native.integrity, apiVersion: '2' };
  const profile = { id: 'halfcode-native-forwarder-v1', declaredArtifact: { ...installedArtifact, integrity: historical.artifactIntegrity },
    installedArtifact, semanticIdentity: historical.semanticIdentity, expectedLockDigest: historical.expectedLock.lockDigest };
  await copyFile(join(release, native.file), join(temporary, 'native.tgz'));
  await copyFile(join(import.meta.dir, historical.artifactPath), join(temporary, 'historical.tgz'));
  await writeFile(join(temporary, 'native-compatibility.json'), JSON.stringify({ profile, expectedLock: historical.expectedLock }));
  await copyFile(join(import.meta.dir, 'halfcode-native-compatibility.mjs'), join(temporary, 'native-compatibility.mjs'));
  const compatibility = await run(['native-compatibility.mjs']);
  await copyFile('/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/halfcode-product-cli.mjs', join(temporary, 'product.mjs'));
  const product = await run(['product.mjs']);
  const output = JSON.stringify({ releaseDigest: registry.digest, consumer: 'Halfcode', normalRegistryResolution: true, transitiveOverrides: false,
    sourceImportsInConsumer: false, registryStoppedBeforeRuntime: true }) + '\n' + compatibility + '\n' + product;
  await writeFile(join(import.meta.dir, 'logs', `${label}.log`), 'exit: 0\n' + output, { flag: 'wx' });
  console.log(output);
} catch (error) {
  await writeFile(join(import.meta.dir, 'logs', `${label}-failure.log`), String(error), { flag: 'wx' });
  throw error;
} finally { await rm(temporary, { recursive: true, force: true }); }
