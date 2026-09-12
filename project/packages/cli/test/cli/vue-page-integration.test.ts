import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHttpApp } from '../../src/cli/http/app';
import { createPageInstanceHub, type PageInstanceSocket } from '../../src/cli/http/page-instances';
import { createCommandRuntime } from '../../src/cli/runtime';
import { writeBundleResources, writePageManifest, writeSkillApp } from '../fixtures/xnl-skill-app';

const ECHO_FQN = 'Codument.Demo.LiveVue.Echo';

async function fixture(): Promise<{ root: string; source: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-live-vue-integration-'));
  const skill = path.join(root, '.agents/skills/live-vue');
  const page = path.join(skill, 'pages/live-dashboard');
  await writeSkillApp(skill, 'live-vue');
  await fs.mkdir(path.join(page, 'src'), { recursive: true });
  const source = path.join(page, 'src/App.vue');
  await fs.writeFile(source, `<script setup>\nimport { invokeLocalFunction, usePageConnection } from '@ai-cli/page-sdk/vue'\nvoid invokeLocalFunction\nvoid usePageConnection\n</script>\n<template><h1>generation one</h1></template>`);
  await writePageManifest(page, {
    fqn: 'Test.LiveVue.Page.LiveDashboard',
    version: 2,
    name: 'live-dashboard',
    description: 'Live Vue integration fixture',
    localFunctions: [ECHO_FQN],
    runtime: {
      type: 'module-federation',
      'module-federation': { framework: 'vue', vue: { entry: 'src/App.vue', expose: './app' } },
    },
  });
  await writeBundleResources(skill, 'Test.LiveVue.Bundles', `
    const api = globalThis.Codument;
    if (!api) throw new Error('Host resource definition API is unavailable');
    export const definitions = [api.defineLocalFunction({
      fqn: ${JSON.stringify(ECHO_FQN)}, operation: 'query', description: 'Echo a value', runtimeCapabilities: [],
      inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false },
      configSchema: { type: 'null' },
      outputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false },
      handler: (_runtime, input) => ({ value: input.value }),
    })];
  `);
  return { root, source };
}

async function waitForGeneration(
  runtime: ReturnType<typeof createCommandRuntime>,
  previous = '',
): Promise<string> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const generation = (await runtime.page!.pages!.get('live-dashboard'))?.runtime?.generation;
    if (generation && generation !== previous) return generation;
    await Bun.sleep(20);
  }
  const page = await runtime.page!.pages!.get('live-dashboard');
  throw new Error(`Timed out waiting for Vue Page generation: ${JSON.stringify(page?.runtime)}`);
}

function pageSocket(messages: string[]): PageInstanceSocket {
  return { send(data) { messages.push(data); } };
}

describe('live Vue Skill App integration', () => {
  test('builds on first open, reuses Local Functions, and reconnects with a new target after rebuild', async () => {
    const { root, source } = await fixture();
    const runtime = createCommandRuntime(root);
    const pages = createPageInstanceHub();
    const app = createHttpApp(runtime, undefined, pages);
    try {
      const opened = await app.request('/api/pages/live-dashboard/open', { method: 'POST' });
      expect(opened.status).toBe(200);
      const firstGeneration = await waitForGeneration(runtime);
      const frame = await app.request(`/page-frame/live-dashboard/${firstGeneration}/`);
      expect(frame.status).toBe(200);
      const remote = await app.request(`/page-builds/live-dashboard/${firstGeneration}/remoteEntry.js`);
      expect(remote.status).toBe(200);

      const invoked = await app.request('/api/pages/live-dashboard/local-functions/invoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fqn: ECHO_FQN, input: { value: 'from-vue' }, config: null }),
      });
      expect(await invoked.json()).toMatchObject({ ok: true, result: { value: 'from-vue' } });

      const firstMessages: string[] = [];
      const firstSocket = pageSocket(firstMessages);
      pages.add(firstSocket);
      pages.message(firstSocket, JSON.stringify({ type: 'page.register', pageName: 'live-dashboard' }));
      const firstTarget = pages.list()[0]?.targetRef;
      expect(firstTarget).toStartWith('page_target_');

      await fs.writeFile(source, `<template><h1>generation two</h1></template>`);
      const secondGeneration = await waitForGeneration(runtime, firstGeneration);
      expect(secondGeneration).not.toBe(firstGeneration);
      expect((await app.request(`/page-frame/live-dashboard/${firstGeneration}/`)).status).toBe(404);
      expect((await app.request(`/page-frame/live-dashboard/${secondGeneration}/`)).status).toBe(200);

      pages.remove(firstSocket);
      const secondMessages: string[] = [];
      const secondSocket = pageSocket(secondMessages);
      pages.add(secondSocket);
      pages.message(secondSocket, JSON.stringify({ type: 'page.register', pageName: 'live-dashboard' }));
      expect(pages.list()[0]?.targetRef).toStartWith('page_target_');
      expect(pages.list()[0]?.targetRef).not.toBe(firstTarget);
      expect(firstMessages).toHaveLength(1);
      expect(secondMessages).toHaveLength(1);
    } finally {
      await runtime.page?.builds?.shutdown();
    }
  }, 30_000);
});
