#!/usr/bin/env bun
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SKILL_APP_COMPILER_VERSION,
  SKILL_APP_CONTRACT_VERSION,
  SKILL_APP_PROTOCOL_VERSION,
} from '../packages/skill-app-contract/src/shared';
import { resolveReleaseTarget } from './release-targets';

const EXPECTED_HALFCODE_VERSION = SKILL_APP_COMPILER_VERSION;
const EXPECTED_CONTRACT_VERSION = SKILL_APP_CONTRACT_VERSION;
const EXPECTED_PROTOCOL_VERSION = SKILL_APP_PROTOCOL_VERSION;
const RESOURCE_ENVELOPE_VERSION = 'halfcode.resource-envelope/v1';
const HALFCODE_COMPILER_PACKAGE_ENV = 'HALFCODE_COMPILER_PACKAGE';
const VERIFICATION_BIN = 'depa-codument';
const VERIFICATION_CONTRACT = 'depa-codument-skill-app-contract';

export interface VerificationStep {
  readonly name: string;
  readonly command: readonly string[];
}

export interface XnlIntegrationReceipt {
  readonly ok: true;
  readonly halfcodeVersion: string;
  readonly contractVersion: string;
  readonly protocolVersion: string;
  readonly cloneIdentity: string;
  readonly releaseTargets: readonly string[];
  readonly installedCommands: readonly string[];
  readonly readerProfileId: string;
  readonly contractLockDigest: string;
  readonly resourceResolutionReceipts: number;
  readonly page: string;
  readonly generation: string;
  readonly legacyAuthorities: 0;
}

export interface CandidateRegistry {
  readonly url: string;
  readonly stop: () => void;
}

interface CanonicalKindContract {
  readonly subjectFqn: string;
  readonly schemaRef: string;
  readonly sourceShapes: readonly string[];
  readonly documentCardinality: string;
  readonly revision: Readonly<{
    specVersion: number;
    schemaFingerprint: string;
    contractFingerprint: string;
    semanticContract: Readonly<{
      semanticValidatorFingerprint: string;
      referenceProjectionFingerprint: string;
      compilerInputFingerprint: string;
    }>;
    stability: string;
  }>;
}

export function integrationCommandPlan(sourceRoot: string, cloneRoot: string): readonly VerificationStep[] {
  return Object.freeze([
    Object.freeze({
      name: 'clone',
      command: Object.freeze([
        process.execPath, 'run', resolve(sourceRoot, 'scripts/clone.ts'), cloneRoot,
        '--mode', 'source-only',
      ]),
    }),
    Object.freeze({ name: 'fresh-install', command: Object.freeze([process.execPath, 'install']) }),
    Object.freeze({ name: 'clone-check', command: Object.freeze([process.execPath, 'run', 'check']) }),
    Object.freeze({ name: 'three-platform-build', command: Object.freeze([process.execPath, 'run', 'build:release']) }),
    Object.freeze({ name: 'release-check', command: Object.freeze([process.execPath, 'run', 'check:release']) }),
  ]);
}

export function verificationBinaryName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? `${VERIFICATION_BIN}.exe` : VERIFICATION_BIN;
}

function walkFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(root, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : entry.isFile() ? [absolute] : [];
  });
}

export function compilerCandidatePath(): string | undefined {
  const configured = process.env[HALFCODE_COMPILER_PACKAGE_ENV]?.trim();
  if (!configured) return undefined;
  const candidate = resolve(configured.replace(/^tarball=/, ''));
  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    throw new Error(`${HALFCODE_COMPILER_PACKAGE_ENV} must name a readable compiler tarball: ${candidate}`);
  }
  const extracted = Bun.spawnSync(['tar', '-xOf', candidate, 'package/package.json']);
  if (extracted.exitCode !== 0) {
    throw new Error(`${HALFCODE_COMPILER_PACKAGE_ENV} is not an npm package tarball: ${candidate}`);
  }
  const manifest = JSON.parse(extracted.stdout.toString()) as { name?: unknown; version?: unknown };
  if (manifest.name !== 'halfcode-compiler.xnl' || manifest.version !== EXPECTED_HALFCODE_VERSION) {
    throw new Error(`${HALFCODE_COMPILER_PACKAGE_ENV} must contain halfcode-compiler.xnl@${EXPECTED_HALFCODE_VERSION}`);
  }
  return candidate;
}

