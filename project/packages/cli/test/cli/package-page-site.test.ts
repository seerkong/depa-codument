import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPageResourceCatalog } from '../../src/cli/runtime/page-registry';
import { createSiteResourceCatalog } from '../../src/cli/runtime/site-registry';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { createCommandRuntime } from '../../src/cli/runtime';
import { createHttpApp } from '../../src/cli/http/app';
import { loadAuthoringPackageDescriptor, readAuthoringPackageMaterialSet } from '../../src/cli/resources/authoring-package-materializer';
import { writeSkillApp } from '../fixtures/xnl-skill-app';

const roots = new Set<string>();
const contractPackage = 'depa-codument-skill-app-contract';

afterEach(async () => {
  await Promise.all([...roots].map((root) => fs.rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function linkContract(packageRoot: string): Promise<void> {
  const installedContract = path.join(packageRoot, 'node_modules', ...contractPackage.split('/'));
  await fs.mkdir(path.dirname(installedContract), { recursive: true });
  await fs.symlink(path.resolve(import.meta.dir, '../../../skill-app-contract'), installedContract);
}

async function fixture(): Promise<{ root: string; skill: string; pageRoot: string; siteRoot: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-package-pages-'));
  roots.add(root);
  const skill = path.join(root, '.agents/skills/code-first-pages');
  const pageRoot = path.join(skill, 'page-bundles/learning-flow');
  const siteRoot = path.join(skill, 'sites/learning');
  await writeSkillApp(skill, 'code-first-pages');
  await fs.mkdir(path.join(pageRoot, 'src/views'), { recursive: true });
  await fs.mkdir(path.join(siteRoot, 'src'), { recursive: true });
  // Model npm's workspace layout: dependencies are hoisted beside the root
  // lockfile and no package-local node_modules directory exists.
  await linkContract(skill);
  await fs.writeFile(path.join(skill, 'bun.lock'), JSON.stringify({
    lockfileVersion: 1,
    workspaces: {
      'page-bundles/learning-flow': {
        name: '@test/learning-flow',
        dependencies: {
          [contractPackage]: '0.1.1', vue: '3.5.41', 'vue-router': '4.5.1',
        },
      },
      'sites/learning': {
        name: '@test/learning',
        dependencies: { [contractPackage]: '0.1.1', vue: '3.5.41' },
      },
    },
    packages: {
      [contractPackage]: [`${contractPackage}@0.1.1`, 'https://registry.example.test/contract.tgz', { dependencies: { 'halfcode-compiler.xnl': '0.3.0' } }, 'sha512-contract-fixture'],
      'halfcode-compiler.xnl': ['halfcode-compiler.xnl@0.3.0', 'https://registry.example.test/compiler.tgz', {}, 'sha512-compiler-fixture'],
      '@test/learning/vue': ['vue@3.5.41', 'https://registry.example.test/vue-3.5.41.tgz', {}, 'sha512-vue-fixture'],
      '@test/learning-flow/vue': ['vue@3.5.41', 'https://registry.example.test/vue-3.5.41.tgz', {}, 'sha512-vue-fixture'],
      '@test/learning-flow/vue-router': ['vue-router@4.5.1', 'https://registry.example.test/vue-router-4.5.1.tgz', {}, 'sha512-router-fixture'],
    },
  }, null, 2));
  for (const packageRoot of [pageRoot, siteRoot]) {
    await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
      name: `@test/${path.basename(packageRoot)}`,
      private: true,
      type: 'module',
      dependencies: {
        [contractPackage]: '0.1.1',
        vue: '3.5.41',
        ...(packageRoot === pageRoot ? { 'vue-router': '4.5.1' } : {}),
      },
    }, null, 2));
  }
  await fs.writeFile(path.join(pageRoot, 'manifest.xnl'), [
    '<PageBundle #Test.Typed.PageBundle.Learning envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {',
    '  profile = "vue-package"',
    '  packageRoot = "vfs://."',
    '  descriptor = "vfs://./src/halfcode.page.ts"',
    '  buildProfile = "vue-managed"',
    '}>', '',
  ].join('\n'));
  await fs.writeFile(path.join(pageRoot, 'src/halfcode.page.ts'), [
    'import { defineVuePageBundle, pageRoute } from "depa-codument-skill-app-contract/vue";',
    'export default defineVuePageBundle({',
    '  fqn: "Test.Typed.PageBundle.Learning", name: "learning-flow", description: "Typed learning flow",',
    '  entry: "src/App.vue", expose: "./app",',
    '  routes: [',
    '    pageRoute({ path: "/", component: "./views/OverviewView.vue", page: { fqn: "Test.Typed.Page.Overview", name: "typed-overview", title: "Overview" } }),',
    '    pageRoute({ path: "/practice", alias: ["/exercises"], component: "./views/PracticeView.vue", page: { fqn: "Test.Typed.Page.Practice", name: "typed-practice", title: "Practice" } }),',
    '    { path: "/progress", redirect: "/" },',
    '    { path: "/internal" },',
    '  ],',
    '});', '',
  ].join('\n'));
  await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template><main><RouterView /></main></template>');
  await fs.writeFile(path.join(pageRoot, 'src/views/OverviewView.vue'), '<template><h1>Overview</h1></template>');
  await fs.writeFile(path.join(pageRoot, 'src/views/PracticeView.vue'), '<template><h1>Practice</h1></template>');
  await fs.writeFile(path.join(siteRoot, 'manifest.xnl'), [
    '<Site #Test.Typed.Site.Learning envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {',
    '  profile = "site-package"',
    '  packageRoot = "vfs://."',
    '  descriptor = "vfs://./src/site.ts"',
    '  buildProfile = "vue-federation-host"',
    '}>', '',
  ].join('\n'));
  await fs.writeFile(path.join(siteRoot, 'src/site.ts'), [
    'import { defineSite, pageRef } from "depa-codument-skill-app-contract/site";',
    'export default defineSite({',
    '  fqn: "Test.Typed.Site.Learning", name: "typed-learning", description: "Typed learning site",',
    '  label: "Learning", defaultMount: "overview", entry: "src/main.ts", expose: "./site",',
    '  lifecycle: { mount: "install", unmount: "dispose" },',
    '  mounts: [',
    '    { id: "overview", path: "/", page: pageRef("Test.Typed.Page.Overview"), order: 10 },',
    '    { id: "practice", path: "/practice", page: pageRef("Test.Typed.Page.Practice"), order: 20 },',
    '  ],',
    '});', '',
  ].join('\n'));
  await fs.writeFile(path.join(siteRoot, 'src/main.ts'), [
    'import { createApp } from "vue";',
    'const SiteShell = { template: `<section><div data-halfcode-site-outlet></div></section>` };',
    'export function install(root) { const app = createApp(SiteShell); app.mount(root); return () => app.unmount(); }',
    'export function dispose() {}',
    'export default SiteShell;',
    '',
  ].join('\n'));
  return { root, skill, pageRoot, siteRoot };
}

describe('package-authored PageBundle and Site', () => {
  test('materializes explicit typed page routes and filters redirects, groups, and ordinary Vue modules', async () => {
    const value = await fixture();
    const resources = createWorkspaceResourceCatalog(value.root, ['.agents/skills']);
    const snapshot = await resources.snapshot();
    expect(snapshot.ready).toBe(true);
    expect(snapshot.resources.find((item) => item.fqn === 'Test.Typed.PageBundle.Learning')?.materialDigest).toBeDefined();
    const pages = createPageResourceCatalog(resources);
    expect((await pages.list()).filter((page) => page.bundleFqn === 'Test.Typed.PageBundle.Learning')).toEqual([
      expect.objectContaining({ fqn: 'Test.Typed.Page.Overview', name: 'typed-overview', sourceRoute: '/' }),
      expect.objectContaining({ fqn: 'Test.Typed.Page.Practice', name: 'typed-practice', sourceRoute: '/practice', routeAliases: ['/exercises'] }),
    ]);
    const demand = await pages.buildDemand?.('typed-overview');
    expect(demand?.watchFiles).toEqual([
      path.join(value.pageRoot, 'package.json'),
      path.join(value.skill, 'bun.lock'),
    ]);
    expect(demand).toMatchObject({
      packageBuild: {
        packageName: '@test/learning-flow',
        generationId: snapshot.resources.find((item) => item.fqn === 'Test.Typed.PageBundle.Learning')?.materialDigest,
        pages: [
          { fqn: 'Test.Typed.Page.Overview', route: '/' },
          { fqn: 'Test.Typed.Page.Practice', route: '/practice' },
        ],
        source: {
          descriptor: 'src/halfcode.page.ts',
          sourceDigest: expect.stringMatching(/^sha256:/),
          lockDigest: expect.stringMatching(/^sha256:/),
        },
        toolchain: { contractVersion: '0.1.1' },
      },
    });
  });

  test('admits a typed Site through the same canonical Site runtime shape', async () => {
    const value = await fixture();
    const resources = createWorkspaceResourceCatalog(value.root, ['.agents/skills']);
    const sites = createSiteResourceCatalog(resources, createPageResourceCatalog(resources));
    expect(await sites.list()).toEqual([
      expect.objectContaining({
        fqn: 'Test.Typed.Site.Learning', name: 'typed-learning', defaultMount: 'overview', implicit: false,
        runtime: expect.objectContaining({
          type: 'module-federation', buildIdentity: 'site-typed-learning', buildStatus: 'idle',
          entry: 'src/main.ts', expose: './site', lifecycle: { mount: 'install', unmount: 'dispose' },
        }),
        mounts: [
          expect.objectContaining({ id: 'overview', pageFqn: 'Test.Typed.Page.Overview', url: '/sites/typed-learning/' }),
          expect.objectContaining({ id: 'practice', pageFqn: 'Test.Typed.Page.Practice', url: '/sites/typed-learning/practice' }),
        ],
      }),
    ]);
    const demand = await sites.buildDemand?.('typed-learning');
    expect(demand?.watchFiles).toEqual([
      path.join(value.siteRoot, 'package.json'),
      path.join(value.skill, 'bun.lock'),
    ]);
    expect(demand).toMatchObject({
      pageName: 'site-typed-learning', buildIdentity: 'site-typed-learning',
      pageRoot: value.siteRoot, entry: 'src/main.ts', expose: './site',
      packageBuild: {
        packageName: '@test/learning', generationId: expect.stringMatching(/^sha256:/),
        pages: [
          { fqn: 'Test.Typed.Page.Overview', route: '/' },
          { fqn: 'Test.Typed.Page.Practice', route: '/practice' },
        ],
        source: {
          descriptor: 'src/site.ts', sourceDigest: expect.stringMatching(/^sha256:/),
          lockDigest: expect.stringMatching(/^sha256:/),
        },
        toolchain: { contractVersion: '0.1.1' },
      },
    });
  });

  test('rejects an incomplete Site frontend lifecycle contract', async () => {
    const value = await fixture();
    const descriptor = path.join(value.siteRoot, 'src/site.ts');
    await fs.writeFile(descriptor, (await fs.readFile(descriptor, 'utf8'))
      .replace('lifecycle: { mount: "install", unmount: "dispose" },', 'lifecycle: { mount: "install", unmount: "" },'));
    const resources = createWorkspaceResourceCatalog(value.root, ['.agents/skills']);
    await expect(createSiteResourceCatalog(resources, createPageResourceCatalog(resources)).list())
      .rejects.toThrow(/lifecycle\.unmount/);
  });

  test('builds and serves a package Site as an immutable official federation generation', async () => {
    const value = await fixture();
    const runtime = createCommandRuntime(value.root);
    const app = createHttpApp(runtime);
    try {
      const opened = await app.request('/api/sites/typed-learning/open', { method: 'POST' });
      if (opened.status !== 200) {
        throw new Error(`Site open failed (${opened.status}): ${await opened.text()}`);
      }
      expect(opened.status).toBe(200);
      let site = await runtime.page!.sites!.get('typed-learning');
      for (let attempt = 0; attempt < 500 && site?.runtime?.buildStatus !== 'ready'; attempt += 1) {
        await Bun.sleep(20);
        site = await runtime.page!.sites!.get('typed-learning');
      }
      const remoteEntryUrl = site?.runtime?.remoteEntryUrl;
      const mfManifestUrl = site?.runtime?.mfManifestUrl;
      const firstGeneration = site?.runtime?.generation;
      expect(site?.runtime).toMatchObject({
        buildStatus: 'ready', generation: expect.any(String),
        remoteEntryUrl: expect.stringContaining('/site-builds/typed-learning/'),
        mfManifestUrl: expect.stringContaining('/site-builds/typed-learning/'),
      });
      expect((await app.request(remoteEntryUrl!)).status).toBe(200);
      expect((await app.request(mfManifestUrl!)).status).toBe(200);
      const firstReceiptResponse = await app.request(
        `/site-builds/typed-learning/${firstGeneration!}/halfcode-build-receipt.json`,
      );
      expect(firstReceiptResponse.status).toBe(200);
      const firstReceipt = await firstReceiptResponse.json() as {
        generationId: string; source: { sourceDigest: string; lockDigest: string };
      };
      const firstReceiptGenerationId = firstReceipt.generationId;
      const firstSourceDigest = firstReceipt.source.sourceDigest;
      const firstLockDigest = firstReceipt.source.lockDigest;
      expect(firstReceipt).toMatchObject({
        generationId: expect.stringMatching(/^sha256:/),
        source: { sourceDigest: expect.stringMatching(/^sha256:/), lockDigest: expect.stringMatching(/^sha256:/) },
      });

      const siteEntry = path.join(value.siteRoot, 'src/main.ts');
      await fs.appendFile(siteEntry, '\n// watcher provenance generation two\n');
      for (let attempt = 0; attempt < 500; attempt += 1) {
        await Bun.sleep(20);
        site = await runtime.page!.sites!.get('typed-learning');
        if (site?.runtime?.generation && site.runtime.generation !== firstGeneration) break;
      }
      const secondGeneration = site!.runtime!.generation!;
      expect(secondGeneration).not.toBe(firstGeneration);
      const secondReceiptResponse = await app.request(
        `/site-builds/typed-learning/${secondGeneration}/halfcode-build-receipt.json`,
      );
      expect(secondReceiptResponse.status).toBe(200);
      const secondReceipt = await secondReceiptResponse.json() as {
        generationId: string; source: { sourceDigest: string; lockDigest: string };
      };
      expect(secondReceipt.generationId).not.toBe(firstReceiptGenerationId);
      expect(secondReceipt.source.sourceDigest).not.toBe(firstSourceDigest);
      expect(secondReceipt.source.lockDigest).toBe(firstLockDigest);

      const lockPath = path.join(value.skill, 'bun.lock');
      const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      lock.packages['depa-codument-skill-app-contract'][3] = 'sha512-contract-generation-three';
      await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
      for (let attempt = 0; attempt < 500; attempt += 1) {
        await Bun.sleep(20);
        site = await runtime.page!.sites!.get('typed-learning');
        if (site?.runtime?.generation && site.runtime.generation !== secondGeneration) break;
      }
      const thirdGeneration = site!.runtime!.generation!;
      expect(thirdGeneration).not.toBe(secondGeneration);
      const thirdReceiptResponse = await app.request(
        `/site-builds/typed-learning/${thirdGeneration}/halfcode-build-receipt.json`,
      );
      expect(thirdReceiptResponse.status).toBe(200);
      const thirdReceipt = await thirdReceiptResponse.json() as {
        generationId: string; source: { sourceDigest: string; lockDigest: string };
      };
      expect(thirdReceipt.generationId).not.toBe(secondReceipt.generationId);
      expect(thirdReceipt.source.sourceDigest).toBe(secondReceipt.source.sourceDigest);
      expect(thirdReceipt.source.lockDigest).not.toBe(secondReceipt.source.lockDigest);
      const officialRuntime = await app.request('/module-federation-runtime.js');
      expect(officialRuntime.status).toBe(200);
      expect(await officialRuntime.text()).toContain('createInstance');
    } finally {
      await runtime.page?.builds?.shutdown();
    }
  }, 30_000);

  test('fails closed when a package profile also declares legacy route authority', async () => {
    const value = await fixture();
    const manifest = path.join(value.pageRoot, 'manifest.xnl');
    await fs.writeFile(manifest, (await fs.readFile(manifest, 'utf8')).replace('}>', '} (\n  <Routes []>\n)>'));
    const resources = createWorkspaceResourceCatalog(value.root, ['.agents/skills']);
    const snapshot = await resources.snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.some((item) => /authority|legacy|subdomain/i.test(`${item.code} ${item.message}`))).toBe(true);
  });

  test('rejects intermediate source-directory symlinks during closure read and descriptor build', async () => {
    const unsafeRead = await fixture();
    const outsideViews = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-page-views-outside-'));
    roots.add(outsideViews);
    await fs.cp(path.join(unsafeRead.pageRoot, 'src/views'), outsideViews, { recursive: true });
    await fs.rm(path.join(unsafeRead.pageRoot, 'src/views'), { recursive: true, force: true });
    await fs.symlink(outsideViews, path.join(unsafeRead.pageRoot, 'src/views'));
    const snapshot = await createWorkspaceResourceCatalog(unsafeRead.root, ['.agents/skills']).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.some((item) => item.code === 'WORKSPACE_PAGE_PACKAGE_SOURCE_UNSAFE')).toBe(true);

    const unsafeBuild = await fixture();
    const ready = await createWorkspaceResourceCatalog(unsafeBuild.root, ['.agents/skills']).snapshot();
    const resource = ready.resources.find((item) => item.fqn === 'Test.Typed.PageBundle.Learning')!;
    const material = await readAuthoringPackageMaterialSet(resource, 'PageBundle');
    const outsideSource = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-page-source-outside-'));
    roots.add(outsideSource);
    await fs.cp(path.join(unsafeBuild.pageRoot, 'src'), outsideSource, { recursive: true });
    await fs.rm(path.join(unsafeBuild.pageRoot, 'src'), { recursive: true, force: true });
    await fs.symlink(outsideSource, path.join(unsafeBuild.pageRoot, 'src'));
    await expect(loadAuthoringPackageDescriptor(material)).rejects.toMatchObject({ code: 'WORKSPACE_PAGE_PACKAGE_SOURCE_UNSAFE' });
  });

  test('uses only descriptor/import graph, package config, and relevant lock evidence in identity', async () => {
    const value = await fixture();
    const snapshot = await createWorkspaceResourceCatalog(value.root, ['.agents/skills']).snapshot();
    const resource = snapshot.resources.find((item) => item.fqn === 'Test.Typed.PageBundle.Learning')!;
    const first = await readAuthoringPackageMaterialSet(resource, 'PageBundle');
    expect(first.files).toContain('src/halfcode.page.ts');
    expect(first.files).toContain('src/App.vue');
    expect(first.files).toContain('src/views/OverviewView.vue');
    expect(first.files).not.toContain('README.md');
    expect(first.files).not.toContain('tests/routes.test.ts');

    await fs.mkdir(path.join(value.pageRoot, 'tests'), { recursive: true });
    await fs.writeFile(path.join(value.pageRoot, 'README.md'), 'unrelated docs\n');
    await fs.writeFile(path.join(value.pageRoot, 'tests/routes.test.ts'), 'throw new Error("not material")\n');
    const second = await readAuthoringPackageMaterialSet(resource, 'PageBundle');
    expect(second.digest).toBe(first.digest);

    await fs.writeFile(path.join(value.pageRoot, 'src/views/OverviewView.vue'), '<template><h1>Changed</h1></template>');
    const third = await readAuthoringPackageMaterialSet(resource, 'PageBundle');
    expect(third.digest).not.toBe(second.digest);
  });

  test('rejects an unsupported contract major before evaluating descriptors', async () => {
    const value = await fixture();
    const manifestPath = path.join(value.pageRoot, 'package.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.dependencies[contractPackage] = '3.0.0';
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const lockPath = path.join(value.skill, 'bun.lock');
    const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
    lock.workspaces['page-bundles/learning-flow'].dependencies[contractPackage] = '3.0.0';
    await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
    const snapshot = await createWorkspaceResourceCatalog(value.root, ['.agents/skills']).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.some((item) => item.code === 'WORKSPACE_PAGE_PACKAGE_CONTRACT_VERSION_INVALID')).toBe(true);
  });

  test('materializes PageBundle and Site when Bun keeps dependencies package-local', async () => {
    const value = await fixture();
    const contractRoot = path.resolve(import.meta.dir, '../../../skill-app-contract');
    await fs.rm(path.join(value.skill, 'node_modules'), { recursive: true, force: true });
    await Promise.all([value.pageRoot, value.siteRoot].map(async (packageRoot) => {
      const installedContract = path.join(packageRoot, 'node_modules', ...contractPackage.split('/'));
      await fs.mkdir(path.dirname(installedContract), { recursive: true });
      await fs.symlink(contractRoot, installedContract);
    }));
    const resources = createWorkspaceResourceCatalog(value.root, ['.agents/skills']);
    expect((await createPageResourceCatalog(resources).list()).filter((page) => page.bundleFqn)).toHaveLength(2);
    expect(await createSiteResourceCatalog(resources, createPageResourceCatalog(resources)).get('typed-learning')).toBeDefined();
  });
});
