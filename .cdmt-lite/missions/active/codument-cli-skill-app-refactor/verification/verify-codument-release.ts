import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openReleaseRegistry, releaseSetDigest, type ReleaseSet } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/release-set';

const label = process.argv[2] ?? 'round-15-codument-release';
assert.match(label, /^[a-z0-9-]+$/);
const product = resolve(import.meta.dir, '../../../../../project');
const temporary = await realpath(await mkdtemp(join(tmpdir(), 'codument-immutable-consumer-')));
const productSetIndex = process.argv.indexOf('--product-set');
const fixedProductSet = productSetIndex >= 0 ? process.argv[productSetIndex + 1] : undefined;
if (productSetIndex >= 0 && !fixedProductSet) throw new Error('--product-set requires a release directory');
const archiveDirectory = fixedProductSet ? resolve(fixedProductSet) : join(import.meta.dir, label + '-artifacts');
const fullCli = process.argv.includes('--full-cli');
const releaseIndex = process.argv.indexOf('--release-set');
const releaseDirectory = releaseIndex >= 0 ? process.argv[releaseIndex + 1] : join(import.meta.dir, 'host-release-round-15');
if (!releaseDirectory) throw new Error('--release-set requires a directory');
async function run(args: string[], cwd = temporary) {
  const child = Bun.spawn([process.execPath, ...args], { cwd, stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, NODE_PATH: '', BUN_INSTALL_CACHE_DIR: join(temporary, 'cache'), npm_config_userconfig: join(temporary, 'empty.npmrc') } });
  const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
  assert.equal(code, 0, stderr + stdout);
  return stdout + stderr;
}
try {
  const set: ReleaseSet = fixedProductSet
    ? JSON.parse(await readFile(join(archiveDirectory, 'release-set.json'), 'utf8')).set
    : { format: 'halfcode-local-release-set/v1', artifacts: [] };
  if (!fixedProductSet) {
  await mkdir(archiveDirectory);
  const directories = ['domain-contract', 'domain-logic', 'domain-support', 'domain-capsule', 'host-adapter', 'product-capsule', 'cli-shell',
    ...(fullCli ? ['skill-app-contract', 'page-builder-vue', 'mcp-app', 'cli'] : [])];
  for (const directory of directories) {
    const root = join(product, 'packages', directory);
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const target = join(temporary, directory + '.tgz');
    await run(['pm', 'pack', '--ignore-scripts', '--filename', target], root);
    const bytes = await readFile(target);
    const file = createHash('sha256').update(bytes).digest('hex') + '.tgz';
    await writeFile(join(archiveDirectory, file), bytes, { flag: 'wx' });
    set.artifacts.push({ name: manifest.name, version: manifest.version, file,
      integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'), role: 'product' });
  }
  await writeFile(join(archiveDirectory, 'release-set.json'), JSON.stringify({ digest: releaseSetDigest(set), set }, null, 2), { flag: 'wx' });
  }
  const registry = await openReleaseRegistry(resolve(releaseDirectory), [archiveDirectory]);
  await writeFile(join(temporary, 'empty.npmrc'), '');
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ name: 'codument-immutable-consumer', private: true, type: 'module',
    dependencies: { ...Object.fromEntries(set.artifacts.map(item => [item.name, item.version])),
      ...(fullCli ? { '@modelcontextprotocol/sdk': '^1.30.0' } : {}) } }));
  try { await run(['install', '--save-text-lockfile', '--ignore-scripts', '--registry', registry.url]); }
  finally { await registry.close(); }
  await copyFile(join(import.meta.dir, 'codument-product-consumer.mjs'), join(temporary, 'consumer.mjs'));
  const output = await run(['consumer.mjs']);
  const tests: string[] = [];
  for (const directory of ['domain-logic', 'domain-support', 'domain-capsule', 'product-capsule']) {
    const target = join(temporary, 'node_modules', 'depa-codument-' + directory, 'test');
    await cp(join(product, 'packages', directory, 'test'), target, { recursive: true, errorOnExist: true });
    for (const file of await readdir(target)) if (file.endsWith('.test.ts')) tests.push(join(target, file));
  }
  if (fullCli) {
    const installedCli = join(temporary, 'node_modules/depa-codument-cli');
    for (const file of ['test/cli/domain-app.test.ts', 'test/cli/domain-migration.test.ts', 'test/fixtures/xnl-skill-app.ts']) {
      await mkdir(join(installedCli, file, '..'), { recursive: true });
      await copyFile(join(product, 'packages/cli', file), join(installedCli, file));
    }
    tests.push(join(installedCli, 'test/cli/domain-app.test.ts'));
    tests.push(join(installedCli, 'test/cli/domain-migration.test.ts'));
  }
  const regression = await run(['test', ...tests]);
  const installedWorkspace = join(temporary, 'installed-workspace'); await mkdir(installedWorkspace);
  const installerEntry = join(temporary, 'node_modules/depa-codument-product-capsule/test/fixtures/workspace-install-consumer.ts');
  const installation = await run([installerEntry, installedWorkspace]) + await run([installerEntry, installedWorkspace]);
  // The compiler/type libraries are verification tooling, not product runtime dependencies.
  const compiler = join(product, 'node_modules/typescript/lib/tsc.js');
  await writeFile(join(temporary, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ESNext', module: 'ESNext', moduleResolution: 'bundler', lib: ['ESNext'],
    types: [join(product, 'node_modules/bun-types')], strict: true, noEmit: true,
    allowImportingTsExtensions: true, skipLibCheck: true, esModuleInterop: true,
  }, include: set.artifacts.map(item => `node_modules/${item.name}/src/**/*.ts`), exclude: ['**/src/templates/**'] }));
  const typecheck = await run([compiler, '--project', join(temporary, 'tsconfig.json')]);
  let cli = '';
  if (fullCli) {
    const native = set.artifacts.find(item => item.name === 'depa-codument-skill-app-contract')!;
    const fixtures = JSON.parse(await readFile(join(import.meta.dir, 'legacy-frozen-fixtures.json'), 'utf8'));
    const historical = fixtures.find((item: { id: string }) => item.id === 'codument-extraction');
    const installedArtifact = { name: native.name, version: native.version, integrity: native.integrity, apiVersion: '2' };
    const profile = { id: 'codument-native-forwarder-v1', declaredArtifact: { ...installedArtifact, integrity: historical.artifactIntegrity },
      installedArtifact, semanticIdentity: historical.semanticIdentity, expectedLockDigest: historical.expectedLock.lockDigest };
    await copyFile(join(archiveDirectory, native.file), join(temporary, 'native.tgz'));
    await copyFile(join(import.meta.dir, historical.artifactPath), join(temporary, 'historical.tgz'));
    await writeFile(join(temporary, 'native-compatibility.json'), JSON.stringify({ profile, expectedLock: historical.expectedLock }));
    await copyFile(join(import.meta.dir, 'codument-native-compatibility.mjs'), join(temporary, 'native-compatibility.mjs'));
    cli += await run(['native-compatibility.mjs']);
    await copyFile(join(import.meta.dir, 'codument-product-cli.mjs'), join(temporary, 'product-cli.mjs'));
    cli += await run(['product-cli.mjs']);
    await copyFile(join(import.meta.dir, 'codument-lifecycle-cli.mjs'), join(temporary, 'lifecycle-cli.mjs'));
    cli += await run(['lifecycle-cli.mjs']);
  }
  const receipt = { consumer: 'Codument', releaseDigest: registry.digest, productDigests: registry.productDigests,
    normalRegistryResolution: true, transitiveOverrides: false, sourceImportsInConsumer: false, registryStoppedBeforeRuntime: true };
  await writeFile(join(import.meta.dir, 'logs', label + '.log'), 'exit: 0\n' + JSON.stringify(receipt) + '\n' + output + '\n' + regression + '\ninstaller:\n' + installation + '\ntypecheck exit: 0\n' + typecheck + '\n' + cli, { flag: 'wx' });
  console.log(JSON.stringify(receipt) + '\n' + output + '\n' + regression + '\n' + installation + '\n' + cli);
} catch (error) {
  await writeFile(join(import.meta.dir, 'logs', label + '-failure.log'), String(error), { flag: 'wx' });
  throw error;
} finally { await rm(temporary, { recursive: true, force: true }); }