export function startCandidateRegistry(candidate: string): CandidateRegistry {
  const archive = readFileSync(candidate);
  const extracted = Bun.spawnSync(['tar', '-xOf', candidate, 'package/package.json']);
  if (extracted.exitCode !== 0) throw new Error(`Unable to read compiler candidate manifest: ${candidate}`);
  const manifest = JSON.parse(extracted.stdout.toString()) as Record<string, unknown>;
  const shasum = createHash('sha1').update(archive).digest('hex');
  const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
  let origin = '';
  const tarballPath = `/halfcode-compiler.xnl/-/halfcode-compiler.xnl-${EXPECTED_HALFCODE_VERSION}.tgz`;
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    idleTimeout: 255,
    async fetch(request) {
      const requested = new URL(request.url);
      if (requested.pathname === '/halfcode-compiler.xnl') {
        return Response.json({
          name: 'halfcode-compiler.xnl',
          'dist-tags': { latest: EXPECTED_HALFCODE_VERSION },
          versions: {
            [EXPECTED_HALFCODE_VERSION]: {
              ...manifest,
              dist: { tarball: `${origin}${tarballPath}`, shasum, integrity },
            },
          },
        });
      }
      if (requested.pathname === tarballPath) {
        const headers = {
          'content-length': String(archive.byteLength),
          'content-type': 'application/octet-stream',
        };
        return request.method === 'HEAD'
          ? new Response(null, { headers })
          : new Response(archive, { headers });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Candidate registry is read-only', { status: 405 });
      }
      const headers = new Headers(request.headers);
      headers.delete('authorization');
      headers.delete('connection');
      headers.delete('cookie');
      headers.delete('host');
      headers.set('accept-encoding', 'identity');
      const upstream = new URL(`${requested.pathname}${requested.search}`, 'https://registry.npmjs.org');
      let lastError: unknown;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const response = await fetch(upstream, {
            method: request.method,
            headers,
            redirect: 'follow',
          });
          if (response.status < 500 || attempt === 3) return response;
          await response.body?.cancel();
        } catch (error) {
          lastError = error;
          if (attempt === 3) break;
        }
        await Bun.sleep(50 * (attempt + 1));
      }
      return new Response(
        `Candidate registry upstream failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        { status: 502 },
      );
    },
  });
  origin = `http://${server.hostname}:${server.port}`;
  return Object.freeze({ url: origin, stop: () => server.stop(true) });
}

export function legacyAuthorityPaths(cloneRoot: string): readonly string[] {
  const templatesRoot = resolve(cloneRoot, 'packages/cli/src/templates');
  const removedSopPath = new RegExp([
    ['Application', 'SOP'].join(''),
    ['application', 'sop'].join('-'),
    ['application', 'sop'].join('_'),
  ].join('|'));
  return Object.freeze(walkFiles(templatesRoot)
    .map((file) => relative(templatesRoot, file).split('\\').join('/'))
    .filter((file) => basename(file) === 'page.json'
      || file.split('/').includes('page-automation')
      || removedSopPath.test(file))
    .sort());
}

export function assertCleanCloneSurface(cloneRoot: string): void {
  const legacy = legacyAuthorityPaths(cloneRoot);
  if (legacy.length > 0) throw new Error(`Clone retained legacy resource authorities: ${legacy.join(', ')}`);
  // Source snapshots retain their product and semantic identities verbatim.
  for (const localState of ['.agents', '.claude', '.codex', '.eidolon', '.opencode', '.code-review-graph', '.depa-analysis']) {
    if (existsSync(resolve(cloneRoot, localState))) {
      throw new Error(`Clone retained local workspace state: ${localState}`);
    }
  }
}

