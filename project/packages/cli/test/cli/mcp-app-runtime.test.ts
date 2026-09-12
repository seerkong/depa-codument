import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createCommandRuntime } from '../../src/cli/runtime';
import { createCliMcpAppRuntime } from '../../src/cli/runtime/mcp-app';
import { writeSop, writeBundleResources, writePageManifest, writeSkillApp } from '../fixtures/xnl-skill-app';

async function addSkill(root: string, skillId: string, pageName: string, sopFqn: string): Promise<void> {
  const skill = path.join(root, '.agents/skills', skillId);
  const page = path.join(skill, 'pages', pageName);
  await writeSkillApp(skill, skillId);
  await fs.mkdir(page, { recursive: true });
  await fs.writeFile(path.join(page, 'index.html'), `<h1>${pageName}</h1>`);
  await fs.writeFile(path.join(page, 'view.js'), `globalThis.__fixture_view = '${pageName}';`);
  await writePageManifest(page, {
    fqn: `Test.${skillId}.Page.${pageName.replace(/-/g, '')}`,
    name: pageName,
    description: `${pageName} page`,
    mcpApp: { sopFqn, workflowFqn: `${skillId}.Workflow.Run`, viewAsset: 'view.js' },
  });
  await writeBundleResources(skill, `Test.${skillId}.Bundles`, `
    const api = globalThis.Codument;
    if (!api) throw new Error('Host resource definition API is unavailable');
    export const definitions = [api.definePageWorkflow({
      fqn: ${JSON.stringify(`${skillId}.Workflow.Run`)}, description: ${JSON.stringify(`${skillId} workflow`)},
      inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, runtimeCapabilities: ['page'],
      selectionPolicy: { kind: 'external-page', urlPattern: '^https://example\\.test/', cardinality: 'exactly-one' },
      defaultSelector: { direct: { byExternalPage: {} } },
      activation: { onMissing: 'open', url: 'https://example.test/' },
      resultTarget: { pageName: ${JSON.stringify(pageName)} },
      start: async () => ({}),
    })];
  `);
  await writeSop(skill, sopFqn, `${skillId}.md`, `# ${skillId} SOP`);
}

describe('CLI MCP App runtime composition', () => {
  test('reuses merged page/page-automation catalogs and resolves one exact SOP FQN', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-mcp-runtime-'));
    await addSkill(root, 'alpha', 'alpha-page', 'Alpha.SOP.Run');
    await addSkill(root, 'beta', 'beta-page', 'Beta.SOP.Run');
    const runtime = createCliMcpAppRuntime(createCommandRuntime(root));
    expect((await runtime.pages.list()).map((page) => page.name)).toEqual(['alpha-page', 'beta-page']);
    expect((await runtime.pages.list())[1]).toMatchObject({ sopFqn: 'Beta.SOP.Run' });
    expect(await runtime.pages.renderApp()).toContain("globalThis.__fixture_view = 'beta-page'");
    expect((await runtime.automation.list()).map((entry) => (entry as { fqn: string }).fqn)).toEqual([
      'alpha.Workflow.Run',
      'beta.Workflow.Run',
    ]);
    expect(await runtime.sops.get('Beta.SOP.Run')).toMatchObject({
      fqn: 'Beta.SOP.Run',
      profile: 'freeform',
      markdown: expect.stringContaining('# beta SOP'),
      contentDigest: expect.stringMatching(/^sha256:/),
      diagnostics: [],
    });
    await expect(runtime.sops.get('Unknown.SOP.Run')).rejects.toThrow('not installed or allowlisted');
  });

  test('fails closed when a SOP FQN is duplicated across skills', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-mcp-runtime-'));
    await addSkill(root, 'alpha', 'alpha-page', 'Duplicate.SOP.Run');
    await addSkill(root, 'beta', 'beta-page', 'Duplicate.SOP.Run');
    const runtime = createCliMcpAppRuntime(createCommandRuntime(root));
    await expect(runtime.sops.get('Duplicate.SOP.Run')).rejects.toThrow('Workspace resource catalog is invalid');
  });

  test('projects the same Host-owned SOP port instead of creating another scanner', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-mcp-runtime-'));
    await addSkill(root, 'alpha', 'alpha-page', 'Alpha.SOP.Run');
    const commandRuntime = createCommandRuntime(root);
    const calls: string[] = [];
    const initNotebook = commandRuntime.sop!.initNotebook;
    commandRuntime.sop = {
      list: async () => [],
      validate: async () => ({ valid: true, count: 0, diagnostics: [] }),
      async get(fqn) {
        calls.push(fqn);
        return {
          fqn,
          description: 'sentinel',
          profile: 'typed-leaf',
          markdown: '# Sentinel',
          contentDigest: 'sha256:sentinel',
          authorityDigest: 'sha256:authority',
          packageId: 'sentinel',
          skillId: 'sentinel',
          sourceRoot: '/must-not-leak',
          logicalPath: 'SOP/sentinel.md',
          diagnostics: [],
        };
      },
      initNotebook,
    };
    const document = await createCliMcpAppRuntime(commandRuntime).sops.get('Alpha.SOP.Run');
    expect(calls).toEqual(['Alpha.SOP.Run']);
    expect(document).toEqual({
      fqn: 'Alpha.SOP.Run',
      profile: 'typed-leaf',
      markdown: '# Sentinel',
      contentDigest: 'sha256:sentinel',
      diagnostics: [],
    });
  });
});
