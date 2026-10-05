import { afterEach, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { commandExecutionPolicy, commandPaths, dispatchCommand } from '../../src/cli/command-registry';
import { createCliCommandRuntime, createCommandRuntime } from '../../src/cli/runtime';
import { localFunctionPlacement } from 'halfcode-lite-skill-app-logic/local-function';
import { createHttpApp } from '../../src/cli/http/app';
import { LOCAL_FUNCTION_SERVE_PATH, invokeServeLocalFunction, prepareLocalFunctionExecution } from '../../src/cli/runtime/local-function-execution';
import { writePageControlRecord } from '../../src/cli/runtime/serve-process';
import { skillAppKindDefinitionSource, writeBundleResources, writePageManifest, writeSkillApp, writeSop } from '../fixtures/xnl-skill-app';
import type { CommandRuntime } from '../../src/cli/contracts/command';
import { assertLocalBrowserBinding } from '../../src/cli/runtime/browser-execution';
import { placementForExecutionLifetime } from 'halfcode-lite-cli-logic';

const roots: string[] = [];
const runtimes: CommandRuntime[] = [];
afterEach(async () => {
  process.exitCode = 0;
  await Promise.all(runtimes.splice(0).map(runtime => runtime.close?.()));
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'codument-placement-')));
  roots.push(root);
  const skill = path.join(root, '.agents/skills/fixture');
  await writeSkillApp(skill, 'fixture');
  await writeBundleResources(skill, 'Test.Placement.Bundle', `
    const api = globalThis.Codument;
    export const definitions = [
      api.defineLocalFunction({ fqn: 'Test.Placement.Local', description: 'Local SQLite', operation: 'action',
        runtimeCapabilities: ['workspace', 'sqlite'], inputSchema: { type: 'null' }, configSchema: { type: 'null' }, outputSchema: { type: 'string' },
        handler(runtime) {
          const db = runtime.sqlite.open('probe.sqlite');
          db.exec('create table if not exists probe(value text)');
          db.close();
          return 'local';
        }
      }),
      api.defineLocalFunction({ fqn: 'Test.Placement.Live', description: 'Live owner', operation: 'action',
        runtimeCapabilities: ['pageWorkflow'], inputSchema: { type: 'null' }, configSchema: { type: 'null' }, outputSchema: { type: 'string' },
        handler(runtime) { return runtime.pageWorkflow.get('owned')?.runId ?? 'missing'; }
      }),
      api.defineLocalFunction({ fqn: 'Test.Placement.Targets', description: 'Page-only', operation: 'query',
        runtimeCapabilities: ['pageTargets'], inputSchema: { type: 'null' }, configSchema: { type: 'null' }, outputSchema: { type: 'null' },
        handler() { throw new Error('must not execute from CLI'); }
      })
    ];
  `);
  const page = path.join(skill, 'pages/probe');
  await writePageManifest(page, { name: 'probe', description: 'Projection only' });
  await fs.writeFile(path.join(page, 'index.html'), '<h1>probe</h1>');
  await writeSop(skill, 'Test.Placement.SOP.Probe', 'probe.md', 'Read the fixture.');
  return root;
}

function runtimeFor(root: string, command: string[]) {
  const runtime = createCliCommandRuntime(root, commandExecutionPolicy(command));
  runtimes.push(runtime);
  return runtime;
}

function forbiddenServe(runtime: CommandRuntime) {
  const forbidden = () => { throw new Error('LOCAL COMMAND ACQUIRED SERVE'); };
  Object.defineProperties(runtime, Object.fromEntries(['serveProcess', 'httpFetch', 'httpServer', 'codex', 'ego', 'invokeServeLocalFunction']
    .map(key => [key, { get: forbidden }])));
}

