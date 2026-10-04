#!/usr/bin/env bun
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { BIN } from '../packages/cli/src/identity';
import assert from 'node:assert/strict';
import {
  renderSkillAppKindDefinition,
  skillAppKindContract,
  type SkillAppResourceKind,
} from '../packages/skill-app-contract/src/resource';
import { RELEASE_TARGETS, resolveReleaseTarget, type ReleaseTarget } from './release-targets';

interface PackageManifest {
  name: string;
  version: string;
  os: string[];
  cpu: string[];
  bin: Record<string, string>;
  dependencies?: Record<string, string>;
}

const repoRoot = resolve(import.meta.dir, '..');
const templatesRoot = resolve(repoRoot, 'packages', 'cli', 'src', 'templates');
const rootManifest = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as PackageManifest;
const contractManifest = JSON.parse(readFileSync(
  resolve(repoRoot, 'packages', 'skill-app-contract', 'package.json'),
  'utf8',
)) as { name: string; version: string };
const expectedBuilderDependencies = {
  'halfcode-cli-lite-page-builder-vue-support': JSON.parse(readFileSync(
    resolve(repoRoot, 'packages/page-builder-vue/package.json'), 'utf8',
  )).dependencies['halfcode-cli-lite-page-builder-vue-support'],
  [contractManifest.name]: contractManifest.version,
  '@module-federation/runtime': '2.8.1',
  '@module-federation/vite': '1.20.1',
  '@vitejs/plugin-vue': '5.2.4',
  vite: '5.4.21',
  vue: '3.5.41',
};
const resourceEnvelopeVersion = 'halfcode.resource-envelope/v1';

function kindDefinitionSource(kind: SkillAppResourceKind): string {
  return renderSkillAppKindDefinition(skillAppKindContract(kind));
}

function installedPackageCandidates(installRoot: string, packageName: string): string[] {
  const segments = packageName.split('/');
  return [
    resolve(installRoot, 'lib', 'node_modules', ...segments),
    resolve(installRoot, 'node_modules', ...segments),
  ];
}

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(absolute) : [absolute];
  }).sort();
}

function embeddedResourcePaths(binary: Buffer): Set<string> {
  const markers = [
    { bytes: Buffer.from('/$bunfs/root/resource/'), prefix: '/$bunfs/root/resource/' },
    { bytes: Buffer.from('B:/~BUN/root/resource/'), prefix: '/$bunfs/root/resource/' },
  ];
  const paths = new Set<string>();
  for (const marker of markers) {
    let offset = 0;
    while (offset < binary.length) {
      const start = binary.indexOf(marker.bytes, offset);
      if (start < 0) break;
      let end = start;
      while (end < binary.length && binary[end] >= 0x20 && binary[end] <= 0x7e) end++;
      const nativePath = binary.subarray(start, end).toString('utf8');
      const embeddedPath = nativePath.slice(marker.bytes.length);
      paths.add(`${marker.prefix}${embeddedPath.endsWith('.') ? embeddedPath.slice(0, -1) : embeddedPath}`);
      offset = end + 1;
    }
  }
  return paths;
}

