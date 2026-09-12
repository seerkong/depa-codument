import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { command } from './consumer';
import { openReleaseRegistry } from './release-set';
import { inspectDomainCapabilityCoverage } from './domain-capabilities';
import { COMMANDS } from '../../packages/cli/src/cli/command-registry';

export const PLACEMENT_POLICY_TESTS = ['command-registry', 'serve-placement', 'local-function-runtime'].map(name => 'packages/cli/test/cli/' + name + '.test.ts');
const runtimeTests = ['profile-configuration', 'browser-provider', 'workspace-browser-config', 'opencli-command-integration',
  'opencli', 'opencli-plugin', 'mdd-browser-robot', 'ego-supervisor', 'debug-runtime',
  'page-workflow', 'page-runtime', 'site-runtime', 'vue-page-integration', 'mcp-app-runtime', 'mcp-cli-lifecycle',
  'serve-lifecycle', 'http-lifecycle', 'domain-commands', 'domain-query', 'domain-scaffold', 'domain-validate',
  'domain-std', 'domain-knowledge', 'domain-artifact', 'domain-archive', 'domain-migration', 'domain-app', 'workspace-product-commands', 'command-operation']
  .map(name => 'packages/cli/test/cli/' + name + '.test.ts');

/** A full product placement matrix, plus independent installation of the exact
 * public release. Test peers replace external IO, never provider implementations. */
export async function verifyServePlacement(root: string, policyOnly = false): Promise<void> {
  const release = process.env.CODUMENT_VERIFY_RELEASE_SET;
  if (!policyOnly && !release) throw new Error('UNVERIFIED: set CODUMENT_VERIFY_RELEASE_SET to the immutable public release directory.');
  inspectDomainCapabilityCoverage(COMMANDS);
  const targets = policyOnly ? PLACEMENT_POLICY_TESTS : [...PLACEMENT_POLICY_TESTS, ...runtimeTests,
    'packages/domain-support/test/lifecycle-repository.test.ts', 'packages/domain-support/test/verification.test.ts'];
  for (const target of targets) {
    const child = Bun.spawn([process.execPath, join(root, 'scripts/test.ts'), target], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
    if (await child.exited) throw new Error('Placement behavior failed: ' + target);
  }
  if (!policyOnly) await verifyInstalledRuntime(resolve(release!));
  console.log(JSON.stringify({ status: 'PASS', suite: 'serve-placement', scope: policyOnly ? 'policy' : 'full',
    testTargets: targets, publicRuntime: policyOnly ? 'UNVERIFIED' : 'installed-release',
    realBrowser: 'NOT_RUN', realMessages: 'NOT_RUN', pausedCommands: [], fullMission: 'UNVERIFIED' }));
}

async function verifyInstalledRuntime(release: string): Promise<void> {
  const temporary = await mkdtemp(join(tmpdir(), 'codument-placement-consumer-'));
  try {
    const registry = await openReleaseRegistry(release);
    const dependencies: Record<string, string> = {};
    try {
      for (const artifact of registry.set.artifacts) if (artifact.role === 'shared') dependencies[artifact.name] = artifact.version;
      if (Object.keys(dependencies).length !== 14) throw new Error('Incomplete public package closure.');
      await writeFile(join(temporary, 'package.json'), JSON.stringify({ name: 'notes-placement-consumer', type: 'module', private: true, dependencies }));
      await command(['install', '--ignore-scripts', '--save-text-lockfile', '--registry', registry.url, '--cache-dir', join(temporary, 'install-cache')], temporary);
    } finally { await registry.close(); }
    for (const file of ['public-browser-bindings.mjs', 'public-live-consumer.mjs']) {
      await copyFile(join(import.meta.dir, 'fixtures', file), join(temporary, file));
      console.log(await command([file], temporary));
    }
    console.log(JSON.stringify({ consumer: 'Notes placement', releaseDigest: registry.digest,
      normalRegistryResolution: true, registryStoppedBeforeRuntime: true, sourceImports: false, transitiveOverrides: false }));
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
