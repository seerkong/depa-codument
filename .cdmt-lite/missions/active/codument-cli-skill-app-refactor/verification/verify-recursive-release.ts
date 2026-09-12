import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openReleaseRegistry } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/release-set';

const [label, directory] = process.argv.slice(2);
assert.match(label ?? '', /^[a-z0-9-]+$/);
assert.ok(directory?.startsWith('/'));
const root = await mkdtemp(join(tmpdir(), 'recursive-release-consumer-'));
const output: string[] = [];
async function run(args: string[]): Promise<void> {
  const child = Bun.spawn([process.execPath, ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, NODE_PATH: '', BUN_INSTALL_CACHE_DIR: join(root, 'cache'), npm_config_userconfig: join(root, 'empty.npmrc') } });
  const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
  output.push(JSON.stringify({ args, code }) + '\n' + stdout + stderr);
  assert.equal(code, 0, stdout + stderr);
}
try {
  const registry = await openReleaseRegistry(directory);
  await writeFile(join(root, 'empty.npmrc'), '');
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'independent-recursive-notes', private: true, type: 'module',
    dependencies: { 'halfcode-cli-lite-skill-app-support': '0.1.0', 'halfcode-cli-lite-skill-app-contract': '2.0.0' } }));
  try { await run(['install', '--ignore-scripts', '--registry', registry.url]); }
  finally { await registry.close(); }
  const lock = await readFile(join(root, 'bun.lock'), 'utf8');
  for (const name of ['halfcode-cli-lite-skill-app-contract', 'halfcode-cli-lite-skill-app-logic', 'halfcode-cli-lite-skill-app-support']) {
    assert.ok(lock.includes(registry.set.artifacts.find(item => item.name === name)!.integrity));
  }
  await copyFile(join(import.meta.dir, 'recursive-catalog-consumer.mjs'), join(root, 'proof.mjs'));
  await run(['proof.mjs']);
  const receipt = { releaseDigest: registry.digest, scope: 'recursive-catalog-only', normalRegistryResolution: true,
    registryStoppedBeforeRuntime: true, fullThreeConsumers: 'UNVERIFIED', runtime: Bun.version };
  await writeFile(join(import.meta.dir, 'logs', label + '.log'), 'exit: 0\n' + JSON.stringify(receipt) + '\n' + output.join('\n'), { flag: 'wx' });
  console.log(JSON.stringify(receipt));
} catch (error) {
  await writeFile(join(import.meta.dir, 'logs', label + '-failure.log'), output.join('\n') + '\n' + String(error), { flag: 'wx' });
  throw error;
} finally { await rm(root, { recursive: true, force: true }); }
