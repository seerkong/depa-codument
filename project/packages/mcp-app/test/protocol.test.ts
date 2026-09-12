import { afterEach, describe, expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  APP_RESOURCE_URI,
  createMcpAppServer,
  createMcpAppToolCatalog,
  createMcpPageTargetStore,
  serveMcpApp,
  type McpAppRuntime,
  type SopPort,
} from '../src';

const closeables: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.allSettled(closeables.splice(0).map((value) => value.close()));
});

function runtime(sops: SopPort = {
  get: async (fqn) => ({
    fqn,
    profile: 'freeform',
    markdown: '# SOP',
    contentDigest: 'sha256:test',
    diagnostics: [],
  }),
}): McpAppRuntime {
  const targets = createMcpPageTargetStore();
  return {
    hostSkill: 'codument',
    targets,
    pages: {
      list: async () => [
        {
          name: 'google-search',
          description: '谷歌搜索',
          status: 'ready',
          entryUrl: '/pages/google-search/',
          sopFqn: 'Codument.Demo.SOP.GoogleSearch',
          appReady: true,
        },
        {
          name: 'open-data-export',
          description: 'Open Data Export',
          status: 'ready',
          entryUrl: '/pages/open-data-export/',
          sopFqn: 'Codument.Demo.SOP.OpenDataExport',
          appReady: true,
          agentAction: {
            action: 'Codument.Demo.SOP.OpenDataExport',
            workflowFqn: 'Codument.OpenDataExport.Workflow.Export',
            inputSchema: {
              type: 'object' as const,
              additionalProperties: false,
              required: ['chartSlug', 'startYear'],
              properties: {
                chartSlug: { const: 'life-expectancy' },
                startYear: { type: 'integer' as const },
              },
            },
          },
        },
      ],
      renderApp: async () => '<!doctype html><html><body><main id="mcp-app">Google Search</main></body></html>',
    },
    automation: { list: async () => [] },
    sops,
    workflows: {
      start: async (request) => ({ runId: 'pwr_test', fqn: request.fqn, status: 'queued' }),
      get: (runId) => ({ runId, fqn: 'Demo.Workflow', status: 'completed' }),
    },
  };
}

async function connect(capabilities: Record<string, unknown> = {}, appRuntime = runtime()) {
  const server = createMcpAppServer(appRuntime);
  const client = new Client({ name: 'test-host', version: '1.0.0' }, { capabilities });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeables.push(client, server);
  return client;
}

