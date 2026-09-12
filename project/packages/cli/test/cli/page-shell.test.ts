import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHttpApp } from '../../src/cli/http/app';
import { createCommandRuntime } from '../../src/cli/runtime';
import { createPageResourceCatalog } from '../../src/cli/runtime/page-registry';
import type { PageBuildRuntime } from '../../src/cli/runtime/page-build';
import { writePageManifest, writeSkillApp } from '../fixtures/xnl-skill-app';

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-page-shell-'));
  const skill = path.join(root, '.agents/skills/demo');
  await writeSkillApp(skill, 'demo');
  const page = path.join(skill, 'pages/search');
  await fs.mkdir(page, { recursive: true });
  await fs.writeFile(path.join(page, 'index.html'), '<!doctype html><title>Example Page</title><h1>raw page</h1><script src="./app.js"></script>');
  await fs.writeFile(path.join(page, 'app.js'), 'window.rawPage = true;');
  await writePageManifest(page, {
    name: 'search',
    description: 'Static example page',
    navigation: { label: 'Search', group: 'demo', groupLabel: 'Examples', order: 10 },
  });
  return root;
}

async function vueFixture(): Promise<{ root: string; builds: PageBuildRuntime }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-vue-page-shell-'));
  const skill = path.join(root, '.agents/skills/demo');
  await writeSkillApp(skill, 'demo');
  const page = path.join(skill, 'pages/dashboard');
  await fs.mkdir(path.join(page, 'src'), { recursive: true });
  await fs.writeFile(path.join(page, 'src/App.vue'), '<template><h1>Live Vue</h1></template>');
  await writePageManifest(page, {
    name: 'dashboard',
    description: 'Live Vue dashboard',
    navigation: { label: 'Dashboard', group: 'demo', groupLabel: 'Examples', order: 20 },
    runtime: {
      type: 'module-federation',
      'module-federation': { framework: 'vue', vue: { entry: 'src/App.vue', expose: './app' } },
    },
  });
  const builds: PageBuildRuntime = {
    get: () => ({
      status: 'ready', generation: 'g-1',
      remoteEntryUrl: '/page-builds/dashboard/g-1/remoteEntry.js',
      mfManifestUrl: '/page-builds/dashboard/g-1/mf-manifest.json',
    }),
    asset: async (_name, _generation, asset) => asset === 'remoteEntry.js' ? new TextEncoder().encode('export const get = () => {}') : undefined,
    subscribe: () => () => {},
    open: async () => ({ status: 'ready', generation: 'g-1' }),
    close: async () => {},
    shutdown: async () => {},
  };
  return { root, builds };
}

describe('workspace Page Shell HTTP boundary', () => {
  test('serves the host shell at public entry URLs and raw content on its isolated route', async () => {
    const app = createHttpApp(createCommandRuntime(await fixture()));
    for (const pathname of ['/workspace/', '/pages/search/']) {
      const shell = await app.request(pathname);
      expect(shell.status).toBe(200);
      const html = await shell.text();
      expect(html).toContain('page-shell.js');
      expect(html).toContain('workspace-page-frames');
      expect(html).toContain('workspace-home');
      expect(html).toContain('workspace-session-button');
      const topRow = [
        'workspace-menu-button', 'workspace-tab-previous', 'workspace-tabs',
        'workspace-tab-next', 'workspace-tab-overflow-button', 'workspace-session-button',
      ].map((id) => html.indexOf(`id="${id}"`));
      expect(topRow.every((position, index) => position >= 0 && (index === 0 || position > topRow[index - 1]))).toBe(true);
      expect(html).not.toContain('<h1>raw page</h1>');
      expect(html).not.toContain('Procurement');
    }

    const content = await app.request('/page-content/search/');
    expect(content.status).toBe(200);
    expect(await content.text()).toContain('<h1>raw page</h1>');
    const asset = await app.request('/page-content/search/app.js');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('text/javascript');
    expect(await asset.text()).toContain('window.rawPage');
  });

  test('fails closed for unknown pages and unsafe content assets', async () => {
    const app = createHttpApp(createCommandRuntime(await fixture()));
    expect((await app.request('/pages/missing/')).status).toBe(404);
    expect((await app.request('/page-content/missing/')).status).toBe(404);
    expect((await app.request('/page-content/search/%2e%2e/secret.txt')).status).toBe(404);
  });

  test('ships responsive, accessible and keyboard-operable top-row assets', async () => {
    const app = createHttpApp(createCommandRuntime(await fixture()));
    const html = await (await app.request('/workspace/')).text();
    expect(html).toContain('aria-label="打开页面菜单"');
    expect(html).toContain('aria-label="已打开页面"');
    expect(html).toContain('aria-controls="workspace-session"');
    const css = await (await app.request('/page-shell.css')).text();
    expect(css).toContain('@media(max-width:620px)');
    expect(css).toContain('overflow-x:auto');
    const script = await (await app.request('/page-shell.js')).text();
    expect(script).toContain("event.key === 'Escape'");
    expect(script).toContain('workspace-tab-overflow-button');
  });

  test('serves exact immutable Vue generations through a host-owned frame', async () => {
    const { root, builds } = await vueFixture();
    const runtime = createCommandRuntime(root);
    runtime.page!.builds = builds;
    runtime.page!.pages = createPageResourceCatalog(root, runtime.page!.skillsDirs, runtime.page!.automation, builds);
    const app = createHttpApp(runtime);

    const frame = await app.request('/page-frame/dashboard/g-1/');
    expect(frame.status).toBe(200);
    expect(frame.headers.get('cache-control')).toBe('no-store');
    const html = await frame.text();
    expect(html).toContain('data-page-name="dashboard"');
    expect(html).toContain('data-generation="g-1"');
    expect(html).toContain('data-vue-runtime-url="/page-builds/dashboard/g-1/vendor/vue.js"');
    expect(html).toContain('/vue-page-frame.js');
    expect((await app.request('/page-frame/dashboard/g-old/')).status).toBe(404);

    const asset = await app.request('/page-builds/dashboard/g-1/remoteEntry.js');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect(asset.headers.get('content-type')).toContain('text/javascript');
    expect((await app.request('/page-builds/dashboard/g-1/%2e%2e/secret')).status).toBe(404);
  });
});
