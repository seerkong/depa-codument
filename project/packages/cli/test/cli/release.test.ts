import builderManifest from 'halfcode-lite-page-builder-vue-support/package.json';
import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  installCommandPlan,
  installedBinaryCandidates,
  resolveReleaseTarget,
} from '../../../../scripts/install-local-release';
import { PACKAGE_NAME } from '../../src/identity';

const root = path.resolve(import.meta.dir, '../../../..');
const productVersion = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
const legacyTemplateIdentity = ['ai', 'cli', 'multi', 'packages', 'tpl'].join('-');

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

describe('release inventory', () => {
  test('source identity has no legacy template residue', async () => {
    const roots = [
      path.join(root, 'packages'),
      path.join(root, 'scripts'),
      path.join(root, 'README.md'),
      path.join(root, 'USAGE-DEMO.md'),
    ];
    const files = (await Promise.all(roots.map(async (source) => {
      const stat = await fs.stat(source);
      return stat.isDirectory() ? sourceFiles(source) : [source];
    }))).flat();
    const residue: string[] = [];
    for (const file of files) {
      if (file.includes(`${path.sep}node_modules${path.sep}`) || file.includes(`${path.sep}bin${path.sep}`)) continue;
      const text = await fs.readFile(file, 'utf8');
      if (text.toLowerCase().includes(legacyTemplateIdentity)) residue.push(path.relative(root, file));
    }
    expect(residue).toEqual([]);
  });

  test('freezes both macOS runtime package identities and executable paths', async () => {
    for (const architecture of ['arm64', 'x64'] as const) {
      const manifest = JSON.parse(await fs.readFile(path.join(root, 'packages', `runtime-darwin-${architecture}`, 'package.json'), 'utf8'));
      expect(manifest).toMatchObject({
        name: `${PACKAGE_NAME}-darwin-${architecture}`,
        version: productVersion,
        os: ['darwin'],
        cpu: [architecture],
        bin: { 'depa-codument': 'bin/depa-codument' },
      });
      expect(manifest.files).toEqual(['bin/depa-codument', 'builder-vue', 'README.md']);
      expect(manifest.dependencies).toEqual({
        'halfcode-lite-page-builder-vue-support': builderManifest.version,
        'depa-codument-skill-app-contract': '0.1.1',
        '@module-federation/runtime': '2.8.1', '@module-federation/vite': '1.20.1',
        '@vitejs/plugin-vue': '5.2.4', vite: '5.4.21', vue: '3.5.41',
      });
    }
  });

  test('freezes the Windows x64 runtime package identity and executable path', async () => {
    const manifest = JSON.parse(await fs.readFile(
      path.join(root, 'packages/runtime-windows-x64/package.json'),
      'utf8',
    ));
    expect(manifest).toMatchObject({
      name: `${PACKAGE_NAME}-windows-x64`,
      version: productVersion,
      os: ['win32'],
      cpu: ['x64'],
      bin: { 'depa-codument': 'bin/depa-codument.exe' },
    });
    expect(manifest.files).toEqual(['bin/depa-codument.exe', 'builder-vue', 'README.md']);
    expect(manifest.dependencies).toEqual({
      'halfcode-lite-page-builder-vue-support': builderManifest.version,
      'depa-codument-skill-app-contract': '0.1.1',
      '@module-federation/runtime': '2.8.1', '@module-federation/vite': '1.20.1',
      '@vitejs/plugin-vue': '5.2.4', vite: '5.4.21', vue: '3.5.41',
    });
  });

  test('embedded template inventory includes generic resources and excludes forbidden business/MCP surfaces', async () => {
    const files: string[] = [];
    async function walk(directory: string) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(absolute);
        else files.push(path.relative(path.join(root, 'packages/cli/src/templates'), absolute));
      }
    }
    await walk(path.join(root, 'packages/cli/src/templates'));
    expect(files.some((file) => file.startsWith('agents/'))).toBe(true);
    expect(files.some((file) => file.startsWith('private/'))).toBe(true);
    const pluginFiles = files.filter((file) => file.startsWith('private/global/opencli-browser-fetch/')).sort();
    expect(pluginFiles).toEqual([
      'private/global/opencli-browser-fetch/browser-fetch.js',
      'private/global/opencli-browser-fetch/opencli-plugin.json',
      'private/global/opencli-browser-fetch/package.json',
      'private/global/opencli-browser-fetch/request.d.ts',
      'private/global/opencli-browser-fetch/request.js',
    ]);
    expect(files.some((file) => file.startsWith('web/'))).toBe(true);
    expect(files.some((file) => file.includes('codument-demo/modules/google-search/pages/google-search/index.html'))).toBe(true);
    expect(files.some((file) => file.includes('codument-demo/modules/owid-open-data-export/pages/open-data-export/index.html'))).toBe(true);
    expect(files.some((file) => file.includes('sop--owid-open-data-export.md'))).toBe(true);
    expect(files).toContain('agents/global/skills/codument/references/freeform-sop.md');
    expect(files).toContain('agents/global/skills/codument/references/typed-leaf-sop.md');
    expect(files).toContain('agents/global/skills/codument/references/typed-pipeline-sop.md');
    expect(files).toContain('agents/workspace/skills/codument-demo/KindDefinitions/SOP/manifest.xnl');
    expect(files).toContain('agents/workspace/skills/codument-demo/KindDefinitions/SkillModule/manifest.xnl');
    expect(files).toContain('agents/workspace/skills/codument-demo/KindDefinitions/HostBundle/manifest.xnl');
    expect(files).toContain('private/workspace/workflows/.gitignore');
    expect(files.some((file) => /ApplicationSOP|application-sop|application_sop/.test(file))).toBe(false);
    expect(files.some((file) => file.endsWith('/page.json'))).toBe(false);
    expect(files.some((file) => file.includes('/page-automation/'))).toBe(false);
    expect(files.join('\n')).not.toMatch(/ExampleForbiddenBusinessSurface|(?:^|[\\/])mcp(?:[\\/]|$)/i);
    const [resourcePackage, localFunctionPackage, modulePackage, hostPackage, pageManifest, mcpManifest, sop, bundle, owidLogic, hostSkill, opencliPlugin] = await Promise.all([
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/LocalFunction/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/modules/google-search/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/modules/google-search/host/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/modules/google-search/pages/google-search/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/modules/google-search/mcp-apps/GoogleSearch/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/modules/google-search/sops/codument-demo--sop--google-search.md'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/PageWorkflow/bundle/index.js'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/workspace/skills/codument-demo/modules/owid-open-data-export/host/logic/owid.ts'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/agents/global/skills/codument/SKILL.md'), 'utf8'),
      fs.readFile(path.join(root, 'packages/cli/src/templates/private/global/opencli-browser-fetch/browser-fetch.js'), 'utf8'),
    ]);
    expect(resourcePackage).toContain('<SkillApp #Codument.Demo.App');
    expect(resourcePackage).toContain('<DirectoryResourceCatalog #local_functions');
    expect(localFunctionPackage).toContain('entry = "vfs://./bundle/index.js"');
    expect(localFunctionPackage).toContain('runtime = "bun"');
    expect(modulePackage).toContain('<SkillModule #Codument.Demo.Module.GoogleSearch');
    expect(modulePackage).toContain('resourceKind = "HostBundle"');
    expect(hostPackage).toContain('<HostBundle #Codument.Demo.Module.GoogleSearch.Host');
    expect(hostPackage).toContain('sources = ["vfs://./entry.ts" "vfs://./logic" "vfs://./adapters"]');
    expect(hostPackage).toContain('exports = ["PageWorkflow" "PageObject"]');
    expect(pageManifest).not.toMatch(/\bruntime\s*=|\bentry\s*=|<AgentAction|<McpApp|<ModuleFederation/);
    expect(mcpManifest).toContain('workflowFqn = "Codument.GoogleSearch.Workflow.Search"');
    expect(sop).toContain('fqn: Codument.Demo.SOP.GoogleSearch');
    expect(bundle).toContain('Stable source-import compatibility shim');
    expect(bundle).not.toContain("session.send('Page.download'");
    expect(owidLogic).toContain("session.send('Page.download'");
    for (const command of ['serve start', 'serve stop', 'serve restart', 'serve status']) expect(hostSkill).toContain(command);
    for (const command of ['Resource tree', 'Page list', 'LocalFunction list', 'PageWorkflow list', 'PageObject list']) {
      expect(hostSkill).toContain(command);
    }
    expect(hostSkill).toContain('manifest.xnl');
    expect(hostSkill).toContain('Bundle');
    expect(hostSkill).toContain('SOP notebook init');
    expect(hostSkill).toContain('markdown-step-graph/v1');
    expect(hostSkill).not.toMatch(/\bpage\.json\b|`page list|`page-automation list|`page-workflow|`local-function/);
    expect(opencliPlugin).toContain("site: 'codument-opencli'");
    expect(opencliPlugin).toContain('navigateBefore: false');
  });

  test('quick-use documentation covers direct workflow, Codex Page, Claude MCP App, lifecycle and live/fixture boundaries', async () => {
    const [readme, usage] = await Promise.all([
      fs.readFile(path.join(root, 'README.md'), 'utf8'),
      fs.readFile(path.join(root, 'USAGE-DEMO.md'), 'utf8'),
    ]);
    const docs = `${readme}\n${usage}`;
    expect(docs).toContain('Codument.Owid.OpenDataExport.Workflow.Run');
    expect(docs).toContain('serve start');
    expect(docs).toContain('serve status');
    expect(docs).toContain('serve restart');
    expect(docs).toContain('serve stop');
    expect(docs).toContain('Codex');
    expect(docs).toContain('Claude Desktop');
    expect(docs).toContain('fixture');
    expect(docs).toContain('live');
    expect(docs).toContain('business envelope');
    expect(docs).toContain('SOP validate');
    expect(docs).toContain('SOP notebook init');
    expect(docs).toContain('markdown-step-graph/v1');
    expect(docs).toContain('--transport opencli');
    expect(docs).toContain('--opencli-transport plugin');
    expect(docs).toContain('benchmark:browser-backends');
    expect(docs).toContain('"entityCodes":["CHN","TUR"]');
    expect(docs).toContain('"downloadScope":"displayed"');
    expect(docs).not.toContain('"entities":["CHN","TUR"]');
    expect(docs).not.toContain('ApplicationSOP');
  });

  test('ships one reusable MCP App workspace capsule without a second platform package identity', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'packages/mcp-app/package.json'), 'utf8'));
    expect(manifest).toMatchObject({
      name: `${PACKAGE_NAME}-mcp-app-capsule`,
      version: '0.6.0',
      main: 'src/index.ts',
    });
    expect(manifest.private).not.toBe(true);
    const packageDirs = (await fs.readdir(path.join(root, 'packages'), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(packageDirs.filter((name) => name.startsWith('runtime-'))).toEqual([
      'runtime-darwin-arm64',
      'runtime-darwin-x64',
      'runtime-windows-x64',
    ]);
  });
});

