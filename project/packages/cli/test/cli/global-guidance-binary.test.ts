import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CODUMENT_OPERATION_ROUTES } from 'depa-codument-product-capsule/global-guidance';

test('compiled binary installs only one new guidance App and dispatches all 15 commands without Serve', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'depa-guidance-native-')));
  const home = join(root, 'home'), workspace = join(root, 'project');
  const project = resolve(import.meta.dir, '../../../..');
  const binary = join(root, 'depa-codument');
  async function run(args: string[]) {
    const child = Bun.spawn([binary, '-w', workspace, ...args], { cwd: workspace, stdout: 'pipe', stderr: 'pipe',
      env: { ...process.env, CODUMENT_HOME: home } });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { code, stdout, stderr };
  }
  try {
    const build = Bun.spawn([process.execPath, 'run', 'scripts/build.ts', `--outfile=${binary}`], {
      cwd: project, stdout: 'pipe', stderr: 'pipe',
    });
    const [buildCode, buildOut, buildError] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()]);
    expect(buildCode, buildOut + buildError).toBe(0);
    await mkdir(workspace, { recursive: true });
    const old = join(home, '.agents/skills/codument/SKILL.md');
    await mkdir(join(old, '..'), { recursive: true });
    await writeFile(old, 'Old session sentinel');
    const installed = await run(['init-global', '--json']);
    expect(installed.code, installed.stderr).toBe(0);
    expect(await readFile(old, 'utf8')).toBe('Old session sentinel');
    expect((await readdir(join(home, '.agents/skills'))).sort()).toEqual(['codument', 'depa-codument']);
    const app = join(home, '.agents/skills/depa-codument');
    expect(await readFile(join(app, 'manifest.xnl'), 'utf8')).toContain('CommandOperation');
    expect(await readFile(join(app, 'references/std/protocols/attractor-check.md'), 'utf8')).toContain('AttractorCheck');
    expect(await readFile(join(app, 'references/host/runtime.md'), 'utf8')).toContain('invoke');
    const help = await run(['-h']);
    for (const route of CODUMENT_OPERATION_ROUTES) {
      expect(help.stdout).toContain(route.command);
      const result = await run([route.command, 'target', '--json']);
      expect(result.code, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ status: 'guidance', arguments: ['target'], operation: { fqn: route.fqn } });
    }
    expect(await readdir(workspace)).toEqual([]);
    const initialized = await run(['init-workspace', '--agent', 'codex', '--json']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const status = await run(['status', '--json']);
    expect(status.code, status.stdout + status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ product: { status: 'No Tracks' } });
    const upgrade = await run(['upgrade-workspace', '--json']);
    expect(upgrade.code, upgrade.stdout + upgrade.stderr).toBe(0);
    expect(JSON.parse(upgrade.stdout)).toMatchObject({ phase: 'complete', appStatus: 'noop' });
    expect(await readdir(join(workspace, 'codument'))).not.toContain('std');
    expect(await readFile(old, 'utf8')).toBe('Old session sentinel');
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30_000);
