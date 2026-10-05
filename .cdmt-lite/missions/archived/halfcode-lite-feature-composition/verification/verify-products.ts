import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openReleaseRegistry } from '../../../../../project/scripts/verification/release-set';

const [base, depa] = process.argv.slice(2);
assert.ok(base && depa, 'verify-products.ts HALFCODE_RELEASE DEPA_RELEASE');
const registry = await openReleaseRegistry(base, [depa]);
const root = await realpath(await mkdtemp(join(tmpdir(), 'composed-products-')));
const receipts: unknown[] = [];
const depaSet = JSON.parse(await readFile(join(depa, 'release-set.json'), 'utf8'));
const artifacts = [...registry.set.artifacts, ...depaSet.set.artifacts];
async function run(args: string[], cwd: string, expected = 0) {
  const child = Bun.spawn(args, { cwd, env: { ...process.env, NODE_PATH: '',
    CODEX_BIN: '/must-not-start/codex', BUN_INSTALL_CACHE_DIR: join(root, 'cache'),
    npm_config_userconfig: join(root, 'empty.npmrc') }, stdout: 'pipe', stderr: 'pipe' });
  const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    .finally(() => clearTimeout(timer));
  assert.equal(code, expected, JSON.stringify({ args, code, out, err }));
  return out;
}
async function files(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, item.name);
    if (item.isDirectory()) result.push(...await files(file));
    else if (item.isFile()) result.push(file);
    else throw new Error('Unexpected resource symlink: ' + file);
  }
  return result;
}
try {
  await writeFile(join(root, 'empty.npmrc'), '');
  const installed: { family: string; directory: string; entry: string }[] = [];
  for (const family of ['halfcode-lite', 'depa-codument']) {
    const directory = join(root, family);
    await mkdir(directory);
    const name = family + '-cli';
    const artifact = artifacts.find(a => a.name === name);
    assert.ok(artifact, name);
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'isolated-' + family,
      private: true, type: 'module', dependencies: { [name]: artifact.version } }));
    await run([process.execPath, 'install', '--ignore-scripts', '--no-cache', '--registry', registry.url], directory);
    const packageRoot = join(directory, 'node_modules', name);
    assert.ok((await realpath(packageRoot)).startsWith(directory + '/'));
    installed.push({ family, directory, entry: join(packageRoot, 'src/cli/index.ts') });
  }
  // Everything after this point must work without a registry or sibling repo.
  registry.close();
  for (const { family, directory, entry } of installed) {
    const workspace = join(directory, 'workspace');
    await mkdir(workspace);
    const sourceHelp = await run([process.execPath, entry, '-h'], workspace);
    assert.match(sourceHelp, /Resource/);
    assert.doesNotMatch(sourceHelp, /^\s+demo\s+/m);
    const call = async (binary: string[], args: string[], cwd = workspace) =>
      JSON.parse(await run([...binary, '-w', cwd, ...args, '--json'], cwd));
    const source = [process.execPath, entry];
    assert.equal((await call(source, ['init-workspace'])).status, 'initialized');
    assert.equal((await call(source, ['Resource', 'validate'])).valid, true);
    if (family === 'depa-codument') {
      assert.match(sourceHelp, new RegExp('v' + depaSet.productVersion.replaceAll('.', '\\.')));
      await readFile(join(workspace, 'codument/manifest.xnl'));
      await call(source, ['status']);
      const operation = await call(source, ['discuss']);
      assert.match(JSON.stringify(operation), /discuss/i);
    } else {
      await call(source, ['Page', 'list']);
      const result = await call(source, ['LocalFunction', 'invoke', '--fqn', 'HalfcodeAppLite.Demo.Action.Greet', '--input', '{"name":"Packed"}']);
      assert.equal(result.result.message, 'Hello, Packed!');
    }
    // Build from installed tarball bytes. Only resource path layout is restored
    // for the products' documented embedded namespace, never from source repos.
    const staging = join(directory, 'build');
    const cli = join(staging, 'packages/cli');
    await cp(join(directory, 'node_modules', family + '-cli'), cli, { recursive: true });
    const templateRoots = [join(cli, 'src/templates')];
    if (family === 'depa-codument') {
      const target = join(staging, 'packages/product-capsule/src/templates');
      await cp(join(directory, 'node_modules', family + '-product-capsule/src/templates'), target, { recursive: true });
      templateRoots.push(target);
    }
    const resourceFiles = (await Promise.all(templateRoots.map(files))).flat();
    const generated = join(cli, 'src/cli/packaged-entry.ts');
    await writeFile(generated, resourceFiles.map(file => `import ${JSON.stringify(file)} with {type:"file"};`).join('\n')
      + '\n' + await readFile(join(cli, 'src/cli/index.ts'), 'utf8').then(text => text.replace(/^#![^\n]*\n/, '')));
    const binary = join(directory, family);
    const build = await Bun.build({ entrypoints: [generated], compile: { outfile: binary }, root: staging,
      naming: { asset: 'resource/[dir]/[name].[ext]' } });
    assert.ok(build.success, build.logs.map(String).join('\n'));
    // Hide the staged templates to prove the executable uses embedded assets.
    await rename(staging, staging + '-not-runtime');
    const binaryRoot = join(directory, 'binary-workspace');
    await mkdir(binaryRoot);
    assert.equal((await call([binary], ['init-workspace'], binaryRoot)).status, 'initialized');
    assert.equal((await call([binary], ['Resource', 'validate'], binaryRoot)).valid, true);
    if (family === 'depa-codument') {
      await call([binary], ['status'], binaryRoot);
      await call([binary], ['discuss'], binaryRoot);
      const legacy = join(directory, 'legacy-workspace');
      await mkdir(join(legacy, 'codument/config'), { recursive: true });
      const old = '<AttractorProfiles><Profile name="custom" enabled="true"/></AttractorProfiles>';
      await writeFile(join(legacy, 'codument/config/attractor-profiles.xml'), old);
      const upgraded = await call([binary], ['upgrade-workspace'], legacy);
      assert.equal(upgraded.status, 'upgraded');
      assert.equal(await readFile(join(upgraded.backupRoot, 'config/attractor-profiles.xml'), 'utf8'), old);
      assert.equal((await call([binary], ['upgrade-workspace'], legacy)).appStatus, 'noop');
      assert.ok(!(await readdir(join(legacy, 'codument'))).includes('std'));
    }
    receipts.push({ family, sourceCommands: true, tarballBuild: true, embeddedAssets: resourceFiles.length,
      compiledCommands: true, ...(family === 'depa-codument' ? { historicalUpgrade: true, backupPreserved: true, idempotent: true } : {}) });
  }
  console.log(JSON.stringify({ root, baseDigest: registry.digest, productDigests: registry.productDigests,
    requests: registry.requests.length, receipts, globalWrites: false, published: false }, null, 2));
} finally { registry.close(); }
