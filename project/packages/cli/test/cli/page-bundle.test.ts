import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPageResourceCatalog } from '../../src/cli/runtime/page-registry';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { writeSkillApp } from '../fixtures/xnl-skill-app';

const envelopeVersion = 'halfcode.resource-envelope/v1';

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  const value = error as { message?: string; diagnostics?: readonly unknown[] };
  return `${value.message ?? ''} ${JSON.stringify(value.diagnostics ?? [])}`;
}

async function fixture(): Promise<{ root: string; skill: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-page-bundle-'));
  const skill = path.join(root, '.agents/skills/learning');
  await writeSkillApp(skill, 'learning');
  return { root, skill };
}

async function writeHtmlBundle(skill: string): Promise<void> {
  const bundle = path.join(skill, 'page-bundles/static-lessons');
  await fs.mkdir(bundle, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(bundle, 'blueprint.html'), '<h1>Blueprint</h1>'),
    fs.writeFile(path.join(bundle, 'notation.html'), '<h1>Notation</h1>'),
    fs.writeFile(path.join(bundle, 'unlisted.html'), '<h1>Not a Page</h1>'),
    fs.writeFile(path.join(bundle, 'manifest.xnl'), [
      `<PageBundle #Test.Learning.PageBundle.Static envelopeVersion="${envelopeVersion}" specVersion=1 {`,
      '  profile = "html"',
      '  name = "static-lessons"',
      '  description = "Static lessons"',
      '} (',
      '  <Entries [',
      '    <HtmlPage #blueprint { fqn = "Test.Learning.Page.Blueprint" name = "blueprint" entry = "blueprint.html" description = "Learning blueprint" }>',
      '    <HtmlPage #notation { fqn = "Test.Learning.Page.Notation" name = "notation" entry = "notation.html" description = "Notation guide" }>',
      '  ]>',
      ')>',
      '',
    ].join('\n')),
  ]);
}

async function writeVueBundle(skill: string): Promise<void> {
  const bundle = path.join(skill, 'page-bundles/learning-flow');
  await fs.mkdir(path.join(bundle, 'src/components'), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(bundle, 'src/App.vue'), '<template><main>Learning flow</main></template>'),
    fs.writeFile(path.join(bundle, 'src/components/LessonCard.vue'), '<template><article><slot /></article></template>'),
    fs.writeFile(path.join(bundle, 'manifest.xnl'), [
      `<PageBundle #Test.Learning.PageBundle.Flow envelopeVersion="${envelopeVersion}" specVersion=1 {`,
      '  profile = "vue"',
      '  name = "learning-flow"',
      '  description = "Vue learning flow"',
      '  entry = "src/App.vue"',
      '  expose = "./app"',
      '  sources = ["src/App.vue" "src/components/LessonCard.vue"]',
      '} (',
      '  <Routes [',
      '    <RouteGroup #learning { path = "/learning" }>',
      '    <VuePage #overview { fqn = "Test.Learning.Page.Overview" name = "learning-overview" path = "/" component = "overview" description = "Overview" }>',
      '    <VuePage #lesson { fqn = "Test.Learning.Page.Lesson" name = "learning-lesson" path = "/lesson/:lessonId" component = "lesson" description = "Lesson" aliases = ["/l/:lessonId"] views = ["default" "aside"] }>',
      '    <Redirect #legacy { path = "/old-lesson" to = "/lesson/intro" }>',
      '  ]>',
      ')>',
      '',
    ].join('\n')),
  ]);
}

describe('PageBundle materialization', () => {
  test('materializes declared HTML entries and Vue renderable routes as Pages', async () => {
    const { root, skill } = await fixture();
    await writeHtmlBundle(skill);
    await writeVueBundle(skill);

    const pages = await createPageResourceCatalog(root, ['.agents/skills']).list();
    expect(pages.map((page) => page.name)).toEqual([
      'blueprint',
      'learning-lesson',
      'learning-overview',
      'notation',
    ]);
    expect(pages.find((page) => page.name === 'blueprint')).toMatchObject({
      fqn: 'Test.Learning.Page.Blueprint',
      bundleFqn: 'Test.Learning.PageBundle.Static',
      entryUrl: '/pages/blueprint/',
      status: 'ready',
    });
    expect(pages.find((page) => page.name === 'learning-lesson')).toMatchObject({
      fqn: 'Test.Learning.Page.Lesson',
      bundleFqn: 'Test.Learning.PageBundle.Flow',
      sourceRoute: '/lesson/:lessonId',
      routeAliases: ['/l/:lessonId'],
      routeViews: ['default', 'aside'],
      runtime: {
        type: 'module-federation',
        entry: 'src/App.vue',
        buildIdentity: 'Test.Learning.PageBundle.Flow',
      },
    });
    expect(pages.filter((page) => page.bundleFqn === 'Test.Learning.PageBundle.Flow')
      .map((page) => page.runtime?.buildIdentity)).toEqual([
      'Test.Learning.PageBundle.Flow',
      'Test.Learning.PageBundle.Flow',
    ]);
    expect(pages.some((page) => page.name === 'unlisted')).toBe(false);
    expect(pages.some((page) => page.name === 'lesson-card')).toBe(false);
  });

  test('rejects PageBundle path escapes, duplicate Page identities, and invalid route records', async () => {
    const { root, skill } = await fixture();
    await writeHtmlBundle(skill);
    const manifest = path.join(skill, 'page-bundles/static-lessons/manifest.xnl');
    await fs.writeFile(manifest, (await fs.readFile(manifest, 'utf8')).replace(
      'entry = "notation.html"',
      'entry = "../outside.html"',
    ));
    const escaped = await createPageResourceCatalog(root, ['.agents/skills']).list().catch((error) => error);
    expect(errorText(escaped)).toMatch(/entry.*inside|path.*escape|relative/i);

    await writeHtmlBundle(skill);
    await fs.writeFile(manifest, (await fs.readFile(manifest, 'utf8')).replace(
      'fqn = "Test.Learning.Page.Notation" name = "notation"',
      'fqn = "Test.Learning.Page.Blueprint" name = "blueprint"',
    ));
    const duplicate = await createPageResourceCatalog(root, ['.agents/skills']).list().catch((error) => error);
    expect(errorText(duplicate)).toMatch(/duplicate/i);
  });

  test('includes only declared PageBundle materials in the workspace revision', async () => {
    const { root, skill } = await fixture();
    await writeHtmlBundle(skill);
    const catalog = createWorkspaceResourceCatalog(root, ['.agents/skills']);
    const first = (await catalog.snapshot()).revision;
    await fs.writeFile(path.join(skill, 'page-bundles/static-lessons/blueprint.html'), '<h1>Changed</h1>');
    const second = (await catalog.snapshot()).revision;
    expect(second).not.toBe(first);
    await fs.writeFile(path.join(skill, 'page-bundles/static-lessons/unlisted.html'), '<h1>Ignored change</h1>');
    expect((await catalog.snapshot()).revision).toBe(second);
  });
});
