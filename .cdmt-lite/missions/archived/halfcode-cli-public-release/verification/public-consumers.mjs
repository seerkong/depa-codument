import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const [release, output] = process.argv.slice(2);
assert.ok(release && output, 'Usage: public-consumers.mjs RELEASE_SET RECEIPT');
const root = realpathSync(mkdtempSync(join(tmpdir(), 'halfcode-npm-consumers-')));
const artifacts = JSON.parse(readFileSync(join(release, 'release-set.json'), 'utf8')).set.artifacts.filter(item => item.role === 'shared');
assert.equal(artifacts.length, 21);
const versions = Object.fromEntries(artifacts.map(item => [item.name, item.version]));
const events = [];
async function run(args, cwd, expected = 0) {
  const index = events.length;
  const child = spawn(args[0], args.slice(1), {
    cwd, env: { ...process.env, NODE_PATH: '', BUN_INSTALL_CACHE_DIR: join(root, 'bun-cache') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chunks = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stderr.on('data', chunk => chunks.push(chunk));
  const deadline = setTimeout(() => child.kill('SIGTERM'), 300000);
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  }).finally(() => clearTimeout(deadline));
  const log = join(root, `command-${index}.log`);
  writeFileSync(log, Buffer.concat(chunks));
  events.push({ args, cwd, code, expected, log });
  writeFileSync(output, JSON.stringify({ root, events }, null, 2));
  console.log(JSON.stringify(events.at(-1)));
  assert.equal(code, expected, 'Command failed; inspect ' + log);
  return Buffer.concat(chunks).toString();
}
const consumer = join(root, 'npm-consumer');
mkdirSync(consumer);
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'public-halfcode-consumer', private: true, type: 'module', dependencies: versions, devDependencies: { typescript: '5.9.3' } }));
await run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', '--cache=' + join(root, 'npm-cache')], consumer);
writeFileSync(join(consumer, 'probe.mjs'), `
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync, realpathSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {createConsumerScaffold} from 'halfcode-lite-cli-logic/clone-scaffold';
const versions=${JSON.stringify(versions)};
for(const name of Object.keys(versions)) {
  assert.ok(realpathSync(Bun.resolveSync(name,process.cwd())).startsWith(process.cwd()+'/node_modules/'));
  // Type-only contracts legitimately have no enumerable runtime exports.
  const exports=await import(name); assert.equal(typeof exports,'object');
}
const generated=join(process.cwd(),'generated');
const scaffold=createConsumerScaffold({bin:'npm-notes',packageName:'npm-notes',displayName:'Npm Notes',description:'Published package proof'},versions);
for(const [relative,content] of Object.entries(scaffold.files)) {const file=join(generated,relative);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,content);}
console.log(JSON.stringify({imported:21,generated}));
`);
await run([process.execPath, 'probe.mjs'], consumer);
const generated = join(consumer, 'generated');
await run([process.execPath, 'install', '--ignore-scripts', '--registry=https://registry.npmjs.org'], generated);
await run([process.execPath, join(consumer, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ESNext', '--module', 'ESNext', '--moduleResolution', 'bundler', 'packages/product-capsule/src/index.ts'], generated);
for (const args of [['about'], ['Resource', 'validate'], ['SOP', 'list'], ['SOP', 'detail', '--fqn', 'NpmNotes.SOP.Review']]) {
  await run([process.execPath, 'packages/cli-shell/src/index.ts', ...args, '--json'], generated);
}
await run([process.execPath, 'packages/cli-shell/src/index.ts', 'unknown-command'], generated, 1);
const product = join(root, 'depa-project');
cpSync('/Users/kongweixian/infra-dev/depa-codument/project', product, {
  recursive: true,
  filter: file => !file.split('/').some(part => ['node_modules', '.git', 'dist', '.cache'].includes(part)),
});
// Snapshot-clone tests deliberately require a Git source. Give the isolated copy its own
// empty repository; never copy or modify the user's real Git metadata.
await run(['git', 'init', '--quiet'], product);
await run([process.execPath, 'install', '--frozen-lockfile', '--ignore-scripts', '--registry=https://registry.npmjs.org'], product);
assert.ok(!/127\.0\.0\.1|localhost|halfcode-lite-cli-host-/.test(readFileSync(join(product, 'bun.lock'), 'utf8')));
for (const command of ['typecheck', 'lint', 'test', 'build']) await run([process.execPath, 'run', command], product);
const workspace = join(root, 'workspace');
mkdirSync(workspace);
const binary = join(product, 'dist/depa-codument');
await run([binary, '--version'], workspace);
await run([binary, 'init-workspace', '--agent=codex', '--json'], workspace);
await run([binary, 'Resource', 'validate', '--json'], workspace);
await run([binary, 'status', '--json'], workspace);
await run([binary, 'discuss', '--help'], workspace);
await run([binary, 'unknown-command'], workspace, 1);
writeFileSync(output, JSON.stringify({ root, passed: true, events }, null, 2));
console.log(JSON.stringify({ root, passed: true, packages: artifacts.length }));
