import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPageInstanceHub, type PageInstanceSocket } from '../../src/cli/http/page-instances';
import { createPageResourceCatalog, listPageRegistry, resolvePageAsset } from '../../src/cli/runtime/page-registry';
import type { PageAutomationCatalog } from '../../src/cli/runtime/page-workflow';
import { dispatchCommand } from '../../src/cli/command-registry';
import { createCommandRuntime } from '../../src/cli/runtime';
import type { CommandRuntime } from '../../src/cli/contracts/command';
import { createWorkspaceEffect } from '../../src/cli/effects/workspace';
import { pageListCommand } from '../../src/cli/commands/page';
import { createPageInstanceTargetPort } from '../../src/cli/runtime/page-target';
import { writePageManifest, writeSkillApp } from '../fixtures/xnl-skill-app';

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-pages-'));
  const skill = path.join(root, '.agents/skills/demo');
  await writeSkillApp(skill, 'demo');
  const page = path.join(skill, 'pages/search');
  await fs.mkdir(page, { recursive: true });
  await fs.writeFile(path.join(page, 'index.html'), '<h1>static</h1>');
  await fs.writeFile(path.join(page, 'app.js'), 'window.ready = true;');
  await writePageManifest(page, {
    name: 'search',
    description: '谷歌搜索演示页',
  });
  return root;
}

function socket(hub: ReturnType<typeof createPageInstanceHub>, pageName = 'search') {
  const messages: unknown[] = [];
  const value: PageInstanceSocket = { send(data) { messages.push(JSON.parse(data)); } };
  hub.add(value);
  hub.message(value, JSON.stringify({ type: 'page.register', pageName }));
  return { value, messages };
}

