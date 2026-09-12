import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildVuePage } from 'depa-codument-page-builder-vue-support';
import { dispatchCommand } from '../../src/cli/command-registry';
import { projectPageResource } from '../../src/cli/resources/host-kind-projectors';
import { createPageResourceCatalog } from '../../src/cli/runtime/page-registry';
import { createSiteResourceCatalog } from '../../src/cli/runtime/site-registry';
import { createPageAutomationCatalog } from '../../src/cli/runtime/page-workflow';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { createCommandRuntime } from '../../src/cli/runtime';

const PAGE_ROOT = path.resolve(
  import.meta.dir,
  '../../src/templates/agents/workspace/skills/codument-demo/Page/live-vue-dashboard',
);
const SKILL_ROOT = path.resolve(PAGE_ROOT, '../..');

describe('AI-editable Vue Skill App template', () => {
  test('contains only Host-governed source and produces a loadable generation', async () => {
    expect((await fs.readdir(PAGE_ROOT)).sort()).toEqual(['manifest.xnl', 'src']);
    const resource = (await createWorkspaceResourceCatalog(SKILL_ROOT, ['.']).list('Page'))
      .find((item) => item.fqn === 'Codument.Demo.Page.LiveVueDashboard');
    expect(resource).toBeDefined();
    const manifest = projectPageResource(resource!).manifest as {
      name: string;
      version: number;
    };
    expect(manifest).toMatchObject({
      version: 1,
      name: 'live-vue-dashboard',
    });
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-vue-demo-build-'));
    const receipt = await buildVuePage({
      pageName: manifest.name,
      pageRoot: PAGE_ROOT,
      entry: 'src/App.vue',
      expose: './app',
      outputDirectory,
    });
    expect(receipt.outputFiles).toEqual(expect.arrayContaining([
      'remoteEntry.js', 'mf-manifest.json', 'vendor/vue.js',
    ]));
  });

  test('materializes explicit HTML and Vue route Pages while excluding ordinary Vue modules', async () => {
    const resources = await createWorkspaceResourceCatalog(SKILL_ROOT, [
      { root: '.', scope: 'root', origin: 'workspace-root' },
    ]);
    const automation = createPageAutomationCatalog(SKILL_ROOT, ['.']);
    const pages = await createPageResourceCatalog(resources, automation);
    const pageNames = (await pages.list()).map((page) => page.name);
    expect(pageNames).toEqual(expect.arrayContaining([
      'guide-introduction',
      'guide-reference',
      'vue-workbench-overview',
      'vue-workbench-detail',
    ]));
    expect(pageNames).not.toContain('RouteCard');
    expect(pageNames).not.toContain('OverviewView');

    const sites = await createSiteResourceCatalog(resources, pages);
    const demoSite = (await sites.list()).find((site) => site.name === 'halfcode-demo');
    expect(demoSite?.mounts.map((mount) => mount.pageName)).toEqual(expect.arrayContaining([
      'guide-introduction',
      'guide-reference',
      'vue-workbench-overview',
      'vue-workbench-detail',
    ]));

    const bundleRoot = path.resolve(SKILL_ROOT, 'PageBundle/vue-workbench');
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-vue-bundle-demo-build-'));
    const receipt = await buildVuePage({
      pageName: 'vue-workbench',
      pageRoot: bundleRoot,
      entry: 'src/App.vue',
      expose: './app',
      outputDirectory,
    });
    expect(receipt.outputFiles).toContain('remoteEntry.js');
  });

  test('exposes the same resource authority from a direct SkillApp root and an installed workspace', async () => {
    const installedWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-site-install-'));
    await fs.mkdir(path.join(installedWorkspace, '.agents/skills'), { recursive: true });
    await fs.cp(SKILL_ROOT, path.join(installedWorkspace, '.agents/skills/codument-demo'), {
      recursive: true,
    });

    const listFqns = async (workspace: string, kind: 'Site' | 'PageBundle' | 'Page') => {
      const result = await dispatchCommand([kind, 'list'], createCommandRuntime(workspace), true);
      expect(result.code).toBe(0);
      const data = result.data as {
        resources?: Array<{ fqn: string }>;
        pages?: Array<{ fqn?: string }>;
      };
      return (kind === 'Page' ? data.pages ?? [] : data.resources ?? [])
        .filter((resource): resource is { fqn: string } => typeof resource.fqn === 'string')
        .map((resource) => resource.fqn)
        .sort();
    };

    for (const kind of ['Site', 'PageBundle', 'Page'] as const) {
      expect(await listFqns(SKILL_ROOT, kind)).toEqual(await listFqns(installedWorkspace, kind));
    }
  });
});