test('every executable command has an exact policy; groups do not inherit; unsupported runtime policy fails closed', () => {
  let executables = 0;
  for (const command of commandPaths()) {
    try {
      const policy = commandExecutionPolicy(command);
      expect(policy.runtimeProfile).toBeTruthy();
      executables++;
    } catch (error) {
      expect(String(error)).toContain('Missing subcommand');
    }
  }
  expect(executables).toBeGreaterThan(40);
  expect(commandExecutionPolicy(['serve']).placement).toBe('entrypoint');
  expect(commandExecutionPolicy(['serve', 'status']).runtimeProfile).toBe('serve-manager');
  expect(commandExecutionPolicy(['PageWorkflow', 'list']).placement).toBe('local');
  expect(commandExecutionPolicy(['PageWorkflow', 'get']).placement).toBe('serve-required');
  expect(() => commandExecutionPolicy(['Resource', 'missing'])).toThrow();
  expect(() => createCliCommandRuntime('.', { placement: 'local', runtimeProfile: 'serve-manager' })).toThrow('Unsupported');
  expect(() => createCliCommandRuntime('.', { placement: 'local', runtimeProfile: '__proto__' })).toThrow('Unsupported');
  expect(localFunctionPlacement(['database', 'configuration'])).toBe('local');
  expect(localFunctionPlacement(['pageWorkflow'])).toBe('serve-required');
  expect(() => localFunctionPlacement(['pageTargets'])).toThrow('Page/MCP');
  expect(() => localFunctionPlacement(['invented'])).toThrow('Unsupported');
  for (const selection of [
    { transport: 'ego-browser' }, { transport: 'opencli', backend: { transport: 'plugin' } },
    { transport: 'opencli', backend: { transport: 'browser-eval' } },
    { transport: 'mdd-browser-robot', backend: { transport: 'chrome-extension' } },
  ] as const) expect(() => assertLocalBrowserBinding(selection)).not.toThrow();
  expect(() => assertLocalBrowserBinding({ transport: 'opencli', backend: { transport: 'unknown' } })).toThrow('Unknown');
  expect(() => assertLocalBrowserBinding({ transport: 'ego-browser', backend: { lifetime: 'one-shot' } })).toThrow('Unknown');
  expect(placementForExecutionLifetime('external-owned')).toBe('local');
  expect(placementForExecutionLifetime('host-persistent')).toBe('serve-required');
  expect(() => placementForExecutionLifetime('unknown')).toThrow('Unknown');
});

test('Serve manager, Serve child and MCP connection have distinct ownership closures', async () => {
  const root = await fixture();
  const manager = runtimeFor(root, ['serve', 'status']);
  expect(manager.serveProcess).toBeDefined();
  expect(manager.page).toBeUndefined();
  expect(manager.codex).toBeUndefined();
  expect(manager.httpServer).toBeUndefined();
  const child = createCliCommandRuntime(root, commandExecutionPolicy(['serve']), { serveChild: true });
  runtimes.push(child);
  expect(child.httpServer).toBeDefined();
  expect(child.page?.workflows).toBeDefined();
  const mcp = runtimeFor(root, ['mcp-app', 'serve']);
  expect(mcp.page?.workflows).toBeDefined();
  expect(mcp.page?.workflows).not.toBe(child.page?.workflows);
  expect(mcp.httpServer).toBeUndefined();
  expect(mcp.httpFetch).toBeUndefined();
  expect(mcp.serveProcess).toBeUndefined();
  expect(mcp.codex).toBeUndefined();
  const firstClose = mcp.close!();
  expect(mcp.close!()).toBe(firstClose);
  await firstClose;
});

test('real catalog, SOP, Page projection and SQLite commands work with throwing Serve sentinels', async () => {
  const root = await fixture();
  for (const command of [
    ['Resource', 'tree'], ['Resource', 'validate'], ['SOP', 'list'], ['SOP', 'detail', '--fqn', 'Test.Placement.SOP.Probe'],
    ['Page', 'list'], ['LocalFunction', 'list'], ['LocalFunction', 'detail', '--fqn', 'Test.Placement.Local'],
    ['LocalFunction', 'invoke', '--fqn', 'Test.Placement.Local', '--input', 'null'],
  ]) {
    const runtime = runtimeFor(root, command);
    expect(runtime.page?.workflows).toBeUndefined();
    expect(runtime.page?.supervisor).toBeUndefined();
    expect(runtime.codex).toBeUndefined();
    expect(runtime.httpServer).toBeUndefined();
    forbiddenServe(runtime);
    expect((await dispatchCommand(command, runtime, true)).code).toBe(0);
  }
  expect((await fs.stat(path.join(root, 'probe.sqlite'))).isFile()).toBe(true);
  expect(await fs.readdir(root)).not.toContain('codument'); // no implicit product init
});

test('production CLI subprocess runs without Serve records or implicit initialization', async () => {
  const root = await fixture();
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'),
    '-w', root, 'LocalFunction', 'invoke', '--fqn', 'Test.Placement.Local', '--input', 'null', '--json'], {
    stdout: 'pipe', stderr: 'pipe', env: { ...process.env, CODUMENT_EGO_TASK_SPACE: 'must-not-acquire-live-owner' },
  });
  const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ exit, stderr }).toEqual({ exit: 0, stderr: '' });
  expect(JSON.parse(stdout)).toMatchObject({ ok: true, result: 'local' });
  await expect(fs.stat(path.join(root, '.codument/page-control-codex.json'))).rejects.toThrow();
});

