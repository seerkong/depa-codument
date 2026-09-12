import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CODUMENT_WORKSPACE_ASSETS } from '../../../product-capsule/src/workspace-assets';

test('actual CLI initializes asset App, reports domain status and upgrades without Serve or local guidance', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'codument-workspace-cli-')));
  const workspace = join(root, 'project'), home = join(root, 'home');
  const entry = resolve(import.meta.dir, '../../src/cli/index.ts');
  const run = async (args: string[]) => {
    const child = Bun.spawn([process.execPath, entry, '-w', workspace, ...args, '--json'], {
      cwd: workspace, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, CODUMENT_HOME: home },
    });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { code, stdout, stderr };
  };
  try {
    await mkdir(workspace);
    expect((await run(['status'])).code).toBe(1);
    expect(await readdir(workspace)).toEqual([]);
    const sentinel = join(home, '.agents/skills/codument/SKILL.md');
    await mkdir(dirname(sentinel), { recursive: true }); await writeFile(sentinel, 'old session');
    const initialized = await run(['init', '--agent', 'codex']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await readFile(sentinel, 'utf8')).toBe('old session');
    expect(await readFile(join(workspace, 'codument/manifest.xnl'), 'utf8')).toContain('<SkillApp #codument.workspace');
    expect(await readFile(join(workspace, 'AGENTS.md'), 'utf8')).toContain('depa-codument');
    const tree = await readdir(workspace, { recursive: true });
    expect(tree).not.toContain('codument/std');
    expect(tree).not.toContain('.codument');
    expect(tree.some(file => file.includes('/skills/codument-'))).toBe(false);
    const status = await run(['status']);
    expect(status.code, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ initialized: true, product: { status: 'No Tracks' } });
    const again = await run(['init-workspace']);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(JSON.parse(again.stdout).data ?? JSON.parse(again.stdout)).toMatchObject({ workspaceWritten: 0 });
    const upgraded = await run(['upgrade-workspace']);
    expect(upgraded.code, upgraded.stdout + upgraded.stderr).toBe(0);
    expect(JSON.parse(upgraded.stdout)).toMatchObject({ phase: 'complete', appStatus: 'noop' });
    const legacy = CODUMENT_WORKSPACE_ASSETS.find(asset => asset.path === 'skills/codument-plan-track/SKILL.md')!;
    const oldSkill = join(workspace, '.agents', legacy.path);
    await mkdir(dirname(oldSkill), { recursive: true }); await writeFile(oldSkill, legacy.source);
    const retired = await run(['upgrade-workspace']);
    expect(retired.code, retired.stdout + retired.stderr).toBe(0);
    const receipt = JSON.parse(retired.stdout);
    expect(receipt.skills[0].removed).toBe(1);
    expect(await readFile(join(receipt.guidanceBackupRoot, 'retired/.agents', legacy.path), 'utf8')).toBe(legacy.source);
    await writeFile(oldSkill, 'customized operation');
    const review = await run(['upgrade-workspace']);
    expect(review.code, review.stdout + review.stderr).toBe(2);
    expect(JSON.parse(review.stdout)).toMatchObject({ phase: 'guidance', status: 'review-required', appStatus: 'noop' });
    expect(await readFile(oldSkill, 'utf8')).toBe('customized operation');
    const unknownStandard = join(workspace, 'codument/std/custom.md');
    await mkdir(dirname(unknownStandard), { recursive: true }); await writeFile(unknownStandard, 'user standard');
    const appReview = await run(['upgrade-workspace']);
    expect(appReview.code).toBe(2);
    expect(JSON.parse(appReview.stdout)).toMatchObject({ phase: 'app', status: 'review-required' });
    expect(JSON.parse(appReview.stdout).resources).toMatchObject({ upgraded: 0, removed: 0 });
    expect(await readFile(unknownStandard, 'utf8')).toBe('user standard');
    expect((await run(['init-workspace', '--force'])).code).not.toBe(0);
    expect(await readFile(sentinel, 'utf8')).toBe('old session');
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30_000);