async function run(
  command: readonly string[],
  options: { cwd: string; env?: Record<string, string | undefined>; capture?: boolean },
): Promise<string> {
  const child = Bun.spawn([...command], {
    cwd: options.cwd,
    env: options.env,
    stdout: options.capture ? 'pipe' : 'inherit',
    stderr: options.capture ? 'pipe' : 'inherit',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    options.capture ? new Response(child.stdout).text() : '',
    options.capture ? new Response(child.stderr).text() : '',
  ]);
  if (exitCode !== 0) throw new Error(`Verification command failed (${exitCode}): ${command.join(' ')}\n${stderr || stdout}`);
  return stdout;
}

async function expectFailure(command: readonly string[], cwd: string, env: Record<string, string | undefined>): Promise<void> {
  const child = Bun.spawn([...command], { cwd, env, stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode === 0) throw new Error(`Legacy command unexpectedly succeeded: ${command.join(' ')}\n${stdout}`);
  const payload = JSON.parse(stderr || stdout) as { ok?: boolean; message?: string };
  if (payload.ok !== false || !payload.message?.includes('Unknown command:')) {
    throw new Error(`Legacy command returned an unexpected failure: ${stderr || stdout}`);
  }
}

function assertPinnedContractSurface(cloneRoot: string): void {
  const manifest = JSON.parse(readFileSync(resolve(cloneRoot, 'packages/cli/package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  if (manifest.dependencies?.['halfcode-compiler.xnl'] !== EXPECTED_HALFCODE_VERSION) {
    throw new Error(`Clone does not pin halfcode-compiler.xnl@${EXPECTED_HALFCODE_VERSION}`);
  }
  const contractManifest = JSON.parse(readFileSync(
    resolve(cloneRoot, 'packages/skill-app-contract/package.json'),
    'utf8',
  )) as { name?: unknown; version?: unknown; dependencies?: Record<string, string> };
  if (contractManifest.name !== VERIFICATION_CONTRACT) {
    throw new Error(`Clone exposes the wrong skill-app-contract package identity: ${String(contractManifest.name)}`);
  }
  if (contractManifest.version !== EXPECTED_CONTRACT_VERSION) {
    throw new Error(`Clone does not expose skill-app-contract@${EXPECTED_CONTRACT_VERSION}`);
  }
  if (contractManifest.dependencies?.['halfcode-compiler.xnl'] !== EXPECTED_HALFCODE_VERSION) {
    throw new Error(`Clone skill-app-contract does not pin halfcode-compiler.xnl@${EXPECTED_HALFCODE_VERSION}`);
  }
  // The native package is now a compatibility facade. Its public release tuple
  // is exercised by the installed resource consumer, not by matching source literals.
  const lock = readFileSync(resolve(cloneRoot, 'bun.lock'), 'utf8');
  if (!lock.includes(`halfcode-compiler.xnl@${EXPECTED_HALFCODE_VERSION}`)
    || /halfcode-compiler\.xnl@(?:workspace|file|link):/.test(lock)) {
    throw new Error('Clone lockfile does not resolve the published Halfcode package exactly');
  }
}

async function assertCanonicalTemplateContracts(cloneRoot: string): Promise<void> {
  const templatesRoot = resolve(cloneRoot, 'packages/cli/src/templates');
  const resourceModulePath = resolve(cloneRoot, 'packages/skill-app-contract/src/resource.ts');
  const resourceModule = await import(`${pathToFileURL(resourceModulePath).href}?verification=${Date.now()}`) as {
    skillAppKindContract(kind: never): CanonicalKindContract;
    renderSkillAppKindDefinition(descriptor: CanonicalKindContract): string;
  };
  const relevant = walkFiles(templatesRoot).filter((file) => /\.(?:md|xnl|ya?ml)$/.test(file));
  for (const file of relevant) {
    const source = readFileSync(file, 'utf8');
    if (/\bapiVersion\s*[:=]|\b(?:currentApiVersion|supportedApiVersions|currentSpecVersion|supportedSpecVersions)\s*=|\bversion\s*[:=]/m.test(source)) {
      throw new Error(`Clone template retained a removed Halfcode resource field: ${relative(cloneRoot, file)}`);
    }
  }
  const definitions = relevant.filter((file) => basename(file) === 'manifest.xnl'
    && file.split(/[\\/]/).includes('KindDefinitions'));
  if (definitions.length === 0) throw new Error('Clone contains no KindDefinition fixtures to verify');
  for (const file of definitions) {
    const source = readFileSync(file, 'utf8');
    const kind = /\bresourceKind\s*=\s*"([^"]+)"/.exec(source)?.[1];
    if (!kind) throw new Error(`KindDefinition fixture omits resourceKind: ${relative(cloneRoot, file)}`);
    let descriptor: CanonicalKindContract;
    try {
      descriptor = resourceModule.skillAppKindContract(kind as never);
    } catch {
      throw new Error(`KindDefinition fixture has no canonical descriptor: ${kind}`);
    }
    const expected = resourceModule.renderSkillAppKindDefinition(descriptor);
    if (source !== expected) {
      throw new Error(`KindDefinition fixture differs from its canonical descriptor (${kind})`);
    }
  }
}

async function installedFullDemoSmoke(
  cloneRoot: string,
  integrationRoot: string,
  registryEnv: Record<string, string | undefined> = {},
  compilerPackage?: string,
): Promise<{
  generation: string;
  readerProfileId: string;
  contractLockDigest: string;
  resourceResolutionReceipts: number;
}> {
  const target = resolveReleaseTarget();
  const runtimeRoot = resolve(cloneRoot, 'packages', target.packageDirectory);
  const packRoot = resolve(integrationRoot, 'pack');
  const installRoot = resolve(integrationRoot, 'install');
  const workspaceRoot = resolve(integrationRoot, 'workspace');
  const isolatedHome = resolve(integrationRoot, 'home');
  for (const directory of [packRoot, installRoot, workspaceRoot, isolatedHome]) mkdirSync(directory, { recursive: true });
  const env = { ...process.env, ...registryEnv, HOME: isolatedHome, USERPROFILE: isolatedHome };
  const packedName = (await run([
    'npm', 'pack', '--pack-destination', packRoot, runtimeRoot,
  ], { cwd: cloneRoot, env, capture: true })).trim().split(/\r?\n/).at(-1);
  if (!packedName) throw new Error('npm pack did not produce a current-platform runtime package');
  const contractRoot = resolve(cloneRoot, 'packages', 'skill-app-contract');
  const contractPackedName = (await run([
    'npm', 'pack', '--pack-destination', packRoot, contractRoot,
  ], { cwd: cloneRoot, env, capture: true })).trim().split(/\r?\n/).at(-1);
  if (!contractPackedName) throw new Error('npm pack did not produce the cloned Skill App contract package');
  const installPackages = [
    ...(compilerPackage ? [compilerPackage] : []),
    resolve(packRoot, contractPackedName),
    resolve(packRoot, packedName),
  ];
  await run([
    'npm', 'install', '--global', '--prefix', installRoot, '--force', '--ignore-scripts', ...installPackages,
  ], { cwd: cloneRoot, env });
  const installedBinaryName = verificationBinaryName(target.platform);
  const binary = resolve(installRoot, 'bin', installedBinaryName);
  if (!existsSync(binary)) throw new Error(`Installed runtime omitted ${installedBinaryName}`);
  const invoke = async (args: readonly string[]) => JSON.parse(await run(
    [binary, ...args, '--json'], { cwd: workspaceRoot, env, capture: true },
  )) as Record<string, unknown>;

  const initialized = await invoke(['init-workspace']);
  if (initialized.ok !== true) throw new Error(`Installed init-workspace failed: ${JSON.stringify(initialized)}`);
  const workflowsIgnore = resolve(workspaceRoot, '.codument', 'workflows', '.gitignore');
  if (!existsSync(workflowsIgnore) || readFileSync(workflowsIgnore, 'utf8') !== '*\n!.gitignore\n') {
    throw new Error('Installed init-workspace omitted the workflows ignore marker');
  }
  const validated = await invoke(['Resource', 'validate']);
  if (validated.ok !== true || validated.command !== 'Resource.validate') {
    throw new Error(`Installed Resource.validate failed: ${JSON.stringify(validated)}`);
  }
  const resourceTree = await invoke(['Resource', 'tree']);
  const readerProfileId = resourceTree.readerProfileId;
  const contractLock = resourceTree.contractLock as { lockDigest?: unknown } | undefined;
  if (resourceTree.ok !== true || resourceTree.command !== 'Resource.tree'
    || readerProfileId !== 'codument.host/resource-readers/v1'
    || typeof contractLock?.lockDigest !== 'string'
    || !/^sha256:[0-9a-f]{64}$/.test(contractLock.lockDigest)) {
    throw new Error(`Installed Resource.tree omitted its reader profile or contract lock: ${JSON.stringify(resourceTree)}`);
  }
  const resourcePackages = Array.isArray(resourceTree.packages)
    ? resourceTree.packages as Array<{ resources?: unknown }>
    : [];
  const resolvedResources = resourcePackages.flatMap((entry) => Array.isArray(entry.resources)
    ? entry.resources as Array<Record<string, unknown>>
    : []).filter((resource) => resource.resolution !== undefined);
  if (resolvedResources.length === 0) {
    throw new Error('Installed Resource.tree produced no authored resource resolution receipts');
  }
  for (const resource of resolvedResources) {
    const resolution = resource.resolution as {
      readerProfileId?: unknown;
      source?: Record<string, unknown>;
      reader?: Record<string, unknown>;
      sourceContentDigest?: unknown;
      effectiveContentDigest?: unknown;
    };
    if (resolution.readerProfileId !== readerProfileId
      || resolution.source?.envelopeVersion !== RESOURCE_ENVELOPE_VERSION
      || resolution.source?.specVersion !== 1
      || typeof resolution.source?.contractFingerprint !== 'string'
      || typeof resolution.reader?.readerId !== 'string'
      || resolution.reader?.readerSpecVersion !== 1
      || typeof resolution.reader?.contractFingerprint !== 'string'
      || typeof resolution.reader?.implementationFingerprint !== 'string'
      || typeof resolution.sourceContentDigest !== 'string'
      || typeof resolution.effectiveContentDigest !== 'string') {
      throw new Error(`Installed Resource.tree returned an incomplete resolution receipt: ${JSON.stringify(resource)}`);
    }
  }
  const leafSop = await invoke([
    'SOP', 'validate', '--fqn', 'Codument.Demo.SOP.GoogleSearch',
  ]);
  if (leafSop.ok !== true || leafSop.command !== 'SOP.validate' || leafSop.valid !== true) {
    throw new Error(`Installed SOP.validate failed: ${JSON.stringify(leafSop)}`);
  }
  const installedSkill = resolve(workspaceRoot, '.agents', 'skills', 'codument-demo');
  writeFileSync(resolve(
    installedSkill,
    'modules',
    'google-search',
    'sops',
    'codument-demo--sop--pipeline.md',
  ), [
    '---',
    `envelopeVersion: ${RESOURCE_ENVELOPE_VERSION}`,
    'specVersion: 1',
    'kind: SOP',
    'metadata:',
    '  fqn: Codument.Demo.SOP.Pipeline',
    'spec:',
    '  profile: typed-pipeline',
    '  description: Installed clone pipeline smoke',
    '---',
    '',
    '<input_contract>', 'Canonical installed smoke input.', '</input_contract>', '',
    '<preconditions>', 'The cloned Child SOP is ready.', '</preconditions>', '',
    '<procedure format="markdown-step-graph/v1">', '',
    '## Entry', '', '`run-child`', '',
    '## Step `run-child` — Run child', '',
    '### SOP', '', '`Codument.Demo.SOP.GoogleSearch`', '',
    '### Enter when', '', 'The canonical input exists.', '',
    '### Input mapping', '', 'Pass the canonical input.', '',
    '### Success', '', 'Retain the Child SOP receipt.', '',
    '### Failure', '', 'Record the blocker and stop.', '',
    '### End `success`', '', 'Return the receipt.', '',
    '</procedure>', '',
    '<effects>', 'Only the Child SOP owns effects.', '</effects>', '',
    '<output_contract>', 'A stable Child SOP receipt.', '</output_contract>', '',
    '<success_criteria>', 'The receipt is verifiable.', '</success_criteria>', '',
  ].join('\n'));
  const pipelineSop = await invoke([
    'SOP', 'validate', '--fqn', 'Codument.Demo.SOP.Pipeline',
  ]);
  if (pipelineSop.ok !== true || pipelineSop.valid !== true) {
    throw new Error(`Installed typed-pipeline SOP.validate failed: ${JSON.stringify(pipelineSop)}`);
  }
  const notebook = await invoke([
    'SOP', 'notebook', 'init', '--fqn', 'Codument.Demo.SOP.Pipeline',
  ]);
  if (notebook.ok !== true || notebook.action !== 'created'
    || notebook.notebookPath !== '.codument/workflows/Codument.Demo.SOP.Pipeline.md') {
    throw new Error(`Installed SOP notebook init failed: ${JSON.stringify(notebook)}`);
  }
  for (const [kind, action] of [['LocalFunction', 'list'], ['PageWorkflow', 'list'], ['PageObject', 'list']] as const) {
    const result = await invoke([kind, action]);
    if (result.ok !== true || result.command !== `${kind}.${action}`) {
      throw new Error(`Installed ${kind}.${action} failed: ${JSON.stringify(result)}`);
    }
    const serialized = JSON.stringify(result);
    if (kind === 'PageWorkflow'
      && (!serialized.includes('Codument.GoogleSearch.Workflow.Search')
        || !serialized.includes('Codument.Owid.OpenDataExport.Workflow.Run')
        || !serialized.includes('HostBundle'))) {
      throw new Error(`Installed PageWorkflow.list missed module-host definitions: ${serialized}`);
    }
    if (kind === 'PageObject'
      && (!serialized.includes('Codument.GoogleSearch.Page.Results')
        || !serialized.includes('Codument.Owid.LifeExpectancy.Page.Chart')
        || !serialized.includes('HostBundle'))) {
      throw new Error(`Installed PageObject.list missed module-host definitions: ${serialized}`);
    }
  }
  for (const structuralKind of [
    'SkillApp',
    'SkillModule',
    'HostBundle',
    'LocalFunctionBundle',
    'PageWorkflowBundle',
    'PageObjectBundle',
  ]) {
    await expectFailure([binary, structuralKind, 'list', '--json'], workspaceRoot, env);
  }
  const pages = await invoke(['Page', 'list']);
  if (pages.ok !== true || pages.command !== 'Page.list' || !JSON.stringify(pages).includes('live-vue-dashboard')) {
    throw new Error(`Installed Page.list missed live-vue-dashboard: ${JSON.stringify(pages)}`);
  }
  for (const command of ['page', 'page-automation', 'page-workflow', 'local-function']) {
    await expectFailure([binary, command, 'list', '--json'], workspaceRoot, env);
  }

  const started = await invoke(['serve', 'start', '--port', '0']);
  if (started.ok !== true || typeof started.url !== 'string') {
    throw new Error(`Installed Serve did not start: ${JSON.stringify(started)}`);
  }
  try {
    const origin = new URL(started.url);
    const opened = await fetch(new URL('/api/pages/live-vue-dashboard/open', origin), { method: 'POST' });
    if (!opened.ok) throw new Error(`Installed full demo Page open failed: HTTP ${opened.status} ${await opened.text()}`);
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const response = await fetch(new URL('/api/pages', origin));
      const payload = await response.json() as { pages?: Array<{ name?: string; runtime?: { generation?: string | null } }> };
      const generation = payload.pages?.find((page) => page.name === 'live-vue-dashboard')?.runtime?.generation;
      if (generation) return {
        generation,
        readerProfileId,
        contractLockDigest: contractLock.lockDigest,
        resourceResolutionReceipts: resolvedResources.length,
      };
      await Bun.sleep(20);
    }
    throw new Error('Installed full demo Vue Page did not publish a generation');
  } finally {
    await invoke(['serve', 'stop']);
  }
}