async function npmPackFiles(packageRoot: string): Promise<Set<string>> {
  const child = Bun.spawn(['npm', 'pack', '--dry-run', '--json', packageRoot], {
    cwd: repoRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`npm pack failed for ${packageRoot}: ${stderr || stdout}`);
  const result = JSON.parse(stdout) as Array<{ files?: Array<{ path: string }> }>;
  return new Set(result[0]?.files?.map(({ path }) => path) ?? []);
}

async function checkVersion(binaryPath: string, version: string): Promise<void> {
  const child = Bun.spawn([binaryPath, '--version'], { stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0 || !stdout.includes(`${BIN} v${version}`)) {
    throw new Error(`${binaryPath} --version failed: ${stderr || stdout}`);
  }
}

async function run(
  command: string[],
  options: { env?: Record<string, string | undefined>; cwd?: string; capture?: boolean } = {},
): Promise<string> {
  const child = Bun.spawn(command, {
    cwd: options.cwd ?? repoRoot,
    stdout: options.capture ? 'pipe' : 'inherit',
    stderr: options.capture ? 'pipe' : 'inherit',
    ...(options.env ? { env: options.env } : {}),
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    options.capture ? new Response(child.stdout).text() : '',
    options.capture ? new Response(child.stderr).text() : '',
  ]);
  if (exitCode !== 0) throw new Error(`Command failed (${exitCode}): ${command.join(' ')}\n${stderr || stdout}`);
  return stdout;
}

async function expectFailure(command: string[], options: { env?: Record<string, string | undefined>; cwd?: string } = {}): Promise<string> {
  const child = Bun.spawn(command, {
    cwd: options.cwd ?? repoRoot,
    stdout: 'pipe',
    stderr: 'pipe',
    ...(options.env ? { env: options.env } : {}),
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode === 0) throw new Error(`Command unexpectedly succeeded: ${command.join(' ')}\n${stdout}`);
  return stderr || stdout;
}

function checkNativeFormat(binary: Buffer, target: ReleaseTarget, binaryPath: string): void {
  if (target.nativeFormat === 'mach-o') {
    const cpuType = target.architecture === 'arm64' ? 0x0100000c : 0x01000007;
    if (binary.readUInt32LE(0) !== 0xfeedfacf || binary.readUInt32LE(4) !== cpuType) {
      throw new Error(`${binaryPath} is not a ${target.architecture} Mach-O executable`);
    }
    return;
  }

  if (binary.readUInt16LE(0) !== 0x5a4d) throw new Error(`${binaryPath} is missing the PE MZ header`);
  const peOffset = binary.readUInt32LE(0x3c);
  if (binary.readUInt32LE(peOffset) !== 0x00004550 || binary.readUInt16LE(peOffset + 4) !== 0x8664) {
    throw new Error(`${binaryPath} is not a PE32+ AMD64 executable`);
  }
}

const expectedResources = new Set(
  [...collectFiles(templatesRoot), ...collectFiles(resolve(repoRoot, 'packages/product-capsule/src/templates'))]
    .map((file) => `/$bunfs/root/resource/${relative(repoRoot, file).split('\\').join('/')}`),
);

for (const target of RELEASE_TARGETS) {
  const packageRoot = resolve(repoRoot, 'packages', target.packageDirectory);
  const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as PackageManifest;
  if (manifest.name !== target.packageName) throw new Error(`Unexpected package name: ${manifest.name}`);
  if (manifest.version !== rootManifest.version) throw new Error(`${manifest.name} version must equal ${rootManifest.version}`);
  if (manifest.os.length !== 1 || manifest.os[0] !== target.platform) {
    throw new Error(`${manifest.name} must target ${target.platform} only`);
  }
  if (manifest.cpu.length !== 1 || manifest.cpu[0] !== target.architecture) {
    throw new Error(`${manifest.name} must target ${target.architecture} only`);
  }
  const expectedBin = `bin/${target.binaryName}`;
  if (manifest.bin[BIN] !== expectedBin) throw new Error(`${manifest.name} must expose ${expectedBin}`);
  assert.deepEqual(manifest.dependencies, expectedBuilderDependencies, `${manifest.name} must declare the exact Vue Page builder dependencies`);

  const binaryPath = resolve(packageRoot, expectedBin);
  if (target.platform === 'darwin' && (statSync(binaryPath).mode & 0o111) === 0) {
    throw new Error(`${binaryPath} is not executable`);
  }
  const binary = readFileSync(binaryPath);
  if (binary.includes(Buffer.from(repoRoot))) throw new Error(`${binaryPath} embeds the build-machine repository path`);
  checkNativeFormat(binary, target, binaryPath);
  const resources = embeddedResourcePaths(binary);
  const missing = [...expectedResources].filter((resource) => !resources.has(resource));
  if (missing.length > 0 || resources.size !== expectedResources.size) {
    throw new Error(`${manifest.name} BunFS mismatch: ${missing.length} missing, ${resources.size}/${expectedResources.size} embedded`);
  }
  if (target.platform === process.platform) await checkVersion(binaryPath, manifest.version);

  const packed = await npmPackFiles(packageRoot);
  const builderSource = resolve(repoRoot, 'packages', 'page-builder-vue');
  const builderFiles = new Set(['package.json', 'README.md', ...collectFiles(resolve(builderSource, 'src')).map(file => relative(builderSource, file).split(sep).join('/'))]);
  const nestedManifest = JSON.parse(readFileSync(resolve(packageRoot, 'builder-vue/package.json'), 'utf8'));
  assert.equal(nestedManifest.dependencies['halfcode-cli-lite-page-builder-vue-support'], expectedBuilderDependencies['halfcode-cli-lite-page-builder-vue-support']);
  assert.ok(!JSON.stringify(nestedManifest).includes('workspace:'));
  for (const required of [
    'package.json', 'README.md', expectedBin,
    ...[...builderFiles].map(file => 'builder-vue/' + file),
  ]) {
    if (!packed.has(required)) throw new Error(`${manifest.name} npm pack omitted ${required}`);
  }
  if ([...packed].some((file) => file.startsWith('src/') || file.startsWith('scripts/')
    || (file.startsWith('builder-vue/') && !builderFiles.has(file.slice('builder-vue/'.length))))) {
    throw new Error(`${manifest.name} npm pack contains source/runtime files outside the standalone binary`);
  }
  console.log(`Checked ${manifest.name}@${manifest.version}: ${resources.size} BunFS resources, npm pack closed.`);
}

async function smokeInstalledBuilder(): Promise<void> {
  const target = resolveReleaseTarget();
  const packageRoot = resolve(repoRoot, 'packages', target.packageDirectory);
  const installRoot = mkdtempSync(join(tmpdir(), 'ai-cli-release-builder-smoke-'));
  try {
    const env = { ...process.env };
    const configuredCompilerPackage = env.HALFCODE_COMPILER_PACKAGE?.trim();
    let compilerPackage = configuredCompilerPackage
      ? resolve(repoRoot, configuredCompilerPackage)
      : '';
    if (compilerPackage && !existsSync(compilerPackage)) {
      throw new Error(`HALFCODE_COMPILER_PACKAGE does not exist: ${compilerPackage}`);
    }
    if (!compilerPackage) {
      const compilerRoot = resolve(repoRoot, 'node_modules', 'halfcode-compiler.xnl');
      if (!existsSync(compilerRoot)) {
        throw new Error('halfcode-compiler.xnl is not installed; set HALFCODE_COMPILER_PACKAGE to the exact 0.3.0 release-candidate tarball');
      }
      const compilerPackedName = (await run([
        'npm', 'pack', '--pack-destination', installRoot, compilerRoot,
      ], { env, capture: true })).trim().split(/\r?\n/).at(-1);
      if (!compilerPackedName) throw new Error('npm pack did not return a compiler package tarball');
      compilerPackage = resolve(installRoot, compilerPackedName);
    }
    const packedName = (await run([
      'npm', 'pack', '--pack-destination', installRoot, packageRoot,
    ], { env, capture: true })).trim().split(/\r?\n/).at(-1);
    if (!packedName) throw new Error('npm pack did not return a runtime package tarball');
    const contractRoot = resolve(repoRoot, 'packages', 'skill-app-contract');
    const contractPackedName = (await run([
      'npm', 'pack', '--pack-destination', installRoot, contractRoot,
    ], { env, capture: true })).trim().split(/\r?\n/).at(-1);
    if (!contractPackedName) throw new Error('npm pack did not return the Skill App contract tarball');
    await run([
      'npm', 'install', '--global', '--prefix', installRoot, '--force', '--ignore-scripts',
      compilerPackage, resolve(installRoot, contractPackedName), resolve(installRoot, packedName),
    ], { env });
    const binary = resolve(installRoot, 'bin', target.binaryName);
    if (!existsSync(binary)) throw new Error(`Isolated global install omitted ${target.binaryName}`);
    await checkVersion(binary, rootManifest.version);
    const packageInstallCandidates = [
      resolve(installRoot, 'lib', 'node_modules', target.packageName),
      resolve(installRoot, 'node_modules', target.packageName),
    ];
    const packageInstall = packageInstallCandidates.find(existsSync);
    if (!packageInstall) throw new Error('Isolated global install omitted the runtime package');
    const contractInstallCandidates = installedPackageCandidates(installRoot, contractManifest.name);
    if (!contractInstallCandidates.some(existsSync)) {
      throw new Error(`Isolated global install omitted ${contractManifest.name}`);
    }
    const builderEntry = resolve(packageInstall, 'builder-vue', 'src', 'index.ts');
    if (!existsSync(builderEntry)) throw new Error('Isolated global install omitted the Vue Page builder entry');
    const workspaceRoot = resolve(installRoot, 'workspace');
    const skillRoot = resolve(workspaceRoot, '.agents', 'skills', 'release-smoke');
    const pageRoot = resolve(skillRoot, 'Page', 'release-smoke');
    const localFunctionRoot = resolve(skillRoot, 'LocalFunction');
    const sopRoot = resolve(skillRoot, 'SOP');
    const outputDirectory = resolve(installRoot, 'output');
    mkdirSync(resolve(skillRoot, 'KindDefinitions', 'SkillApp'), { recursive: true });
    mkdirSync(resolve(skillRoot, 'KindDefinitions', 'Page'), { recursive: true });
    mkdirSync(resolve(skillRoot, 'KindDefinitions', 'LocalFunctionBundle'), { recursive: true });
    mkdirSync(resolve(skillRoot, 'KindDefinitions', 'SOP'), { recursive: true });
    mkdirSync(resolve(pageRoot, 'src'), { recursive: true });
    mkdirSync(resolve(localFunctionRoot, 'bundle'), { recursive: true });
    mkdirSync(sopRoot, { recursive: true });
    writeFileSync(resolve(skillRoot, 'manifest.xnl'), [
      `<SkillApp #ReleaseSmoke.App envelopeVersion="${resourceEnvelopeVersion}" specVersion=1 (`,
      '  <Catalogs [',
      '    <DirectoryResourceCatalog #kind_definitions { resourceKind = "KindDefinition" root = "vfs://./KindDefinitions/" entry = "manifest.xnl" scope = "children" }>',
      '    <ManifestResourceCatalog #pages { resourceKind = "Page" root = "vfs://./Page/" entry = "manifest.xnl" }>',
      '    <FileResourceCatalog #sops { resourceKind = "SOP" root = "vfs://./SOP/" }>',
      '    <DirectoryResourceCatalog #local_functions { resourceKind = "LocalFunctionBundle" root = "vfs://./LocalFunction/" entry = "manifest.xnl" scope = "root" }>',
      '  ]>',
      ')>',
      '',
    ].join('\n'));
    for (const kind of ['SkillApp', 'Page', 'LocalFunctionBundle', 'SOP'] as const) {
      writeFileSync(resolve(skillRoot, 'KindDefinitions', kind, 'manifest.xnl'), kindDefinitionSource(kind));
    }
    writeFileSync(resolve(pageRoot, 'src', 'App.vue'), '<template><h1>release smoke</h1></template>');
    writeFileSync(resolve(pageRoot, 'manifest.xnl'), [
      `<Page #ReleaseSmoke.Page envelopeVersion="${resourceEnvelopeVersion}" specVersion=1 {`,
      '  name = "release-smoke"',
      '  description = "Release builder smoke"',
      '  localFunctions = []',
      '}>',
      '',
    ].join('\n'));
    writeFileSync(resolve(localFunctionRoot, 'manifest.xnl'), [
      `<LocalFunctionBundle #ReleaseSmoke.LocalFunctions envelopeVersion="${resourceEnvelopeVersion}" specVersion=1 {`,
      '  entry = "vfs://./bundle/index.js"',
      '  runtime = "bun"',
      '}>',
      '',
    ].join('\n'));
    writeFileSync(resolve(localFunctionRoot, 'bundle', 'index.js'), [
      'const api = globalThis.Codument;',
      "if (!api) throw new Error('Host resource definition API is unavailable');",
      'export const resourceDefinitions = [api.defineLocalFunction({',
      "  fqn: 'ReleaseSmoke.Action.Ping',",
      "  description: 'Release smoke function', operation: 'action',",
      "  inputSchema: { type: 'null' }, outputSchema: { type: 'object' }, configSchema: { type: 'null' },",
      "  runtimeCapabilities: [], handler: () => ({ ok: true }),",
      '})];',
      '',
    ].join('\n'));
    writeFileSync(resolve(sopRoot, 'release-smoke--sop--check.md'), [
      '---',
      `envelopeVersion: ${resourceEnvelopeVersion}`,
      'specVersion: 1',
      'kind: SOP',
      'metadata:',
      '  fqn: ReleaseSmoke.SOP.Check',
      'spec:',
      '  profile: typed-leaf',
      '  description: Release SOP smoke',
      '---',
      '',
      '<input_contract>', 'Canonical smoke input.', '</input_contract>', '',
      '<preconditions>', 'The installed runtime is ready.', '</preconditions>', '',
      '<procedure>', 'Validate the installed SOP projection.', '</procedure>', '',
      '<effects>', 'No external effects.', '</effects>', '',
      '<output_contract>', 'A validation receipt.', '</output_contract>', '',
      '<success_criteria>', 'The receipt is valid.', '</success_criteria>', '',
    ].join('\n'));

    const resourceTree = JSON.parse(await run([
      binary, 'Resource', 'tree', '--json',
    ], { env, cwd: workspaceRoot, capture: true })) as {
      ok?: boolean;
      command?: string;
      readerProfileId?: string;
      contractLock?: { lockDigest?: string };
      packages?: Array<{ resources?: Array<{
        fqn?: string;
        sourceContentDigest?: string;
        effectiveContentDigest?: string;
        resolution?: {
          readerProfileId?: string;
          source?: { envelopeVersion?: string; specVersion?: number; contractFingerprint?: string };
          reader?: { readerId?: string; readerSpecVersion?: number; contractFingerprint?: string; implementationFingerprint?: string };
          sourceContentDigest?: string;
          effectiveContentDigest?: string;
        };
      }> }>;
    };
    const treeResources = resourceTree.packages?.flatMap((item) => item.resources ?? []) ?? [];
    const treeFqns = treeResources.map((resource) => resource.fqn);
    if (!resourceTree.ok || resourceTree.command !== 'Resource.tree'
      || !treeFqns.includes('ReleaseSmoke.Page')
      || !treeFqns.includes('ReleaseSmoke.SOP.Check')
      || treeFqns.includes('ReleaseSmoke.App') || treeFqns.includes('ReleaseSmoke.LocalFunctions')) {
      throw new Error(`Installed CLI Resource.tree did not expose the XNL resources: ${JSON.stringify(resourceTree)}`);
    }
    if (!resourceTree.readerProfileId
      || !resourceTree.contractLock?.lockDigest?.startsWith('sha256:')) {
      throw new Error(`Installed CLI Resource.tree omitted its exact ReaderProfile or contract lock: ${JSON.stringify(resourceTree)}`);
    }
    for (const fqn of ['ReleaseSmoke.Page', 'ReleaseSmoke.SOP.Check']) {
      const resource = treeResources.find((candidate) => candidate.fqn === fqn);
      const resolution = resource?.resolution;
      if (resolution?.readerProfileId !== resourceTree.readerProfileId
        || resolution.source?.envelopeVersion !== resourceEnvelopeVersion
        || resolution.source?.specVersion !== 1
        || !resolution.source.contractFingerprint?.startsWith('sha256:')
        || resolution.reader?.readerSpecVersion !== 1
        || !resolution.reader.readerId
        || !resolution.reader.contractFingerprint?.startsWith('sha256:')
        || !resolution.reader.implementationFingerprint?.startsWith('sha256:')
        || resolution.sourceContentDigest !== resource?.sourceContentDigest
        || resolution.effectiveContentDigest !== resource?.effectiveContentDigest) {
        throw new Error(`Installed CLI Resource.tree omitted the resolution receipt for ${fqn}: ${JSON.stringify(resource)}`);
      }
    }
    const pages = JSON.parse(await run([
      binary, 'Page', 'list', '--json',
    ], { env, cwd: workspaceRoot, capture: true })) as { ok?: boolean; command?: string; pages?: Array<{ name?: string }> };
    if (!pages.ok || pages.command !== 'Page.list' || pages.pages?.[0]?.name !== 'release-smoke') {
      throw new Error(`Installed CLI Page.list did not expose ReleaseSmoke.Page: ${JSON.stringify(pages)}`);
    }
    const localFunctions = JSON.parse(await run([
      binary, 'LocalFunction', 'list', '--json',
    ], { env, cwd: workspaceRoot, capture: true })) as { ok?: boolean; command?: string; functions?: Array<{ fqn?: string }> };
    if (!localFunctions.ok || localFunctions.command !== 'LocalFunction.list'
      || !JSON.stringify(localFunctions).includes('ReleaseSmoke.Action.Ping')) {
      throw new Error(`Installed CLI LocalFunction.list did not expose ReleaseSmoke.Action.Ping: ${JSON.stringify(localFunctions)}`);
    }
    const sop = JSON.parse(await run([
      binary, 'SOP', 'validate', '--fqn', 'ReleaseSmoke.SOP.Check', '--json',
    ], { env, cwd: workspaceRoot, capture: true })) as { ok?: boolean; command?: string; valid?: boolean };
    if (!sop.ok || sop.command !== 'SOP.validate' || sop.valid !== true) {
      throw new Error(`Installed CLI SOP.validate did not validate ReleaseSmoke.SOP.Check: ${JSON.stringify(sop)}`);
    }
    const structuralOutput = await expectFailure([binary, 'LocalFunctionBundle', 'list', '--json'], { env, cwd: workspaceRoot });
    if (!(JSON.parse(structuralOutput) as { message?: string }).message?.includes('Unknown command: LocalFunctionBundle')) {
      throw new Error(`Installed CLI exposed a structural Bundle command: ${structuralOutput}`);
    }
    const removedSopCommand = ['Application', 'SOP'].join('');
    for (const legacyCommand of [removedSopCommand, 'page', 'page-automation', 'page-workflow', 'local-function']) {
      const output = await expectFailure([binary, legacyCommand, 'list', '--json'], { env, cwd: workspaceRoot });
      const payload = JSON.parse(output) as { ok?: boolean; message?: string };
      if (payload.ok !== false || !payload.message?.includes(`Unknown command: ${legacyCommand}`)) {
        throw new Error(`Installed CLI did not reject legacy command '${legacyCommand}': ${output}`);
      }
    }
    const builder = await import(pathToFileURL(builderEntry).href) as {
      buildVuePage(request: {
        pageName: string; pageRoot: string; entry: string; expose: string; outputDirectory: string;
      }): Promise<{ outputFiles: readonly string[] }>;
    };
    const receipt = await builder.buildVuePage({
      pageName: 'release-smoke', pageRoot, entry: 'src/App.vue', expose: './app', outputDirectory,
    });
    for (const required of ['remoteEntry.js', 'mf-manifest.json', 'vendor/vue.js']) {
      if (!receipt.outputFiles.includes(required)) throw new Error(`Installed builder smoke omitted ${required}`);
    }
    const started = JSON.parse(await run([
      binary, 'serve', 'start', '--port', '0', '--json',
    ], { env, cwd: workspaceRoot, capture: true })) as { ok?: boolean; url?: string };
    if (!started.ok || !started.url) throw new Error('Installed CLI Serve did not start for the builder smoke');
    try {
      const opened = await fetch(new URL('/api/pages/release-smoke/open', started.url), { method: 'POST' });
      if (!opened.ok) throw new Error(`Installed CLI rejected Vue Page open: HTTP ${opened.status} ${await opened.text()}`);
      let generation = '';
      for (let attempt = 0; attempt < 100 && !generation; attempt += 1) {
        const response = await fetch(new URL('/api/pages', started.url));
        const payload = await response.json() as { pages?: Array<{ name?: string; runtime?: { generation?: string | null } }> };
        generation = payload.pages?.find((page) => page.name === 'release-smoke')?.runtime?.generation ?? '';
        if (!generation) await Bun.sleep(20);
      }
      if (!generation) throw new Error('Installed CLI did not publish a Vue Page generation');
    } finally {
      await run([binary, 'serve', 'stop', '--json'], { env, cwd: workspaceRoot, capture: true });
    }
    console.log(`Smoked isolated global install for ${target.packageName}: XNL resources, Kind-native CLI and Vue Page generation ready.`);
  } finally {
    rmSync(installRoot, { recursive: true, force: true });
  }
}

await smokeInstalledBuilder();
