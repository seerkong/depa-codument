import { describe, expect, test } from 'bun:test';

describe('federated SiteHost lifecycle', () => {
  test('mounts into an allocated root and fully disposes an app-owned Site shell twice', async () => {
    const calls = [];
    const outlet = { id: 'outlet' };
    const root = {
      querySelector(selector) { calls.push(['querySelector', selector]); return outlet; },
      replaceChildren() { calls.push('replaceChildren'); },
    };
    const app = {
      mount(value) { calls.push(['app.mount', value]); },
      unmount() { calls.push('app.unmount'); },
    };
    const siteModule = {
      default: { name: 'SiteShell' },
      install(_app, context) { calls.push(['install', context]); return () => calls.push('cleanup'); },
      dispose(context) { calls.push(['dispose', context]); },
    };
    const createFederationInstance = () => ({
      async loadRemote(id) { calls.push(['loadRemote', id]); return siteModule; },
    });
    const { mountFederatedSite } = await import(`../../src/templates/web/site-host.js?test=${Date.now()}`);
    const mounted = await mountFederatedSite({
      siteName: 'learning', generation: 'g-1', expose: './site',
      remoteEntryUrl: 'http://127.0.0.1/site-builds/learning/g-1/remoteEntry.js',
      mfManifestUrl: 'http://127.0.0.1/site-builds/learning/g-1/mf-manifest.json',
      origin: 'http://127.0.0.1', root, lifecycle: { mount: 'install', unmount: 'dispose' },
      vue: { version: '3.5.41', createApp(component) { calls.push(['createApp', component]); return app; } },
      document: { head: { append() {} }, createElement() { return { dataset: {} }; } },
      fetch: async () => ({ ok: true, json: async () => ({ exposes: [] }) }),
      createFederationInstance,
    });
    expect(mounted.outlet).toBe(outlet);
    expect(calls).toContainEqual(['loadRemote', 'learning_g_1/site']);
    mounted.dispose();
    mounted.dispose();
    expect(calls.filter((value) => value === 'app.unmount')).toHaveLength(1);
    expect(calls.filter((value) => value === 'cleanup')).toHaveLength(1);
    expect(calls.filter((value) => value === 'replaceChildren')).toHaveLength(1);
    expect(calls.filter((value) => Array.isArray(value) && value[0] === 'dispose')).toHaveLength(1);
  });
});