describe('local release installer plan', () => {
  test('selects the current platform target and removes every conflicting package before install', () => {
    const arm = resolveReleaseTarget('darwin', 'arm64');
    expect(arm.packageName).toEndWith('-arm64');
    const commands = installCommandPlan(arm, '/release/arm64', '/bun');
    expect(commands[1]).toEqual(['/bun', 'remove', '--global', arm.packageName]);
    expect(commands.slice(1, -1)).toHaveLength(3);
    expect(commands.at(-1)).toEqual(['/bun', 'add', '--global', '--force', '/release/arm64']);
    expect(resolveReleaseTarget('darwin', 'x64').packageName).toEndWith('-x64');

    const windows = resolveReleaseTarget('win32', 'x64');
    expect(windows).toMatchObject({ id: 'windows-x64', binaryName: 'depa-codument.exe' });
    expect(installedBinaryCandidates('C:\\bun-bin', windows)[0]).toEndWith('depa-codument.exe');
  });

  test('rejects unsupported platforms and architectures', () => {
    expect(() => resolveReleaseTarget('linux', 'x64')).toThrow('does not support release target');
    expect(() => resolveReleaseTarget('win32', 'arm64')).toThrow('does not support release target');
    expect(() => resolveReleaseTarget('darwin', 'ia32')).toThrow('does not support release target');
  });
});