export async function verifyXnlBundleIntegration(sourceRoot = resolve(import.meta.dir, '..')): Promise<XnlIntegrationReceipt> {
  const integrationRoot = mkdtempSync(join(tmpdir(), 'xnl-bundle-integration-'));
  const cloneRoot = resolve(integrationRoot, 'clone');
  const candidate = compilerCandidatePath();
  const candidateRegistry = candidate ? startCandidateRegistry(candidate) : undefined;
  const registryEnv = candidateRegistry ? {
    NPM_CONFIG_REGISTRY: candidateRegistry.url,
    npm_config_registry: candidateRegistry.url,
  } : {};
  const commandEnv = { ...process.env, ...registryEnv };
  try {
    const plan = integrationCommandPlan(sourceRoot, cloneRoot);
    await run(plan[0].command, { cwd: sourceRoot, env: commandEnv });
    assertCleanCloneSurface(cloneRoot);
    const installCommand = candidateRegistry
      ? Object.freeze([...plan[1].command, '--registry', candidateRegistry.url])
      : plan[1].command;
    await run(installCommand, { cwd: cloneRoot, env: commandEnv });
    assertPinnedContractSurface(cloneRoot);
    await assertCanonicalTemplateContracts(cloneRoot);
    await run(plan[2].command, { cwd: cloneRoot, env: commandEnv });
    for (const step of plan.slice(3)) await run(step.command, { cwd: cloneRoot, env: commandEnv });
    const {
      generation,
      readerProfileId,
      contractLockDigest,
      resourceResolutionReceipts,
    } = await installedFullDemoSmoke(cloneRoot, integrationRoot, registryEnv, candidate);
    return Object.freeze({
      ok: true,
      halfcodeVersion: EXPECTED_HALFCODE_VERSION,
      contractVersion: EXPECTED_CONTRACT_VERSION,
      protocolVersion: EXPECTED_PROTOCOL_VERSION,
      cloneIdentity: VERIFICATION_BIN,
      releaseTargets: Object.freeze(['darwin-arm64', 'darwin-x64', 'windows-x64']),
      installedCommands: Object.freeze([
        'Resource.validate', 'Resource.tree', 'SOP.validate', 'SOP.notebook.init',
        'LocalFunction.list', 'PageWorkflow.list', 'PageObject.list', 'Page.list',
      ]),
      readerProfileId,
      contractLockDigest,
      resourceResolutionReceipts,
      page: 'live-vue-dashboard',
      generation,
      legacyAuthorities: 0,
    });
  } finally {
    candidateRegistry?.stop();
    rmSync(integrationRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    console.log(JSON.stringify(await verifyXnlBundleIntegration(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
