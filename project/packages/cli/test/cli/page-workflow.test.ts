import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandRuntime } from '../../src/cli/contracts/command';
import type { EgoBrowserSupervisor } from '../../src/cli/runtime/ego-supervisor';
import {
  createPageWorkflowCoordinator,
  createPageAutomationCatalog,
  invokeInstalledPageObjectAction,
  listPageAutomationRegistry,
  type PageWorkflowCoordinator,
} from '../../src/cli/runtime/page-workflow';
import { createPageInstanceHub } from '../../src/cli/http/page-instances';
import { createPageInstanceTargetPort } from '../../src/cli/runtime/page-target';
import { createMcpPageTargetStore } from 'depa-codument-mcp-app-capsule';
import { dispatchCommand } from '../../src/cli/command-registry';
import { createCommandRuntime } from '../../src/cli/runtime';
import { writeBundleResources, writeSkillApp } from '../fixtures/xnl-skill-app';

const WORKFLOW = 'Codument.GoogleSearch.Workflow.Search';
const ACTION = 'Codument.GoogleSearch.Page.Results.extract';
const RESULT_ACTION = 'Codument.Demo.Page.setResult';

async function addSkill(root: string, name: string, options: { bundle?: boolean; invalidOutput?: boolean; downloadAction?: boolean } = {}): Promise<void> {
  const skill = path.join(root, '.agents/skills', name);
  await writeSkillApp(skill, name);
  const inputSchema = {
    type: 'object', additionalProperties: false,
    properties: { query: { type: 'string', minLength: 1, maxLength: 200 } },
  };
  const outputSchema = {
    type: 'object', additionalProperties: false, required: ['query', 'value'],
    properties: { query: { type: 'string' }, value: { type: 'object' } },
  };
  await writeBundleResources(skill, `Test.${name}.Bundles`, `
    const api = globalThis.Codument;
    if (!api) throw new Error('Host resource definition API is unavailable');
    const page = (context) => { if (!context.page) throw new Error('page capability is unavailable'); return context.page; };
    export const definitions = [
      api.definePageWorkflow({
        fqn: ${JSON.stringify(WORKFLOW)}, description: '运行 Google 搜索', runtimeCapabilities: ['page'],
        inputSchema: ${JSON.stringify(inputSchema)}, outputSchema: ${JSON.stringify(outputSchema)},
        inputSource: { kind: 'served-page', pageName: 'google-search', method: 'getState' },
        resultTarget: { pageName: 'google-search', operationRef: ${JSON.stringify(RESULT_ACTION)} },
        selectionPolicy: { kind: 'external-page', urlPattern: '^https://www\\.google\\.com\\.hk/', cardinality: 'exactly-one' },
        defaultSelector: { direct: { byExternalPage: {} } },
        activation: { onMissing: 'open', url: 'https://www.google.com.hk/' },
        async start(runtime, _selector, invocation) {
          const current = page(runtime);
          const value = await current.session.send('Runtime.evaluate', { expression: '1 + 1' });
          ${options.invalidOutput ? 'return { unexpected: true };' : 'return { query: invocation.payload.query, value };'}
        },
      }),
      api.definePageObject({
        fqn: 'Codument.GoogleSearch.Page.Results', description: 'Google 搜索结果页', runtimeCapabilities: ['page'],
        selectionPolicy: { kind: 'external-page', urlPattern: '^https://www\\.google\\.com\\.hk/', cardinality: 'exactly-one' },
        defaultSelector: { byExternalPage: {} },
        activation: { onMissing: 'open', url: 'https://www.google.com.hk/' },
        actions: [{
          fqn: ${JSON.stringify(ACTION)}, description: '提取第一页结果', inputSchema: { type: 'object' }, outputSchema: {},
          handler: (runtime) => page(runtime).session.send(${options.downloadAction ? "'Page.download', { expression: 'clickExport()', timeoutMs: 2000, maxBytes: 4096, expectedExtensions: ['.zip'] }" : "'Runtime.evaluate', { expression: 'document.title' }"}),
        }],
      }),
      api.definePageObject({
        fqn: 'Codument.Demo.Page', description: 'Google 搜索 demo 页面', runtimeCapabilities: ['page'],
        selectionPolicy: { kind: 'served-page', pageName: 'google-search', cardinality: 'exactly-one' },
        actions: [{
          fqn: ${JSON.stringify(RESULT_ACTION)}, description: '回填 workflow receipt', inputSchema: { type: 'object' }, outputSchema: {},
          handler: (runtime, _selector, invocation) => page(runtime).session.send('Page.setResult', invocation.payload),
        }],
      }),
    ];
  `);
  if (options.bundle === false) {
    await fs.rm(path.join(skill, 'PageWorkflow/bundle/index.js'));
  }
}