describe('MCP Apps protocol surface', () => {
  test('keeps contract modules independent from logic and support implementations', async () => {
    const contracts = path.resolve(import.meta.dir, '../src/contracts');
    const files = (await fs.readdir(contracts)).filter((name) => name.endsWith('.ts'));
    for (const file of files) {
      const source = await fs.readFile(path.join(contracts, file), 'utf8');
      expect(source).not.toMatch(/from ['"]\.\.\/(?:logic|support)\//);
    }
  });

  test('projects a vendor-neutral catalog before the SDK registration adapter', () => {
    const catalog = createMcpAppToolCatalog(runtime());
    expect(catalog.map((tool) => tool.name)).toEqual([
      'page_list',
      'open_page',
      'sop_get',
      'page_automation_list',
      'page_workflow_start',
      'page_workflow_get',
      'page_target_get',
      'page_target_update',
    ]);
    const targetUpdate = catalog.find((tool) => tool.name === 'page_target_update');
    expect(targetUpdate?.inputSchema).toHaveProperty('state');
    expect(targetUpdate?.inputSchema).not.toHaveProperty('result');
  });

  test('gets one validated SOP through only the injected narrow port', async () => {
    const calls: string[] = [];
    const document = {
      fqn: 'Codument.Demo.SOP.GoogleSearch',
      profile: 'typed-leaf' as const,
      markdown: '# Google Search\n',
      contentDigest: 'sha256:canonical',
      diagnostics: [],
    };
    const client = await connect({}, runtime({
      async get(fqn) {
        calls.push(fqn);
        return document;
      },
    }));
    const result = await client.callTool({ name: 'sop_get', arguments: { fqn: document.fqn } });
    expect(calls).toEqual([document.fqn]);
    expect(result.structuredContent).toEqual(document);
    expect((await client.callTool({
      name: 'application_sop_get',
      arguments: { fqn: document.fqn },
    })).isError).toBe(true);
  });

  test('keeps SOP discovery and failures behind the injected port', async () => {
    expect(await fs.readdir(path.resolve(import.meta.dir, '../src/support'))).not.toContain('sop-resource-catalog.ts');
    const client = await connect({}, runtime({
      async get() {
        throw new Error('canonical SOP rejected');
      },
    }));
    const result = await client.callTool({
      name: 'sop_get',
      arguments: { fqn: 'Codument.Demo.SOP.GoogleSearch' },
    });
    expect(result.isError).toBe(true);
  });

  test('negotiates initialize and exposes schema-validated tool/resource registries', async () => {
    const client = await connect({
      extensions: {
        'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] },
      },
    });
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      'page_list',
      'open_page',
      'sop_get',
      'page_automation_list',
      'page_workflow_start',
      'page_workflow_get',
      'page_target_get',
      'page_target_update',
    ]);
    const openPage = tools.tools.find((tool) => tool.name === 'open_page');
    expect(openPage?._meta).toMatchObject({
      ui: { resourceUri: APP_RESOURCE_URI },
      'ui/resourceUri': APP_RESOURCE_URI,
    });
    const resource = await client.readResource({ uri: APP_RESOURCE_URI });
    expect(resource.contents[0]).toMatchObject({
      uri: APP_RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
    });
    expect('text' in resource.contents[0] && resource.contents[0].text).toContain('<!doctype html>');
    const invalid = await client.callTool({ name: 'open_page', arguments: {} });
    expect(invalid.isError).toBe(true);
  });

  test('returns an exact targetRef for a supported UI host', async () => {
    const client = await connect({
      extensions: {
        'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] },
      },
    });
    const result = await client.callTool({ name: 'open_page', arguments: { pageName: 'google-search' } });
    const structured = result.structuredContent as { targetRef: string; agentMessage: string };
    expect(structured.agentMessage).toStartWith('请使用 codument skill');
    expect(structured.agentMessage).toContain(`targetRef: ${structured.targetRef}`);
    expect(structured.agentMessage).not.toContain('query:');
    expect(result.structuredContent).toMatchObject({
      embedded: true,
      pageName: 'google-search',
      targetRef: expect.stringMatching(/^page_target_/),
      resourceUri: APP_RESOURCE_URI,
      hostSkill: 'codument',
      sopFqn: 'Codument.Demo.SOP.GoogleSearch',
      agentMessage: structured.agentMessage,
    });
    const rejectedResultWrite = await client.callTool({
      name: 'page_target_update',
      arguments: { targetRef: structured.targetRef, result: { run: { status: 'completed' } } },
    });
    expect(rejectedResultWrite.isError).toBe(true);
  });

  test('validates and canonically projects typed page state before ui/message delivery', async () => {
    const client = await connect({ extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } });
    const opened = await client.callTool({ name: 'open_page', arguments: { pageName: 'open-data-export' } });
    const targetRef = String((opened.structuredContent as { targetRef: string }).targetRef);
    const updated = await client.callTool({
      name: 'page_target_update',
      arguments: { targetRef, state: { startYear: 2000, chartSlug: 'life-expectancy' } },
    });
    const structured = updated.structuredContent as { agentMessage: string };
    expect(structured.agentMessage).toEndWith('input: {"chartSlug":"life-expectancy","startYear":2000}');
    const invalid = await client.callTool({
      name: 'page_target_update',
      arguments: { targetRef, state: { startYear: 2000, chartSlug: 'life-expectancy', unknown: true } },
    });
    expect(invalid.isError).toBe(true);
  });

  test('reports a truthful text fallback when the host has no MCP Apps capability', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'open_page', arguments: { pageName: 'google-search' } });
    expect(result.structuredContent).toMatchObject({ embedded: false, pageName: 'google-search' });
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content.find((item): item is { type: 'text'; text: string } => (
      Boolean(item) && typeof item === 'object' && (item as { type?: unknown }).type === 'text'
    ));
    expect(text?.text ?? '').toContain('does not support MCP Apps');
  });

  test('connects an injected stdio-compatible transport and routes diagnostics away from protocol output', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const logs: string[] = [];
    const server = await serveMcpApp(runtime(), { transport: serverTransport, log: (message) => logs.push(message) });
    const client = new Client({ name: 'stdio-test', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
    closeables.push(client, server);
    expect((await client.listTools()).tools).toHaveLength(8);
    expect(logs).toEqual(['codument MCP App server connected']);
  });
});
