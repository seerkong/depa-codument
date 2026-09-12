import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { dispatchCommand } from '../../src/cli/command-registry';
import { createHttpApp } from '../../src/cli/http/app';
import { createCommandRuntime } from '../../src/cli/runtime';
import type { PageWorkflowCoordinator, PageWorkflowRun } from '../../src/cli/runtime/page-workflow';
import { writeBundleResources, writePageManifest, writeSkillApp } from '../fixtures/xnl-skill-app';

const ECHO_FQN = 'Codument.Test.LocalFunction.Echo';
const WORKFLOW_FQN = 'Codument.Test.LocalFunction.RunWorkflow';
const CAPABILITY_FQN = 'Codument.Test.LocalFunction.Capabilities';

afterEach(() => { process.exitCode = 0; });

async function writeSkill(root: string, skillId = 'demo', echoFqn = ECHO_FQN): Promise<void> {
  const skill = path.join(root, `.agents/skills/${skillId}`);
  const page = path.join(skill, 'pages/demo-page');
  await writeSkillApp(skill, skillId);
  await fs.mkdir(page, { recursive: true });
  await fs.writeFile(path.join(skill, 'SKILL.md'), `# ${skillId}`);
  const object = (properties: Record<string, unknown>, required: string[] = []) => ({
    type: 'object', properties, required, additionalProperties: false,
  });
  await writeBundleResources(skill, `Test.${skillId}.Bundles`, `
    const api = globalThis.Codument;
    if (!api) throw new Error('Host resource definition API is unavailable');
    export const definitions = [
      api.defineLocalFunction({
        fqn: ${JSON.stringify(echoFqn)}, operation: 'query', description: 'Echo typed input',
        runtimeCapabilities: ['clock'],
        inputSchema: ${JSON.stringify(object({ value: { type: 'string' } }, ['value']))},
        configSchema: ${JSON.stringify({ anyOf: [{ type: 'null' }, object({ prefix: { type: 'string' } })] })},
        outputSchema: ${JSON.stringify(object({ value: { type: 'string' }, prefix: { type: 'string' }, hasClock: { const: true }, hasWorkspace: { const: false } }, ['value', 'prefix', 'hasClock', 'hasWorkspace']))},
        handler(runtime, input, config) {
      return {
        value: input.value,
        prefix: config?.prefix ?? '',
        hasClock: typeof runtime.clock?.now === 'function',
        hasWorkspace: runtime.workspace !== undefined,
      };
        },
      }),
      api.defineLocalFunction({
        fqn: ${JSON.stringify(WORKFLOW_FQN)}, operation: 'action', description: 'Uses PageWorkflow effect',
        runtimeCapabilities: ['pageWorkflow'],
        inputSchema: ${JSON.stringify(object({ fqn: { type: 'string' }, workflowInput: {} }, ['fqn', 'workflowInput']))},
        configSchema: { type: 'null' },
        outputSchema: ${JSON.stringify(object({ runId: { type: 'string' }, fqn: { type: 'string' }, status: { const: 'completed' }, createdAt: { type: 'number' }, updatedAt: { type: 'number' }, result: {} }, ['runId', 'fqn', 'status', 'createdAt', 'updatedAt']))},
        async handler(runtime, input) {
          const run = await runtime.pageWorkflow.start({ fqn: input.fqn, input: input.workflowInput });
          return runtime.pageWorkflow.wait(run.runId, { timeoutMs: 50, intervalMs: 1 });
        },
      }),
      api.defineLocalFunction({
        fqn: ${JSON.stringify(CAPABILITY_FQN)}, operation: 'detail', description: 'Uses confined host effects',
        runtimeCapabilities: ['workspace', 'sqlite', 'clock', 'ids'],
        inputSchema: ${JSON.stringify(object({ database: { type: 'string', minLength: 1 } }, ['database']))},
        configSchema: { type: 'null' },
        outputSchema: ${JSON.stringify(object({ workspace: { const: true }, id: { type: 'string', minLength: 1 }, now: { type: 'number' } }, ['workspace', 'id', 'now']))},
        handler(runtime, input) {
          const database = runtime.sqlite.open(input.database);
          database.exec('create table if not exists probe (value text)');
          database.close();
          return { workspace: typeof runtime.workspace?.readText === 'function', id: runtime.ids.randomUUID(), now: runtime.clock.now() };
        },
      }),
    ];
  `);
  await fs.writeFile(path.join(page, 'index.html'), '<h1>demo</h1>');
  await writePageManifest(page, { fqn: `Test.${skillId}.Page.DemoPage`, name: 'demo-page', description: 'Demo Page', localFunctions: [echoFqn] });
}

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-local-function-'));
  await writeSkill(root);
  return root;
}