test('CLI never borrows a private workflow owner and rejects Page target capabilities before transport', async () => {
  const root = await fixture();
  for (const [fqn, message] of [['Test.Placement.Live', 'serve start'], ['Test.Placement.Targets', 'Page/MCP']]) {
    const command = ['LocalFunction', 'invoke', '--fqn', fqn, '--input', 'null'];
    const result = await dispatchCommand(command, runtimeFor(root, command), true);
    expect(result).toMatchObject({ code: 1, data: { accepted: false } });
    expect(result.message).toContain(message);
  }
});

test('PageWorkflow start rejects unknown resources before its existing auto-start path', async () => {
  const root = await fixture();
  const command = ['PageWorkflow', 'start', '--fqn', 'Test.Missing', '--input', '{}'];
  const runtime = runtimeFor(root, command);
  forbiddenServe(runtime);
  const result = await dispatchCommand(command, runtime, true);
  expect(result).toMatchObject({ code: 1, data: { accepted: false } });
  expect(result.message).toContain('definition was not found');
});

test.each([false, true])('production CLI uses loopback HTTP and preserves the server owner (symlink workspace: %s)', async (useSymlink) => {
  const root = await fixture();
  const aliasParent = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-placement-alias-'));
  roots.push(aliasParent);
  const parentLink = path.join(aliasParent, 'parent');
  await fs.symlink(path.dirname(root), parentLink);
  const alias = path.join(parentLink, path.basename(root));
  const host = createCommandRuntime(useSymlink ? alias : root);
  runtimes.push(host);
  let calls = 0;
  host.page!.workflows = {
    async start() { throw new Error('not used'); }, async wait() { throw new Error('not used'); }, async close() {},
    get() { calls++; return { runId: 'owned', fqn: 'Test.Workflow', status: 'completed', createdAt: 1, updatedAt: 1 }; },
  };
  let app: ReturnType<typeof createHttpApp>;
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: request => app.fetch(request) });
  try {
    const instance = { serverInstanceId: 'loopback-instance', pid: process.pid, host: '127.0.0.1', port: server.port!, url: server.url.origin };
    await writePageControlRecord(host.workspace(), { ...instance, agent: 'codex', threadId: null, threadLocked: false });
    app = createHttpApp(host, undefined, undefined, { serveInstance: instance });
    const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'),
      '-w', root, 'LocalFunction', 'invoke', '--fqn', 'Test.Placement.Live', '--input', 'null', '--json'], {
      stdout: 'pipe', stderr: 'pipe',
    });
    const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    if (exit !== 0) throw new Error('Live CLI failed: ' + stdout + stderr);
    expect({ exit, stderr }).toEqual({ exit: 0, stderr: '' });
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, accepted: true, result: 'owned' });
    expect(calls).toBe(1);
    expect(host.page!.workflows.get('owned')?.runId).toBe('owned');
  } finally { await server.stop(true); }
});

test('admission pins the selected profile and invalidates its proof when profile material changes', async () => {
  const root = await fixture();
  const skill = path.join(root, '.agents/skills/fixture');
  const manifest = path.join(skill, 'manifest.xnl');
  await fs.mkdir(path.join(skill, 'KindDefinitions/ConfigurationProfile'), { recursive: true });
  await fs.writeFile(path.join(skill, 'KindDefinitions/ConfigurationProfile/manifest.xnl'), skillAppKindDefinitionSource('ConfigurationProfile'));
  await fs.writeFile(manifest, (await fs.readFile(manifest, 'utf8')).replace('  ]>',
    '    <ManifestResourceCatalog #profiles { resourceKind = "ConfigurationProfile" root = "vfs://./profiles/" entry = "manifest.xnl" }>\n  ]>'));
  const profile = path.join(skill, 'profiles/personal');
  await fs.mkdir(path.join(profile, 'app'), { recursive: true });
  await fs.writeFile(path.join(profile, 'manifest.xnl'), '<ConfigurationProfile #Test.Profile.Personal envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 { profile = "personal" }>');
  const binding = path.join(profile, 'app/flag.yaml');
  const config = 'envelopeVersion: halfcode.resource-envelope/v1\nspecVersion: 1\nkind: ConfigBinding\nfqn: Test.Config.Flag\nspec:\n  targetRef:\n    kind: AppConfiguration\n    name: flag\n  value: original\n';
  await fs.writeFile(binding, config);
  const source = path.join(skill, 'LocalFunction/bundle/index.js');
  await fs.writeFile(source, (await fs.readFile(source, 'utf8'))
    .replace("runtimeCapabilities: ['pageWorkflow']", "runtimeCapabilities: ['pageWorkflow', 'configuration'], appConfigurationRefs: ['flag']")
    .replace("runtime.pageWorkflow.get('owned')?.runId ?? 'missing'", "runtime.resources.configuration.app.get('flag')"));
  const host = createCommandRuntime(root);
  runtimes.push(host);
  const first = await prepareLocalFunctionExecution(host, 'Test.Placement.Live', 'personal');
  await fs.writeFile(binding, config.replace('value: original', 'value: changed'));
  const next = await prepareLocalFunctionExecution(host, 'Test.Placement.Live', 'personal');
  expect(next.admissionDigest).not.toBe(first.admissionDigest);
  expect(await first.invoke(null, null)).toBe('original');
  expect(await next.invoke(null, null)).toBe('changed');
  await expect(prepareLocalFunctionExecution(host, 'Test.Placement.Live', 'missing')).rejects.toMatchObject({ code: 'PROFILE_UNRESOLVED' });
});

