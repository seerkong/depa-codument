import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyGlobalInstall } from '../../src/cli/global-install';
import { createWorkspaceEffect } from '../../src/cli/effects/workspace';
import { createSourceResourceEffect } from '../../src/cli/effects/resource';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS as assets } from 'depa-codument-product-capsule/global-guidance';

test('selected agents receive exact complete replacement and a failed replacement restores all targets', async () => {
  const home = await mkdtemp(join(tmpdir(), 'depa-global-replace-'));
  const directories = ['.claude/skills', '.agents/skills', '.eidolon/skills'];
  const resources = createSourceResourceEffect();
  const workspace = (root?: string) => createWorkspaceEffect(join(home, root ?? '.'));
  try {
    for (const directory of directories) {
      await mkdir(join(home, directory, 'depa-codument/std'), { recursive: true });
      await writeFile(join(home, directory, 'depa-codument/std/custom.md'), 'old customization');
      await mkdir(join(home, directory, 'codument'), { recursive: true });
      await writeFile(join(home, directory, 'codument/SKILL.md'), 'protected old skill');
    }
    const receipt = await applyGlobalInstall(resources, workspace, home, 'upgrade-global', 'claude,codex,eidolon');
    expect(receipt.skills.map(skill => skill.agent)).toEqual(['claude', 'codex', 'eidolon']);
    for (const directory of directories) {
      const root = join(home, directory, 'depa-codument');
      expect(await readdir(root)).not.toContain('std');
      for (const asset of assets) expect(await readFile(join(root, asset.path), 'utf8')).toBe(asset.source);
      expect(await readFile(join(home, directory, 'codument/SKILL.md'), 'utf8')).toBe('protected old skill');
      await writeFile(join(root, 'retained-on-failure.md'), 'before failure');
    }
    const failingWorkspace = (root?: string) => {
      const port = workspace(root);
      return new Proxy(port, { get(target, key) {
        if (key === 'writeText' && root === '.agents/skills') return async () => { throw new Error('injected write failure'); };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    };
    await expect(applyGlobalInstall(resources, failingWorkspace, home, 'upgrade-global', 'claude,codex,eidolon')).rejects.toThrow('restored');
    for (const directory of directories) {
      expect(await readFile(join(home, directory, 'depa-codument/retained-on-failure.md'), 'utf8')).toBe('before failure');
      expect(await readFile(join(home, directory, 'codument/SKILL.md'), 'utf8')).toBe('protected old skill');
    }
    await expect(applyGlobalInstall(resources, workspace, home, 'upgrade-global', '../escape')).rejects.toThrow('Unsupported agent');
  } finally { await rm(home, { recursive: true, force: true }); }
});