describe('local-function first-class runtime', () => {
  test('lists, details and invokes one typed descriptor from CLI with least authority', async () => {
    const runtime = createCommandRuntime(await fixture());
    const listed = await dispatchCommand(['LocalFunction', 'list', '--operation', 'query'], runtime, true);
    expect(listed).toMatchObject({ code: 0, data: { command: 'LocalFunction.list', count: 1 } });
    expect(listed.data?.functions).toEqual([expect.objectContaining({ fqn: ECHO_FQN, operation: 'query', skillId: 'demo' })]);
    const detail = await dispatchCommand(['LocalFunction', 'detail', '--fqn', ECHO_FQN], runtime, true);
    expect(detail).toMatchObject({ code: 0, data: { command: 'LocalFunction.detail', resource: { fqn: ECHO_FQN } } });
    const invoked = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', ECHO_FQN, '--input', '{"value":"hello"}', '--config', '{"prefix":"p:"}',
    ], runtime, true);
    expect(invoked).toMatchObject({
      code: 0,
      data: { command: 'LocalFunction.invoke', result: { value: 'hello', prefix: 'p:', hasClock: true, hasWorkspace: false } },
    });
  });

  test('shares dispatch with a Page allowlist and rejects undeclared FQNs', async () => {
    const app = createHttpApp(createCommandRuntime(await fixture()));
    const allowed = await app.request('/api/pages/demo-page/local-functions/invoke', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fqn: ECHO_FQN, input: { value: 'page' }, config: null }),
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({ ok: true, fqn: ECHO_FQN, result: { value: 'page' } });
    const denied = await app.request('/api/pages/demo-page/local-functions/invoke', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fqn: WORKFLOW_FQN, input: {}, config: null }),
    });
    expect(denied.status).toBe(403);
  });

  test('injects PageWorkflow and validates input/output boundaries', async () => {
    const runtime = createCommandRuntime(await fixture());
    const timestamp = Date.now();
    const completed: PageWorkflowRun = {
      runId: 'pwr_test', fqn: 'Workflow.Test', status: 'completed', createdAt: timestamp, updatedAt: timestamp, result: { rows: 1 },
    };
    runtime.page!.workflows = {
      async start() { return { ...completed, status: 'queued' }; },
      get() { return completed; },
      async wait() { return completed; },
      async close() {},
    } satisfies PageWorkflowCoordinator;
    // The Page/MCP host may inject its existing owner; bare CLI must use the typed Serve port.
    const invoked = await runtime.localFunctions!.invoke(runtime, WORKFLOW_FQN, { fqn: 'Workflow.Test', workflowInput: {} }, null);
    expect(invoked).toMatchObject({ runId: 'pwr_test', status: 'completed' });
    const privateOwner = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', WORKFLOW_FQN, '--input', '{"fqn":"Workflow.Test","workflowInput":{}}',
    ], runtime, true);
    expect(privateOwner).toMatchObject({ code: 1, data: { accepted: false } });
    expect(privateOwner.message).toContain('CLI-private');
    const invalid = await dispatchCommand(['LocalFunction', 'invoke', '--fqn', ECHO_FQN, '--input', '{"value":3}'], runtime, true);
    expect(invalid.code).toBe(1);
    expect(invalid.message).toContain('/value');
  });

  test('injects workspace, sqlite, clock and ids while confining sqlite paths', async () => {
    const root = await fixture();
    const runtime = createCommandRuntime(root);
    const invoked = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', CAPABILITY_FQN, '--input', '{"database":".runtime/probe.sqlite"}',
    ], runtime, true);
    expect(invoked).toMatchObject({ code: 0, data: { result: { workspace: true, id: expect.any(String), now: expect.any(Number) } } });
    expect((await fs.stat(path.join(root, '.runtime/probe.sqlite'))).isFile()).toBe(true);

    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-local-function-outside-'));
    await fs.symlink(outside, path.join(root, 'linked'));
    const escaped = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', CAPABILITY_FQN, '--input', '{"database":"linked/probe.sqlite"}',
    ], createCommandRuntime(root), true);
    expect(escaped.code).toBe(1);
    expect(escaped.message).toContain('contains a symlink');
  });

  test('fails closed for duplicate FQNs and escaping modules', async () => {
    const root = await fixture();
    await writeSkill(root, 'duplicate', ECHO_FQN);
    const duplicate = await dispatchCommand(['LocalFunction', 'list'], createCommandRuntime(root), true);
    expect(duplicate.code).toBe(1);
    expect(duplicate.message).toContain('Duplicate Bundle leaf definition FQN');

    const manifest = path.join(root, '.agents/skills/demo/LocalFunction/manifest.xnl');
    const source = await fs.readFile(manifest, 'utf8');
    await fs.writeFile(manifest, source.replace('vfs://./bundle/index.js', 'vfs://./../SKILL.md'));
    const escaped = await dispatchCommand(['LocalFunction', 'list'], createCommandRuntime(root), true);
    expect(escaped.code).toBe(1);
    expect(escaped.message).toMatch(/Workspace resource catalog is invalid|material read failed/i);
  });
});