test('typed Serve ingress checks instance, scope, placement and source proof, then invokes the existing owner exactly once', async () => {
  const root = await fixture();
  const host = createCommandRuntime(root);
  runtimes.push(host);
  let calls = 0;
  host.page!.workflows = {
    async start() { throw new Error('not used'); }, async wait() { throw new Error('not used'); }, async close() {},
    get() { calls++; return { runId: 'owned', fqn: 'Test.Workflow', status: 'completed', createdAt: 1, updatedAt: 1 }; },
  };
  const instance = { serverInstanceId: 'instance-a', pid: process.pid, host: '127.0.0.1', port: 49123, url: 'http://127.0.0.1:49123' };
  await writePageControlRecord(host.workspace(), { ...instance, agent: 'codex', threadId: null, threadLocked: false });
  const app = createHttpApp(host, undefined, undefined, { serveInstance: instance });
  const client = runtimeFor(root, ['LocalFunction', 'invoke']);
  const admitted = await prepareLocalFunctionExecution(client, 'Test.Placement.Live');
  const request = {
    protocol: 'local-function-invoke/v1', fqn: 'Test.Placement.Live', input: null, config: null, profile: null,
    admissionDigest: admitted.admissionDigest, workspaceRoot: root, agent: 'codex', serverInstanceId: instance.serverInstanceId,
  };
  for (const changed of [
    { serverInstanceId: 'stale' }, { agent: 'other' }, { workspaceRoot: '/different' }, { admissionDigest: 'stale' },
    { fqn: 'Test.Placement.Local' }, { fqn: 'Test.Placement.Targets' }, { code: 'arbitrary code' }, { placement: 'local' },
  ]) {
    const response = await app.request(LOCAL_FUNCTION_SERVE_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...request, ...changed }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ accepted: false });
  }
  const fromPage = await app.request(LOCAL_FUNCTION_SERVE_PATH, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://example.test' }, body: JSON.stringify(request) });
  expect(fromPage.status).toBe(403);
  expect(await fromPage.json()).toMatchObject({ accepted: false, code: 'PAGE_SCOPED_INGRESS_REQUIRED' });
  expect(calls).toBe(0);
  let posts = 0;
  client.serveProcess = {
    async start() { throw new Error('must not start'); }, async stop() { throw new Error('must not stop'); }, isAlive: () => true, probeHealth: async () => true,
  };
  let probes = 0;
  client.httpFetch = (async (url, init) => {
    if (init?.method === 'POST') posts++; else probes++;
    return app.request(String(url), init);
  }) as typeof fetch;
  const invocation = { fqn: request.fqn, input: null, config: null, profile: null, admissionDigest: request.admissionDigest };
  expect(await invokeServeLocalFunction(client, invocation)).toBe('owned');
  expect(calls).toBe(1);
  expect(posts).toBe(1);
  expect(probes).toBe(1);
  client.httpFetch = Object.assign(async () => { posts++; throw new Error('timeout, outcome unknown'); }, { preconnect: fetch.preconnect });
  await expect(invokeServeLocalFunction(client, invocation)).rejects.toThrow('outcome unknown');
  expect(posts).toBe(2); // no automatic retry, no local fallback
  expect(calls).toBe(1);
  const source = path.join(root, '.agents/skills/fixture/LocalFunction/bundle/index.js');
  await fs.writeFile(source, (await fs.readFile(source, 'utf8')).replace('Live owner', 'Changed owner'));
  const stale = await app.request(LOCAL_FUNCTION_SERVE_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  expect(stale.status).toBe(409);
  expect(calls).toBe(1);
});
