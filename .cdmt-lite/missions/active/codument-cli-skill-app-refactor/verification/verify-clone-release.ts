import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openReleaseRegistry} from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/release-set';

const label = process.argv[2];
const release = process.argv[3];
assert.ok(label && /^[a-z0-9-]+$/.test(label) && release?.startsWith('/'));
const producer = process.argv[4] ?? '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite';
const temporary = await mkdtemp(join(tmpdir(), 'clone-release-consumer-'));
const log: string[] = [];
const registry = await openReleaseRegistry(release);
async function command(args: string[], cwd: string, executable = process.execPath) {
  const child = Bun.spawn([executable, ...args], {cwd, env: {...process.env, NODE_PATH: '', BUN_INSTALL_CACHE_DIR: join(temporary, 'cache'), PATH: '/Users/kongweixian/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'}, stdout: 'pipe', stderr: 'pipe'});
  const timer = setTimeout(() => child.kill('SIGKILL'), 90_000);
  const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
  log.push(JSON.stringify({args, cwd, code}) + '\n' + out + '\n' + error);
  assert.equal(code, 0, error + out);
  return out;
}
try {
  const first = join(temporary, 'first');
  const second = join(temporary, 'second');
  await command([join(producer, 'scripts/clone.ts'), first, '--bin', 'notes', '--package', 'notes-demo'], producer);
  await command(['install', '--ignore-scripts', '--registry', registry.url], first);
  await command(['run', '--no-install', join(first, 'scripts/clone.ts'), second, '--bin', 'tasks', '--package', 'tasks-demo'], first);
  await command(['install', '--ignore-scripts', '--registry', registry.url], second);
  registry.close();
  for (const [root, bin, prefix] of [[first, 'notes', 'notes-demo'], [second, 'tasks', 'tasks-demo']]) {
    const shell = join(root, 'packages/cli-shell/src/index.ts');
    const about = JSON.parse(await command(['run', '--no-install', shell, 'about', '--json'], root));
    assert.equal(about.bin, bin);
    assert.equal(about.packageName, prefix);
    const catalog = JSON.parse(await command(['run', '--no-install', shell, 'resources', '--json'], root));
    assert.equal(catalog.ready, true);
    assert.ok(catalog.resources.some((entry: {kind: string}) => entry.kind === 'Page'));
    assert.deepEqual((await readdir(join(root, 'packages'))).sort(), ['cli-shell', 'product-capsule']);
    const receipt = JSON.parse(await readFile(join(root, '.clone-scaffold.json'), 'utf8'));
    assert.equal(receipt.installed, false); // Generation receipt never claims the later install.
    assert.equal(receipt.identity.bin, bin);
    for (const [name, version] of Object.entries(receipt.dependencies)) {
      const artifact = registry.set.artifacts.find(item => item.name === name && item.version === version);
      assert.ok(artifact);
      const lock = await readFile(join(root, 'bun.lock'), 'utf8');
      assert.ok(lock.includes(artifact.integrity), 'Installed public SRI must match fixed set: ' + name);
    }
    const probe = join(root, 'probe.ts');
    await writeFile(probe, `import assert from 'node:assert/strict';
import {createProductHost} from './packages/product-capsule/src';
globalThis.fetch = () => { throw new Error('Catalog or basic command attempted HTTP'); };
const host = createProductHost();
try {
  assert.equal((await host.dispatch(['about'], process.cwd())).code, 0);
  assert.equal((await host.dispatch(['resources'], process.cwd())).code, 0);
} finally {await Promise.all([host.dispose(), host.dispose()]);}
await assert.rejects(host.dispatch(['resources'], process.cwd()), /disposed/);
console.log('local-only owned-close verified');
`);
    await command(['run', '--no-install', probe], root);
    const snapshotProbe = join(root, 'snapshot-probe.ts');
    await writeFile(snapshotProbe, `import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {execFileSync} from 'node:child_process';
import {cloneSnapshot} from 'halfcode-cli-lite-cli-host-logic/clone';
import {createGitSnapshotClonePort} from 'halfcode-cli-lite-cli-host-support/clone';
const repo = path.join(process.cwd(), 'snapshot-fixture');
const sourceRoot = path.join(repo, 'project');
fs.mkdirSync(path.join(sourceRoot, 'packages/product-capsule/src'), {recursive: true});
execFileSync('git', ['init', '-q', repo]);
fs.writeFileSync(path.join(sourceRoot, '.gitignore'), '*.lock\\nignored/\\n');
fs.writeFileSync(path.join(sourceRoot, 'changed.ts'), 'index bytes');
fs.mkdirSync(path.join(sourceRoot, 'ignored'));
fs.writeFileSync(path.join(sourceRoot, 'ignored/tracked'), 'index tracked ignored');
execFileSync('git', ['-C', sourceRoot, 'add', '-f', 'changed.ts', 'ignored/tracked']);
fs.writeFileSync(path.join(sourceRoot, 'changed.ts'), 'working bytes');
fs.writeFileSync(path.join(sourceRoot, 'ignored/tracked'), 'current tracked ignored');
fs.writeFileSync(path.join(sourceRoot, 'ignored/untracked'), 'must not copy');
fs.writeFileSync(path.join(sourceRoot, 'bun.lock'), 'original ignored lock');
fs.copyFileSync('package.json', path.join(sourceRoot, 'package.json'));
fs.copyFileSync('packages/product-capsule/package.json', path.join(sourceRoot, 'packages/product-capsule/package.json'));
fs.copyFileSync('packages/product-capsule/src/identity.ts', path.join(sourceRoot, 'packages/product-capsule/src/identity.ts'));
const sourcePolicy = {roots: ['packages', 'package.json', 'bun.lock', 'changed.ts'], excludedSegments: [], excludedPaths: []};
for (const mode of ['source-only', 'full'] as const) {
  const result = await cloneSnapshot({snapshots: createGitSnapshotClonePort()}, {sourceRoot, destination: path.join(process.cwd(), mode), mode, sourcePolicy});
  assert.equal(fs.readFileSync(path.join(result.destination, 'changed.ts'), 'utf8'), 'working bytes');
  assert.equal(fs.readFileSync(path.join(result.destination, 'bun.lock'), 'utf8'), 'original ignored lock');
  assert.equal(result.receipt.included.find(entry => entry.path === 'bun.lock')?.additionalSource, 'original-lock');
  assert.equal(fs.existsSync(path.join(result.destination, 'ignored/untracked')), false);
  if (mode === 'full') assert.equal(fs.readFileSync(path.join(result.destination, 'ignored/tracked'), 'utf8'), 'current tracked ignored');
}
const renamed = await cloneSnapshot({snapshots: createGitSnapshotClonePort()}, {sourceRoot, destination: path.join(process.cwd(), 'rebranded'), mode: 'full', sourcePolicy, metadataRebrand: {identityFile: 'packages/product-capsule/src/identity.ts', identity: {bin: 'renamed', packageName: 'renamed-product', displayName: 'Renamed', description: 'Explicit metadata change'}}});
assert.ok(renamed.rebrandReceiptPath);
const rebrand = JSON.parse(fs.readFileSync(renamed.rebrandReceiptPath, 'utf8'));
assert.equal(rebrand.runtimeCompatibility, 'review-required');
assert.equal(rebrand.resolution, 'required-before-build');
assert.equal(rebrand.changes.length, 2);
assert.equal(fs.readFileSync(path.join(renamed.destination, 'bun.lock'), 'utf8'), 'original ignored lock');
for (const change of rebrand.changes) assert.deepEqual(fs.readFileSync(path.join(renamed.destination, change.backup)), fs.readFileSync(path.join(sourceRoot, change.path)));
console.log('installed snapshot modes, ignored lock and independent rebrand receipts verified');
`);
    await command(['run', '--no-install', snapshotProbe], root);
    const typecheck = '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/node_modules/typescript/bin/tsc';
    await command([typecheck, '--noEmit', '--strict', '--skipLibCheck', '--target', 'ESNext', '--module', 'ESNext', '--moduleResolution', 'bundler', '--types', 'bun-types', '--typeRoots', '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/node_modules', shell, join(root, 'scripts/clone.ts')], root);
    await command(['/Users/kongweixian/.codex/skills/.system/skill-creator/scripts/quick_validate.py', join(root, 'app')], root, '/usr/bin/python3');
  }
  log.push(JSON.stringify({release: registry.digest, producer, normalTransitiveInstall: true, generations: 2, productPackagesPerConsumer: 2, noKindDefinitions: true, noSourceLinks: true, closedRegistryBeforeRuntime: true, publishedToNpm: false}));
} finally {
  registry.close();
  await mkdir(join(import.meta.dir, 'logs'), {recursive: true});
  await writeFile(join(import.meta.dir, 'logs', label + '.log'), log.join('\n'), {flag: 'wx'});
  await rm(temporary, {recursive: true, force: true});
}
console.log(log.at(-1));
