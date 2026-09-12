import { describe, expect, test } from 'bun:test';
import { buildAgentTaskMessage } from '../../src/cli/http/app';
import { createHttpApp } from '../../src/cli/http/app';
import { createPageInstanceHub } from '../../src/cli/http/page-instances';
import type { CommandRuntime } from '../../src/cli/contracts/command';
import { createWorkspaceEffect } from '../../src/cli/effects/workspace';
import { installHostResourceDefinitionGlobals } from '../../src/cli/resources/definitions';
import { invokeEgoOpen } from '../../src/cli/app/invoke';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
installHostResourceDefinitionGlobals();

const {
  GoogleSearchPage,
  GoogleSearchWorkflow,
  queryValue,
} = await import('../../src/templates/agents/workspace/skills/codument-demo/PageWorkflow/bundle/index.js');

describe('Google demo automation', () => {
  test('ships a plain static page with binding, FQN dispatch and result rendering', async () => {
    const pageRoot = path.resolve(import.meta.dir, '../../src/templates/agents/workspace/skills/codument-demo/modules/google-search/pages/google-search');
    const skillRoot = path.resolve(pageRoot, '..', '..', '..', '..');
    const [html, app, view, styles, skill, sop, hostSkill] = await Promise.all([
      fs.readFile(path.join(pageRoot, 'index.html'), 'utf8'),
      fs.readFile(path.join(pageRoot, 'client/app.js'), 'utf8'),
      fs.readFile(path.join(pageRoot, 'client/view.js'), 'utf8'),
      fs.readFile(path.join(pageRoot, 'styles.css'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'modules/google-search/sops/codument-demo--sop--google-search.md'), 'utf8'),
      fs.readFile(path.resolve(skillRoot, '../../../global/skills/codument/SKILL.md'), 'utf8'),
    ]);
    expect(html).toContain('id="agent-target"');
    expect(html).toContain('id="refresh-targets"');
    expect(html).toContain('id="bind"');
    expect(html).toContain('id="business-page"');
    expect(app).toContain("connectPage('google-search'");
    expect(app).toContain('Codument.Demo.SOP.GoogleSearch');
    expect(app).toContain('setResult({ run })');
    expect(app).toContain('sharedView.mount');
    expect(app).toContain('view.renderRun');
    expect(app).not.toContain("document.createElement('li')");
    expect(view).toContain("views['google-search']");
    expect(view).toContain("id: 'search-form'");
    expect(view).toContain("id: 'query'");
    expect(view).toContain('actions.submit({ query })');
    expect(view).toContain('mount(root, actions)');
    expect(view).toContain('document.createElement');
    expect(app).toContain('targetRef');
    expect(app).toContain("refreshTargetsButton.addEventListener('click', refreshTargets)");
    expect(app).not.toContain('SOP:');
    expect(styles).toContain('.row > * { min-width: 0; max-width: 100%; }');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)');
    expect(styles).toContain('.row select { grid-column: 1 / -1; }');
    expect(styles).toContain('text-overflow: ellipsis');
    for (const tag of [
      '<host_runtime_dependency>',
      '<protocol>',
      '<sops>',
      '<sops_guidance>',
      '<pages>',
      '<pages_guidance>',
      '<page_workflows>',
      '<page_workflows_guidance>',
      '<page_objects>',
      '<page_objects_guidance>',
    ]) {
      expect(skill).toContain(tag);
    }
    expect(skill).not.toContain('<fqn_event_dispatch>');
    expect(skill).toContain('<sop fqn="Codument.Demo.SOP.GoogleSearch">');
    expect(sop).toContain('fromServedPage.origin.byServedPageRef');
    expect(sop).toContain('profile: typed-leaf');
    for (const block of ['input_contract', 'preconditions', 'procedure', 'effects', 'output_contract', 'success_criteria']) {
      expect(sop).toContain(`<${block}>`);
    }
    expect(hostSkill).toContain('codument Page list --json');
    expect(hostSkill).toContain('codument PageWorkflow list --json');
    expect(hostSkill).toContain('<mcp_apps_guidance>');
    expect(hostSkill).toContain('<serve_guidance>');
    expect(hostSkill).toContain('codument serve start --port 0 --json');
    expect(hostSkill).toContain('codument serve restart --port 0 --json');
    expect(hostSkill).toContain('codument serve status --json');
    expect(hostSkill).toContain('codument serve stop --json');
    expect(hostSkill).toContain('sop_get');
    expect(hostSkill).toContain('ui/message');
    for (const guidance of ['sops', 'pages', 'page_workflows', 'page_objects']) {
      expect(hostSkill).toContain(`<${guidance}_guidance>`);
    }
    expect(hostSkill).not.toContain('codument-demo/pages/google-search');
    expect(skill).not.toContain('page_target_update');
    expect(skill).not.toContain('sop_get');
    const [moduleManifest, hostManifest, hostEntry, compatibilityShim] = await Promise.all([
      fs.readFile(path.join(skillRoot, 'modules/google-search/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'modules/google-search/host/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'modules/google-search/host/entry.ts'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'PageWorkflow/bundle/index.js'), 'utf8'),
    ]);
    expect(moduleManifest).toContain('<SkillModule #Codument.Demo.Module.GoogleSearch');
    expect(moduleManifest).toContain('resourceKind = "HostBundle"');
    expect(hostManifest).toContain('<HostBundle #Codument.Demo.Module.GoogleSearch.Host');
    expect(hostManifest).toContain('exports = ["PageWorkflow" "PageObject"]');
    expect(hostManifest).toContain('sources = ["vfs://./entry.ts" "vfs://./logic" "vfs://./adapters"]');
    expect(hostEntry).toContain('pageWorkflowDefinitions');
    expect(hostEntry).toContain('pageObjectDefinitions');
    expect(hostEntry).not.toContain('document.querySelector');
    expect(compatibilityShim).toContain('Stable source-import compatibility shim');
    expect(compatibilityShim).not.toContain('Google search input not found');
  });

  test('validates query, submits it and returns structured first-page results', async () => {
    expect(() => queryValue({ query: '  ' })).toThrow('query is required');
    expect(() => queryValue({ query: 'x'.repeat(201) })).toThrow('200');
    const expressions: string[] = [];
    const fixture = {
      ok: true,
      results: [
        { rank: 1, title: 'Agentic workflows', url: 'https://example.test/one', displayUrl: 'example.test', snippet: 'First result' },
        { rank: 2, title: 'BI guide', url: 'https://example.test/two', displayUrl: 'example.test', snippet: 'Second result' },
      ],
    };
    const session = {
      async send(_method: string, params: { expression: string }) {
        expressions.push(params.expression);
        return { result: { value: expressions.length === 1 ? { ok: true } : fixture } };
      },
    };
    const result = await GoogleSearchWorkflow.search(session, { query: ' agentic workflows ' });
    expect(expressions[0]).toContain('textarea[name="q"]');
    expect(expressions[0]).toContain('agentic workflows');
    expect(expressions[1]).toContain("querySelector('#search')");
    expect(expressions[1]).toContain('rank: results.length + 1');
    expect(result).toEqual({ query: 'agentic workflows', results: fixture.results, count: 2 });
  });

  test('reports DOM drift instead of returning invented results', async () => {
    const session = { send: async () => ({ result: { value: { ok: false, error: 'Google result DOM changed' } } }) };
    await expect(GoogleSearchPage.extract(session)).rejects.toThrow('DOM changed');
  });
});

