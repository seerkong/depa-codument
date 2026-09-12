import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadCompositionPackageDescriptor,
  readCompositionPackageMaterialSet,
} from '../../src/cli/resources/app-package-materializer';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { skillAppKindDefinitionSource } from '../fixtures/xnl-skill-app';

const roots = new Set<string>();
const envelopeVersion = 'halfcode.resource-envelope/v1';
const contractPackage = 'depa-codument-skill-app-contract';

afterEach(async () => {
  await Promise.all([...roots].map((root) => fs.rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function writeKind(root: string, kind: 'SkillApp' | 'SkillModule' | 'HostBundle'): Promise<void> {
  const directory = path.join(root, 'KindDefinitions', kind);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'manifest.xnl'), skillAppKindDefinitionSource(kind));
}

async function fixture(): Promise<{ workspace: string; app: string; appDescriptor: string; moduleDescriptor: string }> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-app-package-'));
  roots.add(workspace);
  const app = path.join(workspace, '.agents', 'skills', 'package-authority');
  const moduleRoot = path.join(app, 'modules', 'basic');
  const moduleDescriptor = path.join(moduleRoot, 'src', 'halfcode.module.ts');
  await Promise.all([
    writeKind(app, 'SkillApp'),
    writeKind(app, 'SkillModule'),
    writeKind(app, 'HostBundle'),
    fs.mkdir(path.dirname(moduleDescriptor), { recursive: true }),
    fs.mkdir(path.join(app, 'src'), { recursive: true }),
  ]);
  await fs.writeFile(path.join(app, 'manifest.xnl'), [
    `<SkillApp #Test.PackageAuthority.App envelopeVersion="${envelopeVersion}" specVersion=1 {`,
    '  profile = "app-package"',
    '  packageRoot = "vfs://."',
    '  descriptor = "vfs://./src/app.ts"',
    '} (',
    '  <Catalogs [',
    '    <DirectoryResourceCatalog #kind_definitions { resourceKind = "KindDefinition" root = "vfs://./KindDefinitions/" entry = "manifest.xnl" scope = "children" }>',
    '    <ManifestResourceCatalog #modules { resourceKind = "SkillModule" root = "vfs://./modules/" entry = "manifest.xnl" }>',
    '  ]>',
    ')>',
    '',
  ].join('\n'));
  const appDescriptor = path.join(app, 'src', 'app.ts');
  await fs.writeFile(appDescriptor, [
    'import { defineSkillApp } from "depa-codument-skill-app-contract/app";',
    'export default defineSkillApp({',
    '  fqn: "Test.PackageAuthority.App", name: "package-authority",',
    '  modules: ["Test.PackageAuthority.Module.Basic"], pageBundles: [], sites: [], resources: [],',
    '});',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(moduleRoot, 'manifest.xnl'), [
    `<SkillModule #Test.PackageAuthority.Module.Basic envelopeVersion="${envelopeVersion}" specVersion=1 {`,
    '  profile = "module-package"',
    '  packageRoot = "vfs://."',
    '  descriptor = "vfs://./src/halfcode.module.ts"',
    '} (',
    '  <Catalogs [',
    '    <DirectoryResourceCatalog #host { resourceKind = "HostBundle" root = "vfs://./" entry = "host.xnl" scope = "root" }>',
    '  ]>',
    ')>',
    '',
  ].join('\n'));
  await fs.writeFile(moduleDescriptor, [
    'import { defineSkillModule } from "depa-codument-skill-app-contract/app";',
    'export default defineSkillModule({',
    '  fqn: "Test.PackageAuthority.Module.Basic", host: "Test.PackageAuthority.Module.Basic.Host", resources: [],',
    '});',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(moduleRoot, 'host.xnl'), [
    `<HostBundle #Test.PackageAuthority.Module.Basic.Host envelopeVersion="${envelopeVersion}" specVersion=1 {`,
    '  profile = "host-package"',
    '  packageRoot = "vfs://."',
    '  descriptor = "vfs://./src/host.ts"',
    '  runtime = "bun"',
    '  exports = ["LocalFunction"]',
    '}>',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(moduleRoot, 'src', 'host.ts'), [
    'import { defineHostModule, defineLocalFunction } from "depa-codument-skill-app-contract/host";',
    'const value = defineLocalFunction({ fqn: "Test.PackageAuthority.Action.Value", operation: "query", inputSchema: {}, configSchema: {}, outputSchema: {}, handler: () => ({ value: 1 }) });',
    'export const resourceDefinitions = [value];',
    'export default defineHostModule({ resources: resourceDefinitions });',
    '',
  ].join('\n'));
  const dependency = { [contractPackage]: '0.1.1' };
  await fs.writeFile(path.join(app, 'package.json'), JSON.stringify({
    name: '@test/package-authority', version: '1.0.0', private: true, type: 'module', workspaces: ['modules/basic'], dependencies: dependency,
  }, null, 2));
  await fs.writeFile(path.join(moduleRoot, 'package.json'), JSON.stringify({
    name: '@test/package-authority-basic', version: '1.0.0', private: true, type: 'module', dependencies: dependency,
  }, null, 2));
  await fs.writeFile(path.join(app, 'bun.lock'), JSON.stringify({
    lockfileVersion: 1,
    workspaces: {
      '': { name: '@test/package-authority', dependencies: dependency },
      'modules/basic': { name: '@test/package-authority-basic', dependencies: dependency },
    },
    packages: {
      [contractPackage]: [
        `${contractPackage}@0.1.1`,
        'https://registry.example.test/skill-app-contract-0.1.1.tgz',
        { dependencies: { 'halfcode-compiler.xnl': '0.3.0' } },
        'sha512-contract-fixture',
      ],
      'halfcode-compiler.xnl': [
        'halfcode-compiler.xnl@0.3.0',
        'https://registry.example.test/halfcode-compiler.xnl-0.3.0.tgz',
        {},
        'sha512-compiler-fixture',
      ],
    },
  }, null, 2));
  const contractRoot = path.resolve(import.meta.dir, '../../../skill-app-contract');
  const installedContract = path.join(app, 'node_modules', ...contractPackage.split('/'));
  await fs.mkdir(path.dirname(installedContract), { recursive: true });
  await fs.symlink(contractRoot, installedContract);
  return { workspace, app, appDescriptor, moduleDescriptor };
}

describe('package-authored SkillApp and SkillModule authority', () => {
  test('admits the same canonical membership from an app root and an installed workspace', async () => {
    const value = await fixture();
    const direct = await createWorkspaceResourceCatalog(value.app, [{ root: '.', scope: 'root', origin: 'direct' }]).snapshot();
    const installed = await createWorkspaceResourceCatalog(value.workspace, [{ root: '.agents/skills', scope: 'children', origin: 'installed' }]).snapshot();
    expect(direct.ready).toBe(true);
    expect(installed.ready).toBe(true);
    expect(installed.resources.map((item) => `${item.kind}:${item.fqn}`)).toEqual(direct.resources.map((item) => `${item.kind}:${item.fqn}`));
    expect(direct.resources.find((item) => item.kind === 'SkillApp')?.materialDigest).toBeDefined();
    expect(direct.resources.find((item) => item.kind === 'SkillModule')?.materialDigest).toBeDefined();
  });

  test('fails closed when typed module membership differs from discovered canonical resources', async () => {
    const value = await fixture();
    await fs.writeFile(value.moduleDescriptor, [
      'import { defineSkillModule } from "depa-codument-skill-app-contract/app";',
      'export default defineSkillModule({ fqn: "Test.PackageAuthority.Module.Basic", host: "Test.PackageAuthority.Module.Unknown", resources: ["Test.PackageAuthority.Page.Ghost"] });',
      '',
    ].join('\n'));
    const snapshot = await createWorkspaceResourceCatalog(value.app, [{ root: '.', scope: 'root', origin: 'direct' }]).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.filter((item) => item.code === 'WORKSPACE_MODULE_PACKAGE_MEMBERSHIP_MISMATCH')).toHaveLength(2);
  });

  test('fails closed when typed app composition differs from discovered canonical resources', async () => {
    const value = await fixture();
    await fs.writeFile(value.appDescriptor, [
      'import { defineSkillApp } from "depa-codument-skill-app-contract/app";',
      'export default defineSkillApp({ fqn: "Test.PackageAuthority.App", name: "package-authority", modules: [], pageBundles: ["Test.PackageAuthority.PageBundle.Ghost"], sites: [], resources: [] });',
      '',
    ].join('\n'));
    const snapshot = await createWorkspaceResourceCatalog(value.app, [{ root: '.', scope: 'root', origin: 'direct' }]).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.filter((item) => item.code === 'WORKSPACE_APP_PACKAGE_MEMBERSHIP_MISMATCH')).toHaveLength(2);
  });

  test('rejects a descriptor with ghost fields before it can become runtime authority', async () => {
    const value = await fixture();
    await fs.writeFile(value.moduleDescriptor, [
      'export default { protocolVersion: "2", fqn: "Test.PackageAuthority.Module.Basic", host: "Test.PackageAuthority.Module.Basic.Host", resources: [], authority: "ghost" };',
      '',
    ].join('\n'));
    const snapshot = await createWorkspaceResourceCatalog(value.app, [{ root: '.', scope: 'root', origin: 'direct' }]).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.some((item) => item.code === 'WORKSPACE_MODULE_PACKAGE_DESCRIPTOR_INVALID')).toBe(true);
  });

  test('rejects an intermediate descriptor-directory symlink', async () => {
    const value = await fixture();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-app-descriptor-outside-'));
    roots.add(outside);
    await fs.cp(path.join(value.app, 'src'), outside, { recursive: true });
    await fs.rm(path.join(value.app, 'src'), { recursive: true, force: true });
    await fs.symlink(outside, path.join(value.app, 'src'));
    const snapshot = await createWorkspaceResourceCatalog(value.app, [{ root: '.', scope: 'root', origin: 'direct' }]).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.some((item) => item.code === 'WORKSPACE_APP_PACKAGE_SOURCE_MISSING')).toBe(true);
  });

  test('rejects a same-byte symlink swap between composition materialization and build', async () => {
    const value = await fixture();
    const snapshot = await createWorkspaceResourceCatalog(value.app, [{ root: '.', scope: 'root', origin: 'direct' }]).snapshot();
    const resource = snapshot.resources.find((item) => item.kind === 'SkillApp')!;
    const material = await readCompositionPackageMaterialSet(resource, 'SkillApp');
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-app-build-swap-'));
    roots.add(outside);
    await fs.cp(path.join(value.app, 'src'), outside, { recursive: true });
    await fs.rm(path.join(value.app, 'src'), { recursive: true, force: true });
    await fs.symlink(outside, path.join(value.app, 'src'));
    await expect(loadCompositionPackageDescriptor({ ...material, digest: `${material.digest}-symlink-swap` }))
      .rejects.toMatchObject({ code: 'WORKSPACE_APP_PACKAGE_SOURCE_UNSAFE' });
  });
});
