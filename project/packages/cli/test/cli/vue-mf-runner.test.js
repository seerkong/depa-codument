import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('Vue Module Federation frame runner', () => {
  test('does not reimplement the container init/get protocol', async () => {
    const source = await fs.readFile(path.resolve(import.meta.dir, '../../src/templates/web/vue-mf-runner.js'), 'utf8');
    expect(source).toContain('createFederationInstance');
    expect(source).toContain('.loadRemote(');
    expect(source).not.toContain('container.init');
    expect(source).not.toContain('container.get');
  });

  test('loads through the official federation runtime adapter, mounts Vue, and releases all frame resources', async () => {
    const appended = [];
    const root = { id: 'app' };
    const document = {
      head: { append(element) { appended.push(element); } },
      createElement(tagName) { return { tagName: tagName.toUpperCase(), rel: '', href: '', dataset: {} }; },
    };
    const calls = [];
    const connection = { close() { calls.push('connection.close'); }, targetRef: 'target-1' };
    const pageSdk = {
      connectPage(name) { calls.push(`connect:${name}`); return connection; },
      sendAgentTask() {},
      invokeLocalFunction() {},
    };
    const app = {
      provide(key, value) { calls.push(['provide', key, value]); return this; },
      mount(element) { calls.push(['mount', element]); },
      unmount() { calls.push('unmount'); },
    };
    const vue = { createApp(component) { calls.push(['createApp', component]); return app; } };
    const component = { name: 'LiveDashboard' };
    const federation = {
      async loadRemote(id) { calls.push(['loadRemote', id]); return { default: component }; },
    };
    const createFederationInstance = (config) => {
      calls.push(['createInstance', config]);
      return federation;
    };
    const { loadVueMfPage } = await import(`../../src/templates/web/vue-mf-runner.js?runner=${Date.now()}`);
    const loaded = await loadVueMfPage({
      pageName: 'dashboard',
      expose: './app',
      generation: 'g-1',
      remoteEntryUrl: 'http://127.0.0.1:8787/page-builds/dashboard/g-1/remoteEntry.js',
      mfManifestUrl: 'http://127.0.0.1:8787/page-builds/dashboard/g-1/mf-manifest.json',
      origin: 'http://127.0.0.1:8787',
      root,
      document,
      vue,
      pageSdk,
      fetch: async () => ({
        ok: true,
        json: async () => ({ exposes: [{ path: './app', assets: { css: { sync: ['assets/style.css'], async: [] } } }] }),
      }),
      createFederationInstance,
    });
    expect(appended).toEqual([
      expect.objectContaining({ rel: 'stylesheet', href: 'http://127.0.0.1:8787/page-builds/dashboard/g-1/assets/style.css' }),
    ]);
    expect(calls).toEqual(expect.arrayContaining([
      ['loadRemote', 'dashboard_g_1/app'], ['createApp', component], ['mount', root],
    ]));
    expect(calls.find((item) => item[0] === 'createInstance')[1]).toMatchObject({
      name: 'halfcode_host_dashboard_g_1',
      remotes: [{ name: 'dashboard_g_1', entry: 'http://127.0.0.1:8787/page-builds/dashboard/g-1/mf-manifest.json' }],
    });
    loaded.dispose();
    loaded.dispose();
    expect(calls.slice(-2)).toEqual(['unmount', 'connection.close']);
    expect(calls.filter((item) => item === 'unmount')).toHaveLength(1);
    expect(calls.filter((item) => item === 'connection.close')).toHaveLength(1);
  });

  test('rejects cross-origin runtime assets before importing a remote container', async () => {
    const { loadVueMfPage } = await import(`../../src/templates/web/vue-mf-runner.js?origin=${Date.now()}`);
    let imported = false;
    await expect(loadVueMfPage({
      pageName: 'dashboard', expose: './app', generation: 'g-1',
      remoteEntryUrl: 'https://untrusted.example/remoteEntry.js',
      mfManifestUrl: 'http://127.0.0.1:8787/page-builds/dashboard/g-1/mf-manifest.json',
      origin: 'http://127.0.0.1:8787', root: {},
      document: { head: { append() {} }, createElement() { return {}; } },
      vue: { createApp() { throw new Error('must not mount'); } },
      pageSdk: { connectPage() { throw new Error('must not connect'); } },
      fetch: async () => ({ ok: true, json: async () => ({ exposes: [] }) }),
      createFederationInstance() { imported = true; return {}; },
    })).rejects.toThrow('same-origin');
    expect(imported).toBe(false);
  });
});