describe('static page registry', () => {
  test('discovers a plain index.html without module federation metadata', async () => {
    const root = await fixture();
    const pages = await listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] });
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      name: 'search',
      description: '谷歌搜索演示页',
      skillId: 'demo',
      navigation: {
        label: '谷歌搜索演示页',
        group: 'demo',
        groupLabel: 'demo',
        order: 1000,
        icon: null,
        visible: true,
      },
      relativePath: 'pages/search/',
      status: 'ready',
      entryUrl: '/pages/search/',
    });
    const asset = await resolvePageAsset(root, 'search', 'index.html', { includeSkillPages: true, skillsDirs: ['.agents/skills'] });
    expect(new TextDecoder().decode(asset?.body)).toContain('static');
  });

  test('normalizes declared navigation without replacing Agent and MCP App contracts', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    await fs.writeFile(path.join(page, 'mcp-view.html'), '<h1>mcp</h1>');
    await writePageManifest(page, {
      name: 'search',
      description: '谷歌搜索演示页',
      navigation: { label: '搜索', group: 'examples', groupLabel: '示例', order: 10, icon: 'search', visible: false },
      agentAction: { action: 'Demo.SOP.Search', workflowFqn: 'Demo.Search.Workflow.Run' },
      mcpApp: { sopFqn: 'Demo.SOP.Search', viewAsset: 'mcp-view.html' },
    });
    expect((await listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] }))[0]).toMatchObject({
      navigation: { label: '搜索', group: 'examples', groupLabel: '示例', order: 10, icon: 'search', visible: false },
      agentAction: { action: 'Demo.SOP.Search', workflowFqn: 'Demo.Search.Workflow.Run' },
      mcpApp: { sopFqn: 'Demo.SOP.Search', viewAsset: 'mcp-view.html', status: 'ready' },
    });
  });

  test('fails only affected pages for invalid navigation and conflicting group labels', async () => {
    const root = await fixture();
    const search = path.join(root, '.agents/skills/demo/pages/search');
    await writePageManifest(search, {
      name: 'search', description: 'Search', navigation: { group: 'tools', groupLabel: 'Tools' },
    });
    const second = path.join(root, '.agents/skills/demo/pages/report');
    await fs.mkdir(second, { recursive: true });
    await fs.writeFile(path.join(second, 'index.html'), '<h1>report</h1>');
    await writePageManifest(second, {
      name: 'report', description: 'Report', navigation: { group: 'tools', groupLabel: 'Utilities' },
    });
    const conflicting = await listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] });
    expect(conflicting).toHaveLength(2);
    expect(conflicting.every((page) => page.status === 'error' && page.error?.includes('Conflicting'))).toBe(true);

    await writePageManifest(second, {
      name: 'report', description: 'Report', navigation: { group: 'Bad Group' },
    });
    const invalid = await listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] });
    expect(invalid.find((page) => page.name === 'report')).toMatchObject({ status: 'error', entryUrl: '' });
    expect(invalid.find((page) => page.name === 'report')?.error).toContain('Invalid page navigation');
    expect(invalid.find((page) => page.name === 'search')?.status).toBe('ready');
  });

  test('Page list exposes the merged catalog through the command registry', async () => {
    const root = await fixture();
    const result = await dispatchCommand(['Page', 'list'], createCommandRuntime(root), true);
    expect(result.code).toBe(0);
    expect(result.data).toMatchObject({
      command: 'Page.list',
      count: 1,
      pages: [expect.objectContaining({ name: 'search', description: '谷歌搜索演示页', relativePath: 'pages/search/' })],
    });
  });

  test('page list requires the runtime-owned catalog instead of scanning the workspace', async () => {
    const incomplete = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => createWorkspaceEffect(process.cwd()),
    } as CommandRuntime;
    const result = await pageListCommand({
      path: ['Page', 'list'],
      args: [],
      positional: [],
      options: {},
      runtime: incomplete,
    });
    expect(result.code).toBe(1);
    expect(result.message).toContain('Page resource catalog is not configured');
  });

  test('does not read installed Page manifests until a Page command consumes the catalog', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    await writePageManifest(page, {
      name: 'search',
      description: 'legacy page',
      agentAction: {
        action: 'Demo.SOP.Search',
        workflowFqn: 'Demo.Search.Workflow.Run',
        inputMode: 'workflow',
      },
    });
    const mcpManifest = path.join(root, '.agents/skills/demo/McpApp/Search/manifest.xnl');
    await fs.writeFile(mcpManifest, (await fs.readFile(mcpManifest, 'utf8')).replace(
      'inputMode = "workflow"',
      'inputMode = "workflow" inputSchema = "copied"',
    ));
    const catalog = createPageResourceCatalog(root, ['.agents/skills']);
    await Bun.sleep(10);
    await expect(catalog.list()).rejects.toThrow("contains unknown field 'inputSchema'");
  });

  test('fails closed for duplicate names and path escape', async () => {
    const root = await fixture();
    const duplicate = path.join(root, '.agents/skills/demo/pages/duplicate-search');
    await fs.mkdir(duplicate, { recursive: true });
    await fs.writeFile(path.join(duplicate, 'index.html'), 'duplicate');
    await writePageManifest(duplicate, { fqn: 'Test.Page.DuplicateSearch', name: 'search', description: 'Duplicate' });
    const pages = await listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] });
    expect(pages.every((page) => page.status === 'error' && page.error?.includes('Duplicate'))).toBe(true);
    await expect(resolvePageAsset(root, 'search', '../secret', { includeSkillPages: true, skillsDirs: ['.agents/skills'] })).rejects.toThrow('Invalid page asset path');
  });

  test('resolves Agent action schemas from PageAutomation and rejects unknown or copied workflow contracts', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    const action = {
      action: 'Demo.SOP.Search',
      workflowFqn: 'Demo.Search.Workflow.Run',
      inputMode: 'workflow',
    };
    await writePageManifest(page, {
      name: 'search',
      description: '谷歌搜索演示页',
      agentAction: action,
    });
    const workflow = {
      fqn: action.workflowFqn,
      exportName: 'run',
      target: {},
      resultTarget: { pageName: 'search' },
      inputSchema: {
        type: 'object' as const,
        additionalProperties: false,
        required: ['query'],
        properties: {
          query: { type: 'string' as const },
          targetRef: { type: 'string' as const },
        },
      },
    };
    const automation = {
      list: async () => [],
      locateWorkflow: async (fqn: string) => {
        if (fqn !== workflow.fqn) throw new Error(`PageWorkflow is not installed or allowlisted: ${fqn}`);
        return {
          workflow: workflow as never,
          source: {
            bundleFqn: 'demo.page-workflow.bundle',
            bundleKind: 'PageWorkflowBundle',
            packageId: 'demo',
            packageRoot: root,
            sourceRoot: root,
            logicalPath: 'PageWorkflow/manifest.xnl',
          },
        };
      },
      locateAction: async () => { throw new Error('unused'); },
    } satisfies PageAutomationCatalog;
    expect(await createPageResourceCatalog(root, ['.agents/skills'], automation).get('search')).toMatchObject({
      agentAction: {
        workflowFqn: workflow.fqn,
        inputSchema: {
          required: ['query'],
          properties: { query: { type: 'string' } },
        },
      },
    });

    await writePageManifest(page, {
      name: 'search',
      description: '谷歌搜索演示页',
      agentAction: { ...action, workflowFqn: 'Demo.Unknown.Workflow' },
    });
    await expect(createPageResourceCatalog(root, ['.agents/skills'], automation).list())
      .rejects.toThrow('not installed or allowlisted');

    await writePageManifest(page, {
      name: 'search',
      description: '谷歌搜索演示页',
      agentAction: action,
    });
    const mcpManifest = path.join(root, '.agents/skills/demo/McpApp/Search/manifest.xnl');
    await fs.writeFile(mcpManifest, (await fs.readFile(mcpManifest, 'utf8')).replace(
      'inputMode = "workflow"',
      'inputMode = "workflow" inputSchema = "copied"',
    ));
    await expect(createPageResourceCatalog(root, ['.agents/skills'], automation).list())
      .rejects.toThrow("contains unknown field 'inputSchema'");
  });

  test('rejects page asset symlinks even when they resolve inside the page root', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    await fs.symlink('app.js', path.join(page, 'linked-view.js'));
    await expect(resolvePageAsset(root, 'search', 'linked-view.js', {
      includeSkillPages: true,
      skillsDirs: ['.agents/skills'],
    })).rejects.toThrow('symlink is not supported');

    await fs.mkdir(path.join(page, 'assets'));
    await fs.writeFile(path.join(page, 'assets/view.js'), 'window.view = true;');
    await fs.symlink('assets', path.join(page, 'linked-assets'));
    await expect(resolvePageAsset(root, 'search', 'linked-assets/view.js', {
      includeSkillPages: true,
      skillsDirs: ['.agents/skills'],
    })).rejects.toThrow('symlink is not supported');
  });

  test('rejects a symlinked Page XNL entry', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    await fs.rename(path.join(page, 'manifest.xnl'), path.join(page, 'linked-manifest.xnl'));
    await fs.symlink('linked-manifest.xnl', path.join(page, 'manifest.xnl'));
    await expect(listPageRegistry(root, {
      includeSkillPages: true,
      skillsDirs: ['.agents/skills'],
    })).rejects.toThrow('Workspace resource catalog is invalid');
  });

  test('rejects symlinks in the page source path above the page directory', async () => {
    const root = await fixture();
    const skill = path.join(root, '.agents/skills/demo');
    const pages = path.join(skill, 'pages');
    const realPages = path.join(root, 'real-pages');
    await fs.rename(pages, realPages);
    await fs.symlink(realPages, pages);
    await expect(listPageRegistry(root, {
      includeSkillPages: true,
      skillsDirs: ['.agents/skills'],
    })).rejects.toThrow('Workspace resource catalog is invalid');
  });

  test('preserves version 1 static Page discovery and assets after adding framework runtimes', async () => {
    const root = await fixture();
    const catalog = createPageResourceCatalog(root, ['.agents/skills']);
    const page = await catalog.get('search');
    expect(page).toMatchObject({
      name: 'search',
      status: 'ready',
      entryUrl: '/pages/search/',
      relativePath: 'pages/search/',
    });
    expect(page).not.toHaveProperty('runtime');
    expect(new TextDecoder().decode((await catalog.asset('search', 'app.js'))?.body)).toContain('window.ready');
  });

  test('projects a live Vue Page by the src/App.vue material convention without manifest build fields', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    await fs.rm(path.join(page, 'index.html'));
    await fs.mkdir(path.join(page, 'src'));
    await fs.writeFile(path.join(page, 'src/App.vue'), '<template><main>Live Vue App</main></template>');
    await writePageManifest(page, {
      name: 'search',
      description: 'Live Vue search',
    });

    expect((await listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] }))[0]).toMatchObject({
      name: 'search',
      status: 'ready',
      entryUrl: '/pages/search/',
      runtime: {
        type: 'module-federation',
        framework: 'vue',
        entry: 'src/App.vue',
        expose: './app',
        buildStatus: 'idle',
        generation: null,
      },
    });
  });

  test('invalidates a cached catalog after manifest and build generation changes', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    await fs.rm(path.join(page, 'index.html'));
    await fs.mkdir(path.join(page, 'src'));
    await fs.writeFile(path.join(page, 'src/App.vue'), '<template>first</template>');
    const manifestPath = path.join(page, 'manifest.xnl');
    const manifest = {
      name: 'search',
      description: 'First description',
    };
    await writePageManifest(page, manifest);
    let generation = 'generation-1';
    const catalog = createPageResourceCatalog(root, ['.agents/skills'], undefined, {
      get: () => ({
        status: 'ready',
        generation,
        remoteEntryUrl: `/page-builds/search/${generation}/remoteEntry.js`,
        mfManifestUrl: `/page-builds/search/${generation}/mf-manifest.json`,
      }),
    });
    expect(await catalog.get('search')).toMatchObject({
      description: 'First description',
      runtime: { generation: 'generation-1' },
    });

    generation = 'generation-2';
    await writePageManifest(page, { ...manifest, description: 'Second description' });
    expect((await catalog.get('search'))?.description).toBe('Second description');
    catalog.invalidate?.('search');
    expect(await catalog.get('search')).toMatchObject({
      description: 'Second description',
      runtime: { generation: 'generation-2' },
    });
  });

  test('rejects legacy Page runtime fields, invented subdomains, and ambiguous page material', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    const manifest = await writePageManifest(page, { name: 'search', description: 'Invalid runtime' });
    await fs.writeFile(manifest, (await fs.readFile(manifest, 'utf8')).replace(
      'description = "Invalid runtime"',
      'description = "Invalid runtime"\n  runtime = "module-federation"',
    ));
    await expect(listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] }))
      .rejects.toThrow("unknown field 'runtime'");

    await writePageManifest(page, { name: 'search', description: 'Invalid runtime', navigation: { label: 'Search' } });
    await fs.writeFile(manifest, (await fs.readFile(manifest, 'utf8')).replace(
      '<Navigation',
      '<ModuleFederation { framework = "vue" entry = "src/App.vue" expose = "./app" }>\n  <Navigation',
    ));
    await expect(listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] }))
      .rejects.toThrow("unsupported Page subdomain 'ModuleFederation'");

    await writePageManifest(page, { name: 'search', description: 'Invalid runtime' });
    await fs.mkdir(path.join(page, 'src'), { recursive: true });
    await fs.writeFile(path.join(page, 'src/App.vue'), '<template>ambiguous</template>');
    await expect(listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] }))
      .rejects.toThrow('Ambiguous Page material');
  });

  test('rejects conventional Vue entry symlinks and App-owned build configuration', async () => {
    const root = await fixture();
    const page = path.join(root, '.agents/skills/demo/pages/search');
    await fs.rm(path.join(page, 'index.html'));
    await fs.mkdir(path.join(page, 'src'));
    await fs.writeFile(path.join(page, 'src/Real.vue'), '<template>real</template>');
    await fs.symlink('Real.vue', path.join(page, 'src/App.vue'));
    await expect(listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] }))
      .rejects.toThrow('symlink is not supported');

    await fs.rm(path.join(page, 'src/App.vue'));
    await fs.writeFile(path.join(page, 'src/App.vue'), '<template>app</template>');
    await fs.writeFile(path.join(page, 'vite.config.ts'), 'throw new Error("must not run")');
    await expect(listPageRegistry(root, { includeSkillPages: true, skillsDirs: ['.agents/skills'] }))
      .rejects.toThrow('App-owned build config is not supported');
  });
});

