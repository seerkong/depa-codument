import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHttpApp } from '../../src/cli/http/app';
import { createCommandRuntime } from '../../src/cli/runtime';
import { createPageResourceCatalog } from '../../src/cli/runtime/page-registry';
import { createSiteResourceCatalog } from '../../src/cli/runtime/site-registry';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { writePageManifest, writeSiteManifest, writeSkillApp } from '../fixtures/xnl-skill-app';

async function fixture(): Promise<{ root: string; skill: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-site-runtime-'));
  const skill = path.join(root, '.agents/skills/learning');
  await writeSkillApp(skill, 'learning');
  for (const [name, description] of [['blueprint', 'Blueprint'], ['notation', 'Notation']] as const) {
    const page = path.join(skill, 'pages', name);
    await fs.mkdir(page, { recursive: true });
    await fs.writeFile(path.join(page, 'index.html'), `<h1>${description}</h1>`);
    await writePageManifest(page, {
      fqn: `Test.Learning.Page.${description}`,
      name,
      description,
    });
  }
  return { root, skill };
}

describe('Site and PageMount runtime', () => {
  test('projects one Site with ordered mounts, default route, and one workspace entry', async () => {
    const { root, skill } = await fixture();
    await writeSiteManifest(skill, {
      fqn: 'Test.Learning.Site.Math',
      name: 'math-learn',
      description: 'Math learning site',
      defaultMount: 'blueprint',
      mounts: [
        { id: 'notation', path: '/notation', pageFqn: 'Test.Learning.Page.Notation', order: 20 },
        { id: 'blueprint', path: '/', pageFqn: 'Test.Learning.Page.Blueprint', order: 10 },
      ],
    });
    const resources = createWorkspaceResourceCatalog(root, ['.agents/skills']);
    const pages = createPageResourceCatalog(resources);
    const sites = createSiteResourceCatalog(resources, pages);
    expect(await sites.list()).toEqual([
      expect.objectContaining({
        fqn: 'Test.Learning.Site.Math',
        name: 'math-learn',
        defaultMount: 'blueprint',
        entryUrl: '/sites/math-learn/',
        implicit: false,
        mounts: [
          expect.objectContaining({ id: 'blueprint', pageName: 'blueprint', url: '/sites/math-learn/' }),
          expect.objectContaining({ id: 'notation', pageName: 'notation', url: '/sites/math-learn/notation' }),
        ],
      }),
    ]);

    const runtime = createCommandRuntime(root);
    const app = createHttpApp(runtime);
    const api = await app.request('/api/sites');
    expect(api.status).toBe(200);
    expect(((await api.json()) as { sites: unknown[] }).sites).toHaveLength(1);
    expect((await app.request('/sites/math-learn/')).status).toBe(200);
    expect((await app.request('/sites/math-learn/notation')).status).toBe(200);
    expect((await app.request('/sites/math-learn/missing')).status).toBe(404);
  });

  test('fails closed for duplicate mount paths and unresolved Page FQNs', async () => {
    const { root, skill } = await fixture();
    const manifest = await writeSiteManifest(skill, {
      name: 'broken',
      description: 'Broken site',
      defaultMount: 'first',
      mounts: [
        { id: 'first', path: '/', pageFqn: 'Test.Learning.Page.Blueprint' },
        { id: 'second', path: '/', pageFqn: 'Test.Learning.Page.Missing' },
      ],
    });
    const resources = createWorkspaceResourceCatalog(root, ['.agents/skills']);
    const sites = createSiteResourceCatalog(resources, createPageResourceCatalog(resources));
    await expect(sites.list()).rejects.toThrow(/duplicate.*path/i);

    await fs.writeFile(manifest, (await fs.readFile(manifest, 'utf8')).replace('path = "/"\n      pageFqn = "Test.Learning.Page.Missing"', 'path = "/missing"\n      pageFqn = "Test.Learning.Page.Missing"'));
    await expect(sites.list()).rejects.toThrow(/unknown Page|not found/i);
  });

  test('projects an unmounted standalone Page as an implicit one-page Site without removing legacy URLs', async () => {
    const { root } = await fixture();
    const runtime = createCommandRuntime(root);
    const sites = await runtime.page!.sites!.list();
    expect(sites).toHaveLength(2);
    expect(sites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'blueprint',
        implicit: true,
        entryUrl: '/pages/blueprint/',
        mounts: [expect.objectContaining({ pageName: 'blueprint', path: '/' })],
      }),
    ]));
    const app = createHttpApp(runtime);
    expect((await app.request('/pages/blueprint/')).status).toBe(200);
  });

  test('ships a SiteHost shell that loads Site catalogs and bridges Vue source routes', async () => {
    const app = createHttpApp(createCommandRuntime((await fixture()).root));
    const script = await (await app.request('/page-shell.js')).text();
    expect(script).toContain('/api/sites');
    expect(script).toContain('sourceRoute');
    expect(script).toContain('codument.site.navigate');
    expect(script).toContain('dataset.site');
    expect(script).toContain('/api/sites/${encodeURIComponent(site.name)}/open');
    expect(script).toContain('mountFederatedSite');
    expect(script).toContain('mounted.dispose()');
  });
});
