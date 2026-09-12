import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { COMMANDS } from '../../packages/cli/src/cli/command-registry';
import { inspectDomainCapabilityCoverage } from './domain-capabilities';

export const MIGRATION_CORE_TEST_PATHS = [
  'packages/domain-logic/test/migration.test.ts', 'packages/domain-logic/test/migration-xml.test.ts',
  'packages/domain-support/test/migration.test.ts', 'packages/domain-support/test/workspace-migration.test.ts',
  'packages/product-capsule/test/migration.test.ts', 'packages/product-capsule/test/workspace-migration.test.ts',
  'packages/product-capsule/test/migration-semantic.test.ts', 'packages/product-capsule/test/workspace-assets.test.ts',
  'packages/cli/test/cli/domain-migration.test.ts',
  'packages/cli/test/cli/workspace-product-commands.test.ts',
] as const;
export const LEGACY_MIGRATION_LEAVES = ['migrate inspect', 'migrate plan', 'migrate apply', 'migrate verify', 'upgrade-resource', 'upgrade-track'] as const;

/** Core and workspace CLI fixtures do not assert arbitrary user semantic decisions. */
export async function verifyMigrationCore(root: string): Promise<void> {
  inspectDomainCapabilityCoverage(COMMANDS);
  for (const name of [...LEGACY_MIGRATION_LEAVES, 'migrate guide']) {
    const [first, second] = name.split(' '), parent = COMMANDS.find(command => command.name === first);
    const leaf = second ? parent?.children?.find(command => command.name === second) : parent;
    if (!leaf?.run || leaf.execution?.placement !== 'local' || leaf.execution.runtimeProfile !== 'domain-registry') throw new Error('Missing local bootstrap migration leaf: ' + name);
  }
  const tests = Bun.spawn([process.execPath, 'test', ...MIGRATION_CORE_TEST_PATHS], {cwd: root, stdout: 'inherit', stderr: 'inherit'});
  if (await tests.exited) throw new Error('Core migration source/semantic/recovery tests failed.');
  const temporary = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'codument-migration-compiled-')));
  try {
    const binary = join(temporary, 'migration-proof');
    const build = Bun.spawn([process.execPath, 'run', join(root, 'scripts/build.ts'), '--entrypoint=packages/product-capsule/test/fixtures/migration-consumer.ts', '--outfile=' + binary],
      {cwd: root, stdout: 'inherit', stderr: 'inherit'});
    if (await build.exited) throw new Error('Compiled migration consumer build failed.');
    const invoke = async (arg: string) => {
      const child = Bun.spawn([binary, arg], {cwd: temporary, env: {PATH: '/usr/bin:/bin'}, stdout: 'pipe', stderr: 'pipe'});
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      if (code || stderr) throw new Error(`Compiled migration failed: ${code}: ${stderr}`); return stdout;
    };
    if (!(await invoke('guide')).includes('Decision review-required')) throw new Error('Compiled CLI closure omitted bootstrap guidance.');
    const workspace = join(temporary, 'workspace'); await fs.mkdir(join(workspace, 'codument/config'), {recursive: true});
    const old = '<AttractorProfiles><Profile name="custom" enabled="true"/></AttractorProfiles>';
    await fs.writeFile(join(workspace, 'codument/config/attractor-profiles.xml'), old);
    const result = JSON.parse(await invoke(workspace));
    if (result.status !== 'applied' || !result.backupPath || await fs.readFile(join(result.backupPath, 'config/attractor-profiles.xml'), 'utf8') !== old) throw new Error('Compiled migration did not preserve and upgrade the source.');
    if (JSON.parse(await invoke(workspace)).status !== 'noop') throw new Error('Compiled migration repeat is not idempotent.');
    if ((await fs.readdir(join(workspace, 'codument'), {recursive: true})).some(file => file.includes('KindDefinitions'))) throw new Error('Migration copied Kind definitions into the App.');
    console.log(JSON.stringify({status: 'PASS', suite: 'migration', scope: 'core', legacyLeaves: LEGACY_MIGRATION_LEAVES,
      compiledBootstrapAndAppUpgrade: true, semanticExercise: 'one recovered, four explicitly unresolved and preserved',
      compatibilityChanges: ['mandatory backup', 'workspace-local backup-dir', 'unsafe early plan.xml mapping requires Agent review'],
      workspaceCliAndAgentRefresh: 'isolated-source-tested', installedTarballConsumer: 'UNVERIFIED', fullMission: 'UNVERIFIED'}));
  } finally {await fs.rm(temporary, {recursive: true, force: true});}
}