function supervisor(tabs: unknown[] = []): EgoBrowserSupervisor {
  return {
    transport: 'ego-browser',
    session: 'fixture',
    taskSpace: 'fixture',
    prepare: async () => {},
    browserFetch: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://www.google.com.hk/',
      contentType: 'text/html',
      headers: {},
      text: '',
    }),
    evaluate: async (expression) => ({ expression }),
    listTabs: async () => tabs,
    selectTab: async () => ({}),
    navigate: async () => ({}),
    download: async () => ({
      guid: 'fixture-download',
      suggestedFilename: 'fixture.zip',
      fileName: 'fixture.zip',
      mimeType: 'application/zip',
      size: 3,
      bytes: new Uint8Array([1, 2, 3]),
    }),
    close: async () => {},
  };
}

function runtime(root: string, ego = supervisor()): CommandRuntime {
  const automation = createPageAutomationCatalog(root, ['.agents/skills']);
  return {
    resources: {} as CommandRuntime['resources'],
    workspace: () => ({ root }) as ReturnType<CommandRuntime['workspace']>,
    page: { skillsDirs: ['.agents/skills'], supervisor: ego, automation },
  };
}

async function settled(coordinator: PageWorkflowCoordinator, runId: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const run = coordinator.get(runId);
    if (run?.status === 'completed' || run?.status === 'failed') return run;
    await Bun.sleep(2);
  }
  throw new Error('run did not settle');
}

