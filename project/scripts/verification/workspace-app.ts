import { mkdtemp, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const WORKSPACE_APP_TEST_PATHS = [
  'packages/product-capsule/test/workspace-app.test.ts',
  'packages/product-capsule/test/workspace-install.test.ts',
  'packages/product-capsule/test/workspace-assets.test.ts',
  'packages/cli/test/cli/domain-app.test.ts',
  'packages/cli/test/cli/workspace-product-commands.test.ts',
] as const;

/** Source and compiled installer proof; final distribution remains a separate gate. */
export async function verifyWorkspaceAppCore(root: string): Promise<void> {
  const tests = Bun.spawn([process.execPath, 'test', ...WORKSPACE_APP_TEST_PATHS], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
  if (await tests.exited) throw new Error('Workspace App source/semantic/recovery tests failed.');
  const temporary = await mkdtemp(join(await realpath(tmpdir()), 'codument-compiled-app-'));
  try {
    const binary = join(temporary, 'installer-proof');
    const build = Bun.spawn([process.execPath, 'build', '--compile', join(root, 'packages/product-capsule/test/fixtures/workspace-install-consumer.ts'), '--outfile', binary],
      { cwd: root, stdout: 'inherit', stderr: 'inherit' });
    if (await build.exited) throw new Error('Compiled installation consumer build failed.');
    const workspace = join(temporary, 'workspace'); await mkdir(workspace);
    for (const createdApp of [true, false]) {
      const child = Bun.spawn([binary, workspace], { cwd: workspace, env: { PATH: '/usr/bin:/bin' }, stdout: 'pipe', stderr: 'pipe' });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      if (code || stderr) throw new Error(`Compiled installer failed: ${code}: ${stderr}`);
      const result = JSON.parse(stdout);
      if (result.appId !== 'codument.workspace' || result.createdApp !== createdApp || (!createdApp && result.writtenCount)) throw new Error('Compiled installer result mismatch.');
    }
    const entries = await readdir(join(workspace, 'codument'), { recursive: true });
    if (entries.some(path => path.includes('KindDefinitions'))) throw new Error('Compiled App contains copied Kinds.');
    if (entries.includes('std')) throw new Error('Workspace contains a second standards authority.');
    if (!(await readFile(join(workspace, 'codument/SKILL.md'), 'utf8')).includes('depa-codument')) throw new Error('Compiled template closure is missing.');
    console.log(JSON.stringify({ status: 'PASS', suite: 'workspace-app', scope: 'core', compiledInstaller: true,
      finalCliIntegration: 'UNVERIFIED', installedTarballConsumer: 'UNVERIFIED', fullMission: 'UNVERIFIED' }));
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
