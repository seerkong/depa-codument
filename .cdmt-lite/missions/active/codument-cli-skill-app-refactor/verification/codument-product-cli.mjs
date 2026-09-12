import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Run only installed artifacts. All global installation is redirected to an isolated home.
const consumer = process.cwd();
const packageRoot = join(consumer, 'node_modules/depa-codument-cli');
assert.ok((await realpath(packageRoot)).startsWith(consumer + '/'));
const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
assert.deepEqual(Object.keys(manifest.bin), ['depa-codument']);
const entry = resolve(packageRoot, manifest.bin['depa-codument']);
const root = join(consumer, 'product-workspace');
await mkdir(root);
const env = { ...process.env, NODE_PATH: '', CODUMENT_HOME: join(consumer, 'isolated-home'), CODEX_BIN: '/must-not-start/codex', CODUMENT_EGO_TASK_SPACE: '', CODUMENT_SERVER_INSTANCE_ID: '' };
async function cli(args) {
  const child = Bun.spawn([process.execPath, entry, '-w', root, ...args, '--json'], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' });
  const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    assert.equal(code, 0, stdout + stderr);
    assert.equal(stderr, '');
    return JSON.parse(stdout);
  } finally { clearTimeout(timer); }
}
assert.equal((await cli(['demo', 'Packed'])).name, 'Packed');
assert.deepEqual(await readdir(root), []);
assert.equal((await cli(['init'])).status, 'initialized');
assert.equal((await cli(['status'])).product.status, 'No Tracks');
assert.equal((await cli(['upgrade-workspace'])).phase, 'complete');
assert.ok(!(await readdir(join(root, 'codument'))).includes('std'));
const guidanceRoot = join(env.CODUMENT_HOME, '.agents/skills/depa-codument');
const operations = await readdir(join(guidanceRoot, 'operations'));
assert.equal(operations.length, 15);
for (const file of operations) {
  const source = await readFile(join(guidanceRoot, 'operations', file), 'utf8');
  const name = source.match(/^\s*command:\s*(.+)$/m)?.[1]?.replaceAll('"', '');
  assert.ok(name, file);
  assert.equal((await cli([name])).status, 'guidance');
}
// The optional example is an explicit consumer fixture, never an init side effect.
await cp(join(packageRoot, 'src/templates/agents/workspace/skills/codument-demo'), join(root, '.agents/skills/codument-demo'), { recursive: true });
assert.equal((await cli(['Resource', 'validate'])).valid, true);
assert.equal((await cli(['LocalFunction', 'invoke', '--fqn', 'Codument.Demo.Action.Greet', '--input', '{"name":"Packed"}'])).result.message, 'Hello, Packed!');
const listed = await cli(['Page', 'list']);
assert.ok(listed.pages.length > 0);

const child = Bun.spawn([process.execPath, entry, '-w', root, 'serve', '--port', '0', '--json'], {
  cwd: root, env: { ...env, CODUMENT_SERVER_INSTANCE_ID: 'packed-product' },
  stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
});
const deadline = setTimeout(() => child.kill('SIGKILL'), 30_000);
const reader = child.stdout.getReader();
const errors = new Response(child.stderr).text();
let text = '';
let serve;
try {
  while (!serve) {
    const chunk = await reader.read();
    assert.equal(chunk.done, false, 'Serve exited before readiness');
    text += new TextDecoder().decode(chunk.value);
    try { serve = JSON.parse(text); } catch { /* Wait for the complete product JSON result. */ }
  }
  assert.equal(serve.ok, true);
  const health = await (await fetch(new URL('/api/health', serve.url))).json();
  assert.equal(health.ok, true);
  const pages = await (await fetch(new URL('/api/pages', serve.url))).json();
  assert.deepEqual(pages.pages.map(page => page.name), listed.pages.map(page => page.name));
  const page = pages.pages.find(candidate => candidate.status === 'ready');
  assert.ok(page);
  assert.equal((await fetch(new URL('/pages/' + page.name, serve.url))).status, 200);
  assert.equal((await fetch(new URL('/page-content/' + page.name + '/../../secret', serve.url))).status, 404);
  const vue = pages.pages.find(candidate => candidate.runtime?.framework === 'vue');
  assert.ok(vue, 'Packed templates must contain a real Vue Page');
  const opened = await fetch(new URL('/api/pages/' + vue.name + '/open', serve.url), { method: 'POST' });
  assert.equal(opened.status, 200, await opened.text());
  const buildDeadline = Date.now() + 15_000;
  let built;
  while (Date.now() < buildDeadline) {
    built = await (await fetch(new URL('/api/pages/' + vue.name + '/registry', serve.url))).json();
    if (built.runtime?.buildStatus === 'ready') break;
    assert.ok(!['error', 'unavailable'].includes(built.runtime?.buildStatus), JSON.stringify(built));
    await Bun.sleep(40);
  }
  assert.equal(built.runtime.buildStatus, 'ready');
  assert.equal((await fetch(new URL(built.runtime.remoteEntryUrl, serve.url))).status, 200);
  assert.equal((await fetch(new URL('/page-frame/' + vue.name + '/' + built.runtime.generation, serve.url))).status, 200);
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  const code = await child.exited;
  clearTimeout(deadline);
  reader.releaseLock();
  assert.equal(code, 0, await errors);
}
const transport = new StdioClientTransport({
  command: process.execPath, args: [entry, '-w', root, 'mcp-app', 'serve'], cwd: root, env, stderr: 'pipe',
});
const mcp = new Client({ name: 'packed-proof', version: '1' });
try {
  await mcp.connect(transport);
  const tools = await mcp.listTools();
  assert.equal(tools.tools.find(tool => tool.name === 'open_page')._meta.ui.resourceUri, 'ui://codument/pages/app.html');
  const resource = await mcp.readResource({ uri: 'ui://codument/pages/app.html' });
  assert.ok(resource.contents[0].text.includes('"name":"codument-page"'));
} finally { await mcp.close(); }
console.log(JSON.stringify({ packedCodumentCli: true, sourceAliases: false, productTemplates: true, threeProductCommands: true, commandOperations: 15,
  resourceValidation: true, localFunction: true, pageHttp: true, nativeVueBuild: true, nativeMcpIdentity: true, serveGracefulExit: true,
  globalInit: 'ISOLATED_HOME', realBrowser: 'NOT_RUN', publishedToNpm: false }));