describe('page automation registry and runtime', () => {
  test('requires an injected automation catalog instead of scanning the workspace', async () => {
    const incomplete = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => ({ root: process.cwd() }) as ReturnType<CommandRuntime['workspace']>,
    } as CommandRuntime;
    await expect(listPageAutomationRegistry(incomplete)).rejects.toThrow('Page automation catalog is not configured');
  });

  test('lists merged workflow, PageObject and action metadata with skill-relative paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    const listed = await listPageAutomationRegistry(runtime(root));
    expect(listed).toHaveLength(5);
    expect(listed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'workflow',
        fqn: WORKFLOW,
        description: '运行 Google 搜索',
        skillId: 'demo',
        relativePath: 'PageWorkflow/manifest.xnl',
        inputSchema: expect.objectContaining({ type: 'object' }),
        outputSchema: expect.objectContaining({ type: 'object' }),
        resultTarget: { pageName: 'google-search', operationRef: RESULT_ACTION },
      }),
      expect.objectContaining({ kind: 'page-object', fqn: 'Codument.GoogleSearch.Page.Results', description: 'Google 搜索结果页', skillId: 'demo', relativePath: 'PageObject/manifest.xnl' }),
      expect.objectContaining({ kind: 'page-object-action', fqn: ACTION, description: '提取第一页结果', skillId: 'demo', relativePath: 'PageObject/manifest.xnl' }),
      expect.objectContaining({ kind: 'page-object', fqn: 'Codument.Demo.Page', description: 'Google 搜索 demo 页面' }),
      expect.objectContaining({ kind: 'page-object-action', fqn: RESULT_ACTION, description: '回填 workflow receipt' }),
    ]));
    const workflows = await dispatchCommand(['PageWorkflow', 'list'], createCommandRuntime(root), true);
    expect(workflows.data).toMatchObject({ command: 'PageWorkflow.list', count: 1, resources: [expect.objectContaining({ fqn: WORKFLOW })] });
    const objects = await dispatchCommand(['PageObject', 'list'], createCommandRuntime(root), true);
    expect(objects.data).toMatchObject({ command: 'PageObject.list', count: 2 });
    expect((objects.data as { resources: unknown[] }).resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ fqn: 'Codument.GoogleSearch.Page.Results', actions: [expect.objectContaining({ fqn: ACTION })] }),
      expect.objectContaining({ fqn: 'Codument.Demo.Page', actions: [expect.objectContaining({ fqn: RESULT_ACTION })] }),
    ]));
  });

  test('unknown, duplicate FQN and missing bundle fail before acceptance', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await expect(createPageWorkflowCoordinator(runtime(root)).start({ fqn: WORKFLOW, input: {} })).rejects.toThrow('definition was not found');
    await addSkill(root, 'one');
    await addSkill(root, 'two');
    await expect(createPageWorkflowCoordinator(runtime(root)).start({ fqn: WORKFLOW, input: {} })).rejects.toThrow('Duplicate');

    const missing = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(missing, 'missing', { bundle: false });
    await expect(createPageWorkflowCoordinator(runtime(missing)).start({ fqn: WORKFLOW, input: {} })).rejects.toThrow(/catalog is invalid|entry is missing|material read failed/i);
  });

  test('run receipt completes and injects an Ego PageSession', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    const coordinator = createPageWorkflowCoordinator(runtime(root));
    const receipt = await coordinator.start({ fqn: WORKFLOW, input: { query: 'analytics' } });
    expect(receipt.status).toBe('queued');
    const run = await settled(coordinator, receipt.runId);
    expect(run).toMatchObject({ status: 'completed', result: { query: 'analytics' } });
    const result = await invokeInstalledPageObjectAction(runtime(root), { operationRef: ACTION, input: {} });
    expect(result).toEqual({ result: { value: { expression: 'document.title' } } });
    await coordinator.close();
    await expect(coordinator.start({ fqn: WORKFLOW, input: {} })).rejects.toThrow('closed');
  });

  test('PageSession exposes the generic binary download artifact without decoding it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo', { downloadAction: true });
    const ego = supervisor();
    let received: unknown;
    ego.download = async (request) => {
      received = request;
      return {
        guid: 'download-guid',
        suggestedFilename: 'owid.zip',
        fileName: 'owid.zip',
        mimeType: 'application/zip',
        size: 4,
        bytes: new Uint8Array([80, 75, 3, 4]),
      };
    };
    const result = await invokeInstalledPageObjectAction(runtime(root, ego), { operationRef: ACTION, input: {} });
    expect(received).toEqual({ expression: 'clickExport()', timeoutMs: 2000, maxBytes: 4096, expectedExtensions: ['.zip'] });
    expect(result).toMatchObject({ guid: 'download-guid', fileName: 'owid.zip', size: 4 });
    expect((result as { bytes: Uint8Array }).bytes).toBeInstanceOf(Uint8Array);
  });

  test('rejects invalid explicit input before creating a run or opening Ego', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    let externalEffects = 0;
    const ego = supervisor();
    ego.navigate = async () => { externalEffects += 1; return {}; };
    const coordinator = createPageWorkflowCoordinator(runtime(root, ego));
    await expect(coordinator.start({ fqn: WORKFLOW, input: { query: '', extra: true } })).rejects.toThrow('input validation failed');
    expect(externalEffects).toBe(0);
  });

  test('marks a run failed when the bundle violates its output schema', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo', { invalidOutput: true });
    const coordinator = createPageWorkflowCoordinator(runtime(root));
    const receipt = await coordinator.start({ fqn: WORKFLOW, input: { query: 'analytics' } });
    expect(await settled(coordinator, receipt.runId)).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('output validation failed'),
    });
  });

  test('multiple matching tabs fail closed', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    const tabs = [
      { targetId: 'one', url: 'https://www.google.com.hk/search?q=a' },
      { targetId: 'two', url: 'https://www.google.com.hk/search?q=b' },
    ];
    const coordinator = createPageWorkflowCoordinator(runtime(root, supervisor(tabs)));
    const receipt = await coordinator.start({ fqn: WORKFLOW, input: { query: 'analytics' } });
    expect(await settled(coordinator, receipt.runId)).toMatchObject({ status: 'failed', error: expect.stringContaining('Multiple external pages') });
  });

  test('close drains or rejects an admission already in progress', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    const coordinator = createPageWorkflowCoordinator(runtime(root));
    const starting = coordinator.start({ fqn: WORKFLOW, input: { query: 'analytics' } });
    await coordinator.close();
    const receipt = await starting.catch(() => undefined);
    if (receipt) expect(coordinator.get(receipt.runId)?.status).toMatch(/completed|failed/);
    await expect(coordinator.start({ fqn: WORKFLOW, input: {} })).rejects.toThrow('closed');
  });

  test('delivers a completed receipt only to the originating page instance', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    const pages = createPageInstanceHub({ timeoutMs: 100 });
    const firstMessages: Array<Record<string, unknown>> = [];
    const secondMessages: Array<Record<string, unknown>> = [];
    const first = { send(data: string) { firstMessages.push(JSON.parse(data)); } };
    const second = { send(data: string) { secondMessages.push(JSON.parse(data)); } };
    pages.add(first);
    pages.add(second);
    pages.message(first, JSON.stringify({ type: 'page.register', pageName: 'google-search' }));
    pages.message(second, JSON.stringify({ type: 'page.register', pageName: 'google-search' }));
    const targetRef = String(firstMessages[0].targetRef);
    const coordinator = createPageWorkflowCoordinator(runtime(root));
    const receipt = await coordinator.start({
      fqn: WORKFLOW,
      selector: { fromServedPage: { subject: { byExternalPage: {} }, origin: { byServedPageRef: targetRef } } },
      input: { query: 'analytics' },
    }, createPageInstanceTargetPort(pages));
    for (let attempt = 0; attempt < 100 && firstMessages.length < 2; attempt++) await Bun.sleep(2);
    expect(firstMessages).toHaveLength(2);
    expect(secondMessages).toHaveLength(1);
    const stateRequest = firstMessages[1];
    expect(stateRequest).toMatchObject({ type: 'page.request', method: 'getState' });
    pages.message(first, JSON.stringify({ type: 'page.response', requestId: stateRequest.requestId, ok: true, result: { query: 'ignored because explicit input wins' } }));
    for (let attempt = 0; attempt < 100 && firstMessages.length < 3; attempt++) await Bun.sleep(2);
    const request = firstMessages[2];
    expect(request).toMatchObject({ type: 'page.request', method: 'setResult' });
    expect(request.params).toMatchObject({ run: { runId: receipt.runId, status: 'completed' } });
    pages.message(first, JSON.stringify({ type: 'page.response', requestId: request.requestId, ok: true, result: { accepted: true } }));
    expect(await settled(coordinator, receipt.runId)).toMatchObject({ status: 'completed' });
  });

  test('hydrates workflow input from the originating page before opening Ego', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    const pages = createPageInstanceHub({ timeoutMs: 100 });
    const messages: Array<Record<string, unknown>> = [];
    const page = { send(data: string) { messages.push(JSON.parse(data)); } };
    pages.add(page);
    pages.message(page, JSON.stringify({ type: 'page.register', pageName: 'google-search' }));
    const targetRef = String(messages[0].targetRef);
    const coordinator = createPageWorkflowCoordinator(runtime(root));
    const started = coordinator.start({
      fqn: WORKFLOW,
      selector: { fromServedPage: { subject: { byExternalPage: {} }, origin: { byServedPageRef: targetRef } } },
      input: {},
    }, createPageInstanceTargetPort(pages));
    for (let attempt = 0; attempt < 100 && messages.length < 2; attempt++) await Bun.sleep(2);
    expect(messages[1]).toMatchObject({ type: 'page.request', method: 'getState' });
    pages.message(page, JSON.stringify({
      type: 'page.response',
      requestId: messages[1].requestId,
      ok: true,
      result: { query: 'supplier risk' },
    }));
    const receipt = await started;
    for (let attempt = 0; attempt < 100 && messages.length < 3; attempt++) await Bun.sleep(2);
    expect(messages[2]).toMatchObject({ type: 'page.request', method: 'setResult' });
    expect(messages[2].params).toMatchObject({ run: { runId: receipt.runId, status: 'completed', result: { query: 'supplier risk' } } });
    pages.message(page, JSON.stringify({ type: 'page.response', requestId: messages[2].requestId, ok: true, result: { accepted: true } }));
    expect(await settled(coordinator, receipt.runId)).toMatchObject({ status: 'completed' });
  });

  test('hydrates and backfills only the originating MCP App targetRef', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    const targets = createMcpPageTargetStore();
    const first = targets.register('google-search', { query: 'supplier risk' });
    const second = targets.register('google-search', { query: 'must remain untouched' });
    const coordinator = createPageWorkflowCoordinator(runtime(root));
    const receipt = await coordinator.start({
      fqn: WORKFLOW,
      selector: { fromServedPage: { subject: { byExternalPage: {} }, origin: { byServedPageRef: first.targetRef } } },
      input: {},
    }, targets);
    expect(await settled(coordinator, receipt.runId)).toMatchObject({
      status: 'completed',
      result: { query: 'supplier risk' },
    });
    expect(await targets.request(first.targetRef, 'getResult')).toMatchObject({
      run: { runId: receipt.runId, status: 'completed', result: { query: 'supplier risk' } },
    });
    expect(await targets.request(second.targetRef, 'getResult')).toBeUndefined();
  });

  test('rejects an expired MCP App targetRef before accepting a run or opening Ego', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    let current = 0;
    const targets = createMcpPageTargetStore({ ttlMs: 10, now: () => current });
    const expired = targets.register('google-search', { query: 'supplier risk' });
    current = 11;
    let externalEffects = 0;
    const ego = supervisor();
    ego.navigate = async () => { externalEffects += 1; return {}; };
    const coordinator = createPageWorkflowCoordinator(runtime(root, ego));
    await expect(coordinator.start({
      fqn: WORKFLOW,
      selector: { fromServedPage: { subject: { byExternalPage: {} }, origin: { byServedPageRef: expired.targetRef } } },
      input: {},
    }, targets))
      .rejects.toThrow('unknown or stale');
    expect(externalEffects).toBe(0);
    expect(targets.list()).toEqual([]);
  });

  test('rejects a mismatched result target before accepting a run or opening Ego', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-workflow-'));
    await addSkill(root, 'demo');
    const targets = createMcpPageTargetStore();
    const wrong = targets.register('another-page', { query: 'supplier risk' });
    let externalEffects = 0;
    const ego = supervisor();
    ego.navigate = async () => { externalEffects += 1; return {}; };
    const coordinator = createPageWorkflowCoordinator(runtime(root, ego));
    await expect(coordinator.start({
      fqn: WORKFLOW,
      selector: { fromServedPage: { subject: { byExternalPage: {} }, origin: { byServedPageRef: wrong.targetRef } } },
      input: {},
    }, targets))
      .rejects.toThrow('is not google-search');
    expect(externalEffects).toBe(0);
  });
});
