import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openReleaseRegistry } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/release-set';
import { verifyPackagedBrowser, verifyPackagedMcp, verifyPackagedVue } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/optional-exercises';
import { verifyCustomKindConsumer } from '../../../../../project/scripts/verification/custom-kind-consumer';

const label = process.argv[2];
assert.match(label ?? '', /^[a-z0-9-]+$/);
const temporary = await realpath(await mkdtemp(join(tmpdir(), 'notes-release-consumer-')));
const fixtures = '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures';
const output: string[] = [];
const releaseIndex = process.argv.indexOf('--release-set');
const releaseDirectory = releaseIndex >= 0 ? process.argv[releaseIndex + 1] : join(import.meta.dir, 'host-release-round-15');
if (!releaseDirectory) throw new Error('--release-set requires a directory');
async function command(args: string[], cwd: string): Promise<string> {
  const child = Bun.spawn([process.execPath, ...args], { cwd, stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, NODE_PATH: '', BUN_BIN: process.execPath, BUN_INSTALL_CACHE_DIR: join(temporary, 'cache'),
      npm_config_userconfig: join(temporary, 'empty.npmrc') } });
  const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
  output.push(JSON.stringify({ args, code }) + '\n' + stdout + stderr);
  assert.equal(code, 0, stdout + stderr);
  return stdout;
}
try {
  await writeFile(join(temporary, 'empty.npmrc'), '');
  const registry = await openReleaseRegistry(resolve(releaseDirectory));
  const core = join(temporary, 'core'), consumer = join(temporary, 'consumer'), codeFirst = join(temporary, 'code-first');
  const base = { 'halfcode-cli-lite-cli-host-capsule': '0.1.0', 'halfcode-cli-lite-cli-host-shell': '0.1.0', 'halfcode-cli-lite-cli-host-support': '0.1.0' };
  try {
    for (const [root, dependencies] of [[core, base], [consumer, { ...base,
      'halfcode-cli-lite-skill-app-capsule': '0.1.0', 'halfcode-cli-lite-browser-support': '0.1.0',
      'halfcode-cli-lite-live-host-capsule': '0.1.0', 'halfcode-cli-lite-http-shell': '0.1.0',
      'halfcode-cli-lite-page-builder-vue-support': '0.1.0', 'halfcode-cli-lite-mcp-app-capsule': '0.1.0',
      'vue': '3.5.41', '@modelcontextprotocol/sdk': '^1.30.0',
    }], [codeFirst, { 'halfcode-cli-lite-skill-app-contract': '2.0.0' }]] as const) {
      await mkdir(root);
      await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'independent-notes', private: true, type: 'module', dependencies }));
      await command(['install', '--save-text-lockfile', '--ignore-scripts', '--registry', registry.url], root);
    }
  } finally { await registry.close(); }
  const corePackages = (await readdir(join(core, 'node_modules'))).filter(name => !name.startsWith('.')).sort();
  assert.deepEqual(corePackages, ['contract', 'logic', 'support', 'capsule', 'shell'].map(role => 'halfcode-cli-lite-cli-host-' + role).sort());
  const installed = (await readdir(join(consumer, 'node_modules'))).filter(name => !name.startsWith('.'));
  assert.ok(!installed.some(name => name.startsWith('depa-codument') || name === '@halfcode-cli-lite' || /halfcode-cli-lite-(cli|product-capsule|cli-shell)$/.test(name)));
  for (const artifact of registry.set.artifacts.filter(item => item.role === 'shared')) {
    const root = join(consumer, 'node_modules', artifact.name);
    assert.ok((await realpath(root)).startsWith(temporary + '/'));
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    assert.equal(manifest.version, artifact.version);
    assert.equal(manifest.private ?? false, false);
    assert.equal(manifest.engines.bun, '>=1.3.0');
    for (const target of Object.values(manifest.exports) as string[]) {
      const matches = [...new Bun.Glob(target).scanSync(root)];
      assert.ok(matches.length, 'Missing export files: ' + artifact.name + '/' + target);
      for (const file of matches) assert.ok((await readFile(join(root, file))).length);
    }
  }
  await copyFile(join(fixtures, 'public-core-consumer.ts.txt'), join(core, 'proof.ts'));
  await command(['proof.ts'], core);
  await copyFile(join(fixtures, 'public-resource-consumer.ts.txt'), join(consumer, 'resources.ts'));
  await command(['resources.ts'], consumer);
  await copyFile(join(import.meta.dir, 'recursive-catalog-consumer.mjs'), join(consumer, 'recursive-catalog.mjs'));
  await command(['recursive-catalog.mjs'], consumer);
  await copyFile(join(import.meta.dir, 'command-operation-consumer.mjs'), join(consumer, 'command-operation.mjs'));
  await command(['command-operation.mjs'], consumer);
  await verifyCustomKindConsumer(consumer, command);
  await verifyPackagedBrowser(consumer, command);
  for (const file of ['public-browser-bindings.mjs', 'public-live-consumer.mjs']) {
    await copyFile(join(fixtures, file), join(consumer, file));
    await command([file], consumer);
  }
  await verifyPackagedVue(consumer, command);
  await verifyPackagedMcp(consumer, command);
  const receipt = { consumer: 'Notes', releaseDigest: registry.digest, runtime: Bun.version, corePackages,
    publicPackages: registry.set.artifacts.filter(item => item.role === 'shared').map(({ name, version, integrity }) => ({ name, version, integrity })),
    normalRegistryResolution: true, transitiveOverrides: false, sourceImportsInConsumer: false, registryStoppedBeforeRuntime: true,
    nativeSmoke: process.platform + '-' + process.arch, realBrowser: 'NOT_RUN', realMessages: 'NOT_RUN', publishedToNpm: false };
  await writeFile(join(import.meta.dir, 'logs', label + '.log'), 'exit: 0\n' + JSON.stringify(receipt) + '\n' + output.join('\n'), { flag: 'wx' });
  console.log(JSON.stringify(receipt));
} catch (error) {
  await writeFile(join(import.meta.dir, 'logs', label + '-failure.log'), output.join('\n') + '\n' + String(error), { flag: 'wx' });
  throw error;
} finally { await rm(temporary, { recursive: true, force: true }); }