describe('agent task message', () => {
  test('an incomplete mock runtime cannot fall back to real Ego IO', async () => {
    const runtime = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => createWorkspaceEffect(process.cwd()),
    } as CommandRuntime;
    const result = await invokeEgoOpen(runtime, 'https://example.com/');
    expect(result.code).toBe(1);
    expect(result.message).toContain('Ego effect is not configured');
  });

  test('an incomplete HTTP runtime cannot fall back to a filesystem page catalog', async () => {
    const runtime = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => createWorkspaceEffect(process.cwd()),
    } as CommandRuntime;
    const response = await createHttpApp(runtime).request('/api/pages');
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, message: 'Page resource catalog is not configured' });
  });

  test('contains only host skill, SOP FQN, page and originating targetRef', () => {
    const message = buildAgentTaskMessage({
      action: 'Codument.Demo.SOP.GoogleSearch',
      pageName: 'google-search',
      targetRef: 'page_target_exact',
    });
    expect(message).toContain('codument skill');
    expect(message).toContain('Codument.Demo.SOP.GoogleSearch');
    expect(message).toContain('page: google-search');
    expect(message).toContain('page_target_exact');
    expect(message).not.toContain('supplier risk');
    expect(message).not.toContain('page-workflow');
    expect(message).not.toContain('SOP:');
  });

  test('requires binding and routes the structured task to the selected Codex task', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-agent-bridge-'));
    const sent: string[] = [];
    const listQueries: unknown[] = [];
    const runtime: CommandRuntime = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => createWorkspaceEffect(root),
      agent: 'codex',
      codex: {
        listThreads: async (query) => {
          listQueries.push(query);
          return [
            { id: 'codex-task', cwd: root, name: 'Current task' },
            { id: 'other-task', cwd: '/another/workspace', name: 'Other task' },
          ];
        },
        sendMessage: async ({ message, threadId }) => {
          sent.push(message);
          return { accepted: true, threadId: threadId ?? '', via: 'desktop' };
        },
      },
      page: {
        skillsDirs: ['.agents/skills'],
        pages: {
          list: async () => [],
          get: async (name) => name === 'google-search' ? {
            name,
            description: '谷歌搜索',
            navigation: { label: '谷歌搜索', group: 'demo', groupLabel: 'demo', order: 1000, icon: null, visible: true },
            localFunctions: [],
            relativePath: 'pages/google-search/',
            status: 'ready' as const,
            entryUrl: '/pages/google-search/',
            builtAt: 1,
            source: 'skill' as const,
            agentAction: {
              action: 'Codument.Demo.SOP.GoogleSearch',
              workflowFqn: 'Codument.GoogleSearch.Workflow.Search',
            },
          } : undefined,
          asset: async () => undefined,
        },
      },
    };
    const pages = createPageInstanceHub();
    const messages: Array<Record<string, unknown>> = [];
    const socket = { send(data: string) { messages.push(JSON.parse(data)); } };
    pages.add(socket);
    pages.message(socket, JSON.stringify({ type: 'page.register', pageName: 'google-search' }));
    const targetRef = String(messages[0].targetRef);
    const app = createHttpApp(runtime, undefined, pages, {
      serveInstance: { serverInstanceId: 'fixture', pid: 1, host: '127.0.0.1', port: 8787, url: 'http://127.0.0.1:8787/' },
    });
    const task = {
      targetRef,
      action: 'Codument.Demo.SOP.GoogleSearch',
    };
    const unbound = await app.request('/api/agent/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(task) });
    expect(unbound.status).toBe(409);
    expect((await unbound.json() as { bindingRequired?: boolean }).bindingRequired).toBe(true);
    const available = await app.request('/api/agent/targets');
    expect(available.status).toBe(200);
    expect((await available.json() as { targets: Array<{ targetId: string }> }).targets.map((target) => target.targetId)).toEqual(['codex-task']);
    expect(listQueries[0]).toMatchObject({ cwd: root, useStateDbOnly: true, sortMode: 'recency_desc' });
    const bound = await app.request('/api/agent/bind', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetId: 'codex-task', scopeId: '' }),
    });
    expect(bound.status).toBe(200);
    const delivered = await app.request('/api/agent/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(task) });
    expect(delivered.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(targetRef);
    expect(sent[0]).toContain('Codument.Demo.SOP.GoogleSearch');
    expect(sent[0]).not.toContain('page-workflow');
  });

  test('standalone transport allowlists the page action and sends only schema-valid canonical input', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-agent-bridge-'));
    const sent: string[] = [];
    const runtime: CommandRuntime = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => createWorkspaceEffect(root),
      agent: 'codex',
      codex: {
        listThreads: async () => [{ id: 'codex-task', cwd: root, name: 'Current task' }],
        sendMessage: async ({ message, threadId }) => {
          sent.push(message);
          return { accepted: true, threadId: threadId ?? '', via: 'desktop' };
        },
      },
      page: {
        skillsDirs: ['.agents/skills'],
        pages: {
          list: async () => [],
          get: async (name) => name === 'open-data-export' ? {
            name,
            description: 'Open Data Export',
            navigation: { label: 'Open Data Export', group: 'demo', groupLabel: 'demo', order: 1000, icon: null, visible: true },
            localFunctions: [],
            relativePath: 'pages/open-data-export/',
            status: 'ready' as const,
            entryUrl: '/pages/open-data-export/',
            builtAt: 1,
            source: 'skill' as const,
            agentAction: {
              action: 'Codument.Demo.SOP.OwidOpenDataExport',
              workflowFqn: 'Codument.OpenDataExport.Workflow.Export',
              inputSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['chartSlug', 'startYear'],
                properties: { chartSlug: { const: 'life-expectancy' }, startYear: { type: 'integer' } },
              },
            },
          } : undefined,
          asset: async () => undefined,
        },
      },
    };
    const pages = createPageInstanceHub();
    const registered: Array<Record<string, unknown>> = [];
    const socket = { send(data: string) { registered.push(JSON.parse(data)); } };
    pages.add(socket);
    pages.message(socket, JSON.stringify({ type: 'page.register', pageName: 'open-data-export' }));
    const targetRef = String(registered[0].targetRef);
    const app = createHttpApp(runtime, undefined, pages, {
      serveInstance: { serverInstanceId: 'fixture', pid: 1, host: '127.0.0.1', port: 8787, url: 'http://127.0.0.1:8787/' },
    });
    await app.request('/api/agent/bind', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetId: 'codex-task', scopeId: '' }),
    });
    const send = (body: unknown) => app.request('/api/agent/send', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    expect((await send({ targetRef, action: 'Unknown.Action' })).status).toBe(400);
    expect((await send({
      targetRef,
      action: 'Codument.Demo.SOP.OwidOpenDataExport',
      input: { chartSlug: 'life-expectancy', startYear: 2000, unknown: true },
    })).status).toBe(400);
    expect((await send({ targetRef, action: 'Codument.Demo.SOP.OwidOpenDataExport', extra: true })).status).toBe(400);
    expect((await send({ targetRef: 'page_target_stale', action: 'Codument.Demo.SOP.OwidOpenDataExport' })).status).toBe(409);
    expect(sent).toHaveLength(0);
    expect((await send({
      targetRef,
      action: 'Codument.Demo.SOP.OwidOpenDataExport',
      input: { startYear: 2000, chartSlug: 'life-expectancy' },
    })).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEndWith('input: {"chartSlug":"life-expectancy","startYear":2000}');
  });

});
