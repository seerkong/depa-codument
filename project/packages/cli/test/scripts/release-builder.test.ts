import { expect, test } from 'bun:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stageReleaseBuilder } from '../../../../scripts/release-builder';
import { RELEASE_TARGETS } from '../../../../scripts/release-targets';

const root = resolve(import.meta.dir, '../../../..');
test('native builder payload preserves the complete product bridge and pins public dependencies', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'release-builder-recipe-'));
  try {
    const source = join(root, 'packages/page-builder-vue'), target = join(temporary, 'builder-vue');
    stageReleaseBuilder(source, target);
    const manifest = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    expect(manifest.dependencies['halfcode-cli-lite-page-builder-vue-support']).toBe('0.1.1');
    expect(manifest.devDependencies).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toContain('workspace:');
    for (const file of await readdir(join(source, 'src'))) {
      expect(await readFile(join(target, 'src', file), 'utf8')).toBe(await readFile(join(source, 'src', file), 'utf8'));
    }
    for (const platform of RELEASE_TARGETS) {
      const runtime = JSON.parse(await readFile(join(root, 'packages', platform.packageDirectory, 'package.json'), 'utf8'));
      expect(runtime.dependencies['halfcode-cli-lite-page-builder-vue-support']).toBe('0.1.1');
      expect(runtime.bin).toHaveProperty(platform.binaryName.replace('.exe', ''));
    }
    const archive = join(temporary, 'bridge.tgz');
    const child = Bun.spawn([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', archive], { cwd: target, stdout: 'pipe', stderr: 'pipe' });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    if (code !== 0) throw new Error(stdout + stderr);
    expect((await readFile(archive)).length).toBeGreaterThan(0);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
