import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBundleDefinitionCatalog } from '../../src/cli/resources/bundle-materializer';
import {
  buildHostPackageArtifact,
  readHostPackageMaterialSet,
} from '../../src/cli/resources/host-package-materializer';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { invokeLocalFunctionDefinition } from '../../src/cli/resources/schema-validator';
import { skillAppKindDefinitionSource, writeSkillApp } from '../fixtures/xnl-skill-app';

const roots = new Set<string>();
const contractPackage = 'depa-codument-skill-app-contract';

afterEach(async () => {
  await Promise.all([...roots].map((root) => fs.rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function fixture(options: { declared?: boolean; lock?: boolean } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-package-host-'));
  roots.add(root);
  const skillRoot = path.join(root, '.agents/skills/code-first');
  const bundleRoot = path.join(skillRoot, 'HostBundle/basic');
  await writeSkillApp(skillRoot, 'code-first');
  await fs.mkdir(path.join(skillRoot, 'KindDefinitions/HostBundle'), { recursive: true });
  await fs.mkdir(path.join(bundleRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(skillRoot, 'KindDefinitions/HostBundle/manifest.xnl'), skillAppKindDefinitionSource('HostBundle'));
  const rootManifest = path.join(skillRoot, 'manifest.xnl');
  await fs.writeFile(rootManifest, (await fs.readFile(rootManifest, 'utf8')).replace(
    '  ]>\n)>',
    '    <DirectoryResourceCatalog #host_bundles { resourceKind = "HostBundle" root = "vfs://./HostBundle/" entry = "manifest.xnl" scope = "children" }>\n  ]>\n)>',
  ));
  await fs.writeFile(path.join(bundleRoot, 'manifest.xnl'), [
    '<HostBundle #Test.CodeFirst.HostBundle.Basic envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {',
    '  profile = "host-package"',
    '  packageRoot = "vfs://."',
    '  descriptor = "vfs://./src/halfcode.module.ts"',
    '  runtime = "bun"',
    '  exports = ["LocalFunction"]',
    '}>', '',
  ].join('\n'));
  await fs.writeFile(path.join(bundleRoot, 'package.json'), JSON.stringify({
    name: '@test/code-first-basic-capsule', private: true, type: 'module',
    scripts: { postinstall: 'touch SHOULD_NOT_EXIST' },
    dependencies: { [contractPackage]: '0.1.1' },
  }, null, 2));
  if (options.lock !== false) await fs.writeFile(path.join(skillRoot, 'bun.lock'), JSON.stringify({
    lockfileVersion: 1,
    workspaces: {
      'HostBundle/basic': {
        name: '@test/code-first-basic-capsule',
        dependencies: { [contractPackage]: '0.1.1' },
      },
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
  await fs.writeFile(path.join(bundleRoot, 'src/helper.ts'), 'export const value = "package-value";\n');
  await fs.writeFile(path.join(bundleRoot, 'src/halfcode.module.ts'), [
    'import { defineHostModule, defineLocalFunction } from "depa-codument-skill-app-contract/host";',
    ...(options.declared === false ? ['import "missing-package";'] : []),
    'import { value } from "./helper";',
    'export default defineHostModule({ resources: [defineLocalFunction({',
    '  fqn: "Test.CodeFirst.LocalFunction.Value", operation: "query",',
    '  inputSchema: { type: "object" }, configSchema: { type: "object" }, outputSchema: { type: "object" },',
    '  handler: () => ({ value }),',
    '})] });',
    '',
  ].join('\n'));
  const contractRoot = path.resolve(import.meta.dir, '../../../skill-app-contract');
  // npm hoists workspace dependencies beside the root lockfile.
  const installedContract = path.join(skillRoot, 'node_modules', ...contractPackage.split('/'));
  await fs.mkdir(path.dirname(installedContract), { recursive: true });
  await fs.symlink(contractRoot, installedContract);
  return { root, skillRoot, bundleRoot };
}

describe('package-authored HostBundle', () => {
  test('includes package, lock, and imported source in identity and loads typed descriptors', async () => {
    const value = await fixture();
    const catalog = createWorkspaceResourceCatalog(value.root, ['.agents/skills']);
    const first = await catalog.snapshot();
    expect(first.ready).toBe(true);
    const firstBundle = first.resources.find((item) => item.fqn === 'Test.CodeFirst.HostBundle.Basic');
    expect(firstBundle?.materialDigest).toBeDefined();

    const definition = await createBundleDefinitionCatalog(first).detail('Test.CodeFirst.LocalFunction.Value');
    await expect(invokeLocalFunctionDefinition(definition as never, {}, {}, {})).resolves.toEqual({ value: 'package-value' });
    expect(await fs.stat(path.join(value.bundleRoot, 'SHOULD_NOT_EXIST')).catch(() => undefined)).toBeUndefined();

    const manifest = JSON.parse(await fs.readFile(path.join(value.bundleRoot, 'package.json'), 'utf8'));
    manifest.version = '1.0.1';
    await fs.writeFile(path.join(value.bundleRoot, 'package.json'), JSON.stringify(manifest, null, 2));
    const second = await catalog.snapshot();
    expect(second.revision).not.toBe(first.revision);

    const lockPath = path.join(value.skillRoot, 'bun.lock');
    const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
    lock.workspaces.unrelated = { dependencies: { leftPad: '1.0.0' } };
    await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
    const third = await catalog.snapshot();
    expect(third.revision).toBe(second.revision);

    await fs.writeFile(path.join(value.bundleRoot, 'README.md'), 'not executable material\n');
    const fourth = await catalog.snapshot();
    expect(fourth.revision).toBe(third.revision);

    await fs.writeFile(path.join(value.bundleRoot, 'src/helper.ts'), 'export const value = "changed";\n');
    const fifth = await catalog.snapshot();
    expect(fifth.revision).not.toBe(fourth.revision);
  });

  test('fails closed for undeclared imports or a missing lock without installing', async () => {
    const undeclared = await fixture({ declared: false });
    const undeclaredSnapshot = await createWorkspaceResourceCatalog(undeclared.root, ['.agents/skills']).snapshot();
    expect(undeclaredSnapshot.ready).toBe(false);
    expect(undeclaredSnapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_IMPORT_UNDECLARED')).toBe(true);

    const unlocked = await fixture({ lock: false });
    const unlockedSnapshot = await createWorkspaceResourceCatalog(unlocked.root, ['.agents/skills']).snapshot();
    expect(unlockedSnapshot.ready).toBe(false);
    expect(unlockedSnapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_LOCK_MISSING')).toBe(true);
  });

  test('rejects Node createRequire before it can bypass the static dependency closure', async () => {
    const value = await fixture();
    const descriptor = path.join(value.bundleRoot, 'src/halfcode.module.ts');
    await fs.writeFile(descriptor, [
      'import { createRequire } from "node:module";',
      'import { defineHostModule, defineLocalFunction } from "depa-codument-skill-app-contract/host";',
      'const dynamicRequire = createRequire(import.meta.url);',
      'export default defineHostModule({ resources: [defineLocalFunction({',
      '  fqn: "Test.CodeFirst.LocalFunction.Dynamic", operation: "query",',
      '  inputSchema: { type: "object" }, configSchema: { type: "object" }, outputSchema: { type: "object" },',
      '  handler: () => dynamicRequire("definitely-undeclared-package"),',
      '})] });',
      '',
    ].join('\n'));
    const snapshot = await createWorkspaceResourceCatalog(value.root, ['.agents/skills']).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_DYNAMIC_RESOLUTION_UNSUPPORTED')).toBe(true);

    const dynamicImport = await fixture();
    await fs.writeFile(path.join(dynamicImport.bundleRoot, 'src/halfcode.module.ts'), [
      'import { defineHostModule, defineLocalFunction } from "depa-codument-skill-app-contract/host";',
      'const packageName = "definitely-undeclared-package";',
      'export default defineHostModule({ resources: [defineLocalFunction({',
      '  fqn: "Test.CodeFirst.LocalFunction.Dynamic", operation: "query",',
      '  inputSchema: { type: "object" }, configSchema: { type: "object" }, outputSchema: { type: "object" },',
      '  handler: async () => import(packageName),',
      '})] });',
      '',
    ].join('\n'));
    const dynamicSnapshot = await createWorkspaceResourceCatalog(dynamicImport.root, ['.agents/skills']).snapshot();
    expect(dynamicSnapshot.ready).toBe(false);
    expect(dynamicSnapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_DYNAMIC_RESOLUTION_UNSUPPORTED')).toBe(true);

    const commentedDynamicImport = await fixture();
    await fs.writeFile(path.join(commentedDynamicImport.bundleRoot, 'src/halfcode.module.ts'), [
      'import { defineHostModule, defineLocalFunction } from "depa-codument-skill-app-contract/host";',
      'export default defineHostModule({ resources: [defineLocalFunction({',
      '  fqn: "Test.CodeFirst.LocalFunction.Dynamic", operation: "query",',
      '  inputSchema: { type: "object" }, configSchema: { type: "object" }, outputSchema: { type: "object" },',
      '  handler: async () => import /* ordinary formatter comment */ ("node:path"),',
      '})] });',
      '',
    ].join('\n'));
    const commentedDynamicSnapshot = await createWorkspaceResourceCatalog(commentedDynamicImport.root, ['.agents/skills']).snapshot();
    expect(commentedDynamicSnapshot.ready).toBe(false);
    expect(commentedDynamicSnapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_DYNAMIC_RESOLUTION_UNSUPPORTED')).toBe(true);

    const aliasedBuiltin = await fixture();
    await fs.writeFile(path.join(aliasedBuiltin.bundleRoot, 'src/halfcode.module.ts'), [
      'import { defineHostModule, defineLocalFunction } from "depa-codument-skill-app-contract/host";',
      'const builtinLoader = process.getBuiltinModule;',
      'const builtinName = "node:path";',
      'export default defineHostModule({ resources: [defineLocalFunction({',
      '  fqn: "Test.CodeFirst.LocalFunction.Dynamic", operation: "query",',
      '  inputSchema: { type: "object" }, configSchema: { type: "object" }, outputSchema: { type: "object" },',
      '  handler: () => builtinLoader(builtinName),',
      '})] });',
      '',
    ].join('\n'));
    const aliasedBuiltinSnapshot = await createWorkspaceResourceCatalog(aliasedBuiltin.root, ['.agents/skills']).snapshot();
    expect(aliasedBuiltinSnapshot.ready).toBe(false);
    expect(aliasedBuiltinSnapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_DYNAMIC_RESOLUTION_UNSUPPORTED')).toBe(true);

    const aliasedRequire = await fixture();
    await fs.writeFile(path.join(aliasedRequire.bundleRoot, 'src/halfcode.module.ts'), [
      'import { defineHostModule, defineLocalFunction } from "depa-codument-skill-app-contract/host";',
      'const loader = require;',
      'const packageName = "definitely-undeclared-package";',
      'export default defineHostModule({ resources: [defineLocalFunction({',
      '  fqn: "Test.CodeFirst.LocalFunction.Dynamic", operation: "query",',
      '  inputSchema: { type: "object" }, configSchema: { type: "object" }, outputSchema: { type: "object" },',
      '  handler: () => loader(packageName),',
      '})] });',
      '',
    ].join('\n'));
    const aliasedRequireSnapshot = await createWorkspaceResourceCatalog(aliasedRequire.root, ['.agents/skills']).snapshot();
    expect(aliasedRequireSnapshot.ready).toBe(false);
    expect(aliasedRequireSnapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_DYNAMIC_RESOLUTION_UNSUPPORTED')).toBe(true);
  });

  test('rejects symlinks during admission and executes only captured bytes after a source swap', async () => {
    const unsafeRead = await fixture();
    const outsideRead = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-host-outside-read-'));
    roots.add(outsideRead);
    await fs.cp(path.join(unsafeRead.bundleRoot, 'src'), outsideRead, { recursive: true });
    await fs.rm(path.join(unsafeRead.bundleRoot, 'src'), { recursive: true, force: true });
    await fs.symlink(outsideRead, path.join(unsafeRead.bundleRoot, 'src'));
    const snapshot = await createWorkspaceResourceCatalog(unsafeRead.root, ['.agents/skills']).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_SOURCE_MISSING')).toBe(true);

    const unsafeBuild = await fixture();
    const resource = (await createWorkspaceResourceCatalog(unsafeBuild.root, ['.agents/skills']).snapshot()).resources
      .find((item) => item.fqn === 'Test.CodeFirst.HostBundle.Basic')!;
    const material = await readHostPackageMaterialSet(resource);
    const outsideBuild = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-host-outside-build-'));
    roots.add(outsideBuild);
    await fs.cp(path.join(unsafeBuild.bundleRoot, 'src'), outsideBuild, { recursive: true });
    await fs.rm(path.join(unsafeBuild.bundleRoot, 'src'), { recursive: true, force: true });
    await fs.symlink(outsideBuild, path.join(unsafeBuild.bundleRoot, 'src'));
    await fs.writeFile(path.join(outsideBuild, 'helper.ts'), 'export const value = "must-not-execute";');
    const artifact = await buildHostPackageArtifact(material);
    try {
      const namespace = await import(pathToFileURL(artifact.value.entryPath).href);
      expect(namespace.default.resources[0].handler()).toEqual({ value: 'package-value' });
      expect(artifact.value.source.sourceDigest).toBe(material.sourceDigest);
    } finally { await artifact.close(); }
    expect(await fs.stat(artifact.value.entryPath).catch(() => undefined)).toBeUndefined();
  });

  test('fails closed when package.json and Bun lock disagree on the contract version', async () => {
    const value = await fixture();
    const lockPath = path.join(value.skillRoot, 'bun.lock');
    const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
    lock.workspaces['HostBundle/basic'].dependencies['depa-codument-skill-app-contract'] = '1.0.0';
    await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
    const snapshot = await createWorkspaceResourceCatalog(value.root, ['.agents/skills']).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics.some((item) => item.code === 'WORKSPACE_HOST_PACKAGE_LOCK_MISMATCH')).toBe(true);
  });

  test('builds a self-contained artifact that loads after source dependencies disappear', async () => {
    const value = await fixture();
    const resource = (await createWorkspaceResourceCatalog(value.root, ['.agents/skills']).snapshot()).resources
      .find((item) => item.fqn === 'Test.CodeFirst.HostBundle.Basic');
    expect(resource).toBeDefined();
    const material = await readHostPackageMaterialSet(resource!);
    const artifact = await buildHostPackageArtifact(material);
    const receipt = artifact.value;
    try {
    expect(receipt).toMatchObject({
      protocolVersion: '1',
      packageName: '@test/code-first-basic-capsule',
      generationId: material.digest,
      entry: expect.stringMatching(/\.js$/),
      source: {
        descriptor: 'src/halfcode.module.ts',
        sourceDigest: material.sourceDigest,
        lockDigest: material.lockDigest,
      },
      toolchain: { contractVersion: '0.1.1', builderVersion: expect.stringContaining('bun-') },
    });
    expect(receipt.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: receipt.entry, digest: expect.stringMatching(/^sha256:/), kind: 'js' }),
    ]));
    expect(receipt.assetsDigest).toMatch(/^sha256:/);
    await fs.rm(path.join(value.skillRoot, 'node_modules'), { recursive: true, force: true });
    const namespace = await import(pathToFileURL(receipt.entryPath).href);
    expect(namespace.default.resources[0]).toMatchObject({ kind: 'LocalFunction', fqn: 'Test.CodeFirst.LocalFunction.Value' });
    } finally { await artifact.close(); }
    expect(await fs.stat(receipt.entryPath).catch(() => undefined)).toBeUndefined();
  });

  test('builds when Bun keeps dependencies only in the nested package node_modules', async () => {
    const value = await fixture();
    const rootContract = path.join(value.skillRoot, 'node_modules', ...contractPackage.split('/'));
    const localContract = path.join(value.bundleRoot, 'node_modules', ...contractPackage.split('/'));
    await fs.mkdir(path.dirname(localContract), { recursive: true });
    await fs.rename(rootContract, localContract);
    await fs.rm(path.join(value.skillRoot, 'node_modules'), { recursive: true, force: true });
    const resource = (await createWorkspaceResourceCatalog(value.root, ['.agents/skills']).snapshot()).resources
      .find((item) => item.fqn === 'Test.CodeFirst.HostBundle.Basic');
    expect(resource).toBeDefined();
    const artifact = await buildHostPackageArtifact(await readHostPackageMaterialSet(resource!));
    try { expect(artifact.value.packageName).toBe('@test/code-first-basic-capsule'); }
    finally { await artifact.close(); }
  });
});