describe('page instance targetRef RPC', () => {
  test('routes only to the exact live instance', async () => {
    const hub = createPageInstanceHub({ timeoutMs: 50 });
    const first = socket(hub);
    const second = socket(hub);
    const firstRef = (first.messages[0] as { targetRef: string }).targetRef;
    const call = hub.invoke(firstRef, 'setResult', { count: 2 });
    expect(first.messages).toHaveLength(2);
    expect(second.messages).toHaveLength(1);
    const requestId = (first.messages[1] as { requestId: string }).requestId;
    hub.message(first.value, JSON.stringify({ type: 'page.response', requestId, ok: true, result: { accepted: true } }));
    expect(await call).toEqual({ accepted: true });
  });

  test('rejects stale targets, disconnects and timeouts', async () => {
    const hub = createPageInstanceHub({ timeoutMs: 5 });
    const target = socket(hub);
    const targetRef = (target.messages[0] as { targetRef: string }).targetRef;
    const pending = hub.invoke(targetRef, 'getState');
    hub.remove(target.value);
    await expect(pending).rejects.toThrow('stale');
    await expect(hub.invoke(targetRef, 'getState')).rejects.toThrow('unknown or stale');
    const live = socket(hub);
    await expect(hub.invoke((live.messages[0] as { targetRef: string }).targetRef, 'getState')).rejects.toThrow('timed out');
  });

  test('retires the previous target and pending RPC when one shared frame changes Page identity', async () => {
    const hub = createPageInstanceHub({ timeoutMs: 50 });
    const target = socket(hub, 'overview');
    const previousRef = (target.messages[0] as { targetRef: string }).targetRef;
    const pending = hub.invoke(previousRef, 'getState');
    hub.message(target.value, JSON.stringify({ type: 'page.register', pageName: 'live' }));
    const next = target.messages.at(-1) as { targetRef: string; pageName: string };
    expect(next).toMatchObject({ type: 'page.registered', pageName: 'live' });
    expect(next.targetRef).not.toBe(previousRef);
    expect(hub.list()).toEqual([{ targetRef: next.targetRef, pageName: 'live' }]);
    await expect(pending).rejects.toThrow('stale');
    await expect(hub.invoke(previousRef, 'getState')).rejects.toThrow('unknown or stale');
  });

  test('projects the WebSocket hub through the host-neutral PageTargetPort', async () => {
    const hub = createPageInstanceHub({ timeoutMs: 50 });
    const target = socket(hub);
    const targetRef = (target.messages[0] as { targetRef: string }).targetRef;
    const port = createPageInstanceTargetPort(hub);
    expect(port.get(targetRef)).toMatchObject({ targetRef, pageName: 'search' });
    const pending = port.request(targetRef, 'getState');
    const requestId = (target.messages[1] as { requestId: string }).requestId;
    hub.message(target.value, JSON.stringify({ type: 'page.response', requestId, ok: true, result: { query: 'supplier risk' } }));
    expect(await pending).toEqual({ query: 'supplier risk' });
    hub.remove(target.value);
    expect(port.get(targetRef)).toBeUndefined();
    await expect(port.request(targetRef, 'getState')).rejects.toThrow('unknown or stale');
  });
});
