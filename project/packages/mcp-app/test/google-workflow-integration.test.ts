import { describe, expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createMcpAppServer } from '../src';
import { createCommandRuntime } from '../../cli/src/cli/runtime';
import { createCliMcpAppRuntime } from '../../cli/src/cli/runtime/mcp-app';
import type { EgoBrowserSupervisor } from '../../cli/src/cli/runtime/ego-supervisor';
import { writeSop, writeBundleResources, writePageManifest, writeSkillApp } from '../../cli/test/fixtures/xnl-skill-app';

const WORKFLOW = 'Codument.GoogleSearch.Workflow.Search';
const SOP = 'Codument.Demo.SOP.GoogleSearch';
const RESULT_ACTION = 'Codument.Demo.Page.setResult';

async function installDemo(root: string): Promise<void> {
  const skill = path.join(root, '.agents/skills/codument-demo');
  const page = path.join(skill, 'pages/google-search');
  await writeSkillApp(skill, 'codument-demo');
  await fs.mkdir(page, { recursive: true });
  await fs.writeFile(path.join(page, 'index.html'), '<!doctype html><title>Google Search</title>');
  await fs.writeFile(path.join(page, 'view.js'), `
globalThis.__AI_CLI_PAGE_VIEWS__ ??= Object.create(null);
globalThis.__AI_CLI_PAGE_VIEWS__['google-search'] = { renderRun() {} };
`);
  await writePageManifest(page, {
    fqn: 'Test.Google.Page.Search',
    name: 'google-search',
    description: '谷歌搜索',
    mcpApp: { sopFqn: SOP, workflowFqn: WORKFLOW, viewAsset: 'view.js' },
  });
  await writeBundleResources(skill, 'Test.Google.Bundles', `
    const api = globalThis.Codument;
    if (!api) throw new Error('Host resource definition API is unavailable');
    export const definitions = [api.definePageWorkflow({
      fqn: ${JSON.stringify(WORKFLOW)}, description: 'Google Search fixture', runtimeCapabilities: ['page'],
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, additionalProperties: false },
      outputSchema: { type: 'object' },
      selectionPolicy: { kind: 'external-page', urlPattern: '^https://www\\.google\\.com\\.hk/', cardinality: 'exactly-one' },
      defaultSelector: { direct: { byExternalPage: {} } },
      activation: { onMissing: 'open', url: 'https://www.google.com.hk/' },
      inputSource: { kind: 'served-page', pageName: 'google-search', method: 'getState' },
      resultTarget: { pageName: 'google-search', operationRef: ${JSON.stringify(RESULT_ACTION)} },
      start: async (_runtime, _selector, invocation) => ({ query: invocation.payload.query, count: 1, results: [{ rank: 1, title: 'Supplier risk', url: 'https://example.test/result', displayUrl: 'example.test', snippet: 'Structured result' }] }),
    }), api.definePageObject({
      fqn: 'Codument.Demo.Page', description: 'Google Search result target', runtimeCapabilities: ['page'],
      selectionPolicy: { kind: 'served-page', pageName: 'google-search', cardinality: 'exactly-one' },
      actions: [{
        fqn: ${JSON.stringify(RESULT_ACTION)}, description: 'Backfill workflow receipt', inputSchema: { type: 'object' }, outputSchema: {},
        handler: (runtime, _selector, invocation) => runtime.page.session.send('Page.setResult', invocation.payload),
      }],
    })];
  `);
  await writeSop(skill, SOP, 'demo.md', '# Google Search SOP');
}

function supervisor(): EgoBrowserSupervisor {
  return {
    transport: 'ego-browser',
    session: 'test',
    taskSpace: 'test',
    prepare: async () => {},
    browserFetch: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://www.google.com.hk/',
      contentType: 'text/html',
      text: '',
    }),
    evaluate: async () => ({}),
    listTabs: async () => [],
    selectTab: async () => ({}),
    navigate: async () => ({}),
    download: async () => ({
      guid: 'fixture-download',
      suggestedFilename: 'fixture.zip',
      fileName: 'fixture.zip',
      size: 0,
      bytes: new Uint8Array(),
    }),
    close: async () => {},
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected structured object');
  return value as Record<string, unknown>;
}

describe('Google Search MCP App workflow', () => {
  test('stages query, starts the allowlisted workflow and reads the exact target receipt', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-mcp-google-'));
    await installDemo(root);
    const commandRuntime = createCommandRuntime(root);
    commandRuntime.page!.supervisor = supervisor();
    const appRuntime = createCliMcpAppRuntime(commandRuntime);
    const server = createMcpAppServer(appRuntime);
    const client = new Client({ name: 'claude-like-host', version: '1.0.0' }, {
      capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } },
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const opened = object((await client.callTool({ name: 'open_page', arguments: { pageName: 'google-search' } })).structuredContent);
      const targetRef = String(opened.targetRef);
      expect(opened).toMatchObject({ embedded: true, sopFqn: SOP, pageName: 'google-search' });
      const sop = object((await client.callTool({ name: 'sop_get', arguments: { fqn: SOP } })).structuredContent);
      expect(sop).toMatchObject({
        fqn: SOP,
        profile: 'freeform',
        markdown: expect.stringContaining('# Google Search SOP'),
        contentDigest: expect.stringMatching(/^sha256:/),
        diagnostics: [],
      });
      await client.callTool({
        name: 'page_target_update',
        arguments: { targetRef, state: { query: 'supplier risk' } },
      });
      const started = object((await client.callTool({
        name: 'page_workflow_start',
        arguments: {
          fqn: WORKFLOW,
          selector: { fromServedPage: { subject: { byExternalPage: {} }, origin: { byServedPageRef: targetRef } } },
          input: {},
        },
      })).structuredContent);
      const runId = String(started.runId);
      let run: Record<string, unknown> = started;
      for (let attempt = 0; attempt < 50 && run.status !== 'completed' && run.status !== 'failed'; attempt++) {
        await Bun.sleep(2);
        run = object((await client.callTool({ name: 'page_workflow_get', arguments: { runId } })).structuredContent);
      }
      expect(run).toMatchObject({ status: 'completed', result: { query: 'supplier risk', count: 1 } });
      const target = object((await client.callTool({ name: 'page_target_get', arguments: { targetRef } })).structuredContent);
      expect(target).toMatchObject({
        targetRef,
        result: { run: { runId, status: 'completed', result: { query: 'supplier risk', count: 1 } } },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
