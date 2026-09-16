import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCodumentWorkspaceInstaller, createCodumentWorkspaceInstallDefinition, createCodumentWorkspaceGuidanceUpdater } from '../src/workspace-install';
import { CODUMENT_WORKSPACE_ASSETS } from '../src/workspace-assets';
import { createFileWorkspaceInstallPort } from 'depa-codument-domain-support';
import { installCodumentWorkspace, mergeWorkspaceAgents, refreshWorkspaceAgents, resolveWorkspaceInstallTargets } from 'depa-codument-domain-logic';
import { createCodumentWorkspaceInspector } from '../src/workspace-app';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS } from '../src/global-guidance';

const roots: string[] = [];
async function fixture() { const root = await fs.mkdtemp(join(await fs.realpath(tmpdir()), 'codument-install-')); roots.push(root); return root; }
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
const definition = () => createCodumentWorkspaceInstallDefinition({ agents: ['codex'] });
const inspect = (root: string) => createCodumentWorkspaceInspector(root).inspect();
const leftovers = async (root: string) => (await fs.readdir(root)).filter(p => p.startsWith('.codument-install'));

describe('formal workspace internal installer', () => {
  test('every initialized global profile reference resolves to a real canonical App file', () => {
    const assets = new Set(CODUMENT_GLOBAL_GUIDANCE_ASSETS.map(a=>a.path));
    const profiles = definition().appFiles.find(a=>a.path==='config/attractor-profiles.xnl')!.source;
    const refs = [...profiles.matchAll(/skill:\/\/depa-codument\/([^"\s]+)/g)].map(m=>m[1]!);
    expect(refs.length).toBeGreaterThan(3);
    for (const ref of refs) expect(assets.has(ref),ref).toBe(true);
    expect(profiles).not.toContain('std/skill/');
    for (const file of definition().appFiles) expect(file.source,file.path).not.toContain('references/skill://');
    expect(definition().appFiles.find(f=>f.path==='README.md')!.source).toBe(CODUMENT_WORKSPACE_ASSETS.find(f=>f.path==='codument/README.md')!.source);
  });
  test('guidance upgrade backs up exact legacy Skills, preserves surrounding rules and repeats without writes', async () => {
    const root = await fixture();
    await createCodumentWorkspaceInstaller(root).install({ agents: ['codex'] });
    const asset = CODUMENT_WORKSPACE_ASSETS.find(file => file.path === 'skills/codument-plan-track/SKILL.md')!;
    const file = join(root, '.agents', asset.path);
    await fs.mkdir(join(file, '..'), { recursive: true }); await fs.writeFile(file, asset.source);
    const original = '# User rules\n<!-- codument:begin -->\nOld local std\n<!-- codument:end -->\nKeep tail\n';
    await fs.writeFile(join(root, 'AGENTS.md'), original);
    const result = await createCodumentWorkspaceGuidanceUpdater(root).upgrade();
    expect(result.backupPath).toBeDefined();
    expect(await fs.exists(file)).toBe(false);
    expect(await fs.readFile(join(result.backupPath!, 'retired/.agents', asset.path), 'utf8')).toBe(asset.source);
    const agents = await fs.readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toStartWith('# User rules\n'); expect(agents).toEndWith('\nKeep tail\n');
    expect(agents).toContain('全局');
    const again = await createCodumentWorkspaceGuidanceUpdater(root).upgrade();
    expect(again.writtenFiles).toEqual([]); expect(again.backupPath).toBeUndefined();
    await fs.writeFile(file, 'independently modified skill');
    await expect(createCodumentWorkspaceGuidanceUpdater(root).upgrade()).rejects.toThrow('Modified legacy Skill');
    expect(await fs.readFile(file, 'utf8')).toBe('independently modified skill');
    expect(await fs.readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(agents);
  });

  test('retirement rename-then-throw restores original Skill and managed instructions', async () => {
    const root = await fixture(); await createCodumentWorkspaceInstaller(root).install({ agents: ['codex'] });
    const relative = '.agents/skills/old/SKILL.md', original = 'exact legacy source';
    await fs.mkdir(join(root, '.agents/skills/old'), { recursive: true }); await fs.writeFile(join(root, relative), original);
    const agents = await fs.readFile(join(root, 'AGENTS.md'), 'utf8');
    const files = createFileWorkspaceInstallPort(root, refreshWorkspaceAgents, resolveWorkspaceInstallTargets, { ...fs,
      rename: async (from, to) => {
        await fs.rename(from, to);
        if (String(from) === join(root, relative)) throw new Error('retirement interrupted after rename');
      },
    });
    await expect(installCodumentWorkspace({ files, inspect }, { ...definition(), retainRecovery: true,
      retiredSkillFiles: [{ path: 'old/SKILL.md', source: original }] })).rejects.toThrow();
    expect(await fs.readFile(join(root, relative), 'utf8')).toBe(original);
    expect(await fs.readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(agents);
    expect(await leftovers(root)).toEqual([]);
  });

  test('retains default Claude, all six agent targets, custom local destinations and stored selection', async () => {
    const root = await fixture(); const installer = createCodumentWorkspaceInstaller(root);
    await installer.install();
    expect(await fs.exists(join(root, '.claude/skills/codument-verify/SKILL.md'))).toBe(false);
    expect(await fs.exists(join(root, 'CLAUDE.md'))).toBe(true);
    expect(JSON.parse(await fs.readFile(join(root, 'codument/config/cli-tools.json'), 'utf8')).tools).toEqual(['claude']);
    await expect(installer.install({ agents: ['codex'] })).rejects.toThrow('reviewed migration');
    const multi = await fixture(); const agents = ['claude', 'codeflicker', 'eidolon', 'opencode', 'sparrow', 'codex'] as const;
    await createCodumentWorkspaceInstaller(multi).install({ agents });
    for (const directory of ['.claude', '.codeflicker', '.eidolon', '.opencode', '.sparrow', '.agents']) {
      expect(await fs.exists(join(multi, directory, 'skills/codument-verify/SKILL.md'))).toBe(false);
    }
    expect((await createCodumentWorkspaceInstaller(multi).install()).writtenFiles).toEqual([]);
    const custom = await fixture();
    await createCodumentWorkspaceInstaller(custom).install({ agents: ['codex'], skillsDirectory: 'tools/skills' });
    expect(await fs.exists(join(custom, 'tools/skills/codument-verify/SKILL.md'))).toBe(false);
    expect((await createCodumentWorkspaceInstaller(custom).install()).writtenFiles).toEqual([]);
    for (const skillsDirectory of ['../outside', '/absolute/skills', 'Codument/skills', '.codument/skills']) {
      await expect(createCodumentWorkspaceInstaller(await fixture()).install({ skillsDirectory })).rejects.toThrow();
    }
  });

  test('cooperative lock, ambiguous managed blocks and a missing required template fail before publication', async () => {
    const root = await fixture(); const files = createFileWorkspaceInstallPort(root, mergeWorkspaceAgents, resolveWorkspaceInstallTargets);
    const prepared = await files.prepare(definition());
    await expect(files.prepare(definition())).rejects.toThrow('locked');
    await prepared.abort(); await prepared.abort(); expect(await fs.readdir(root)).toEqual([]);
    await fs.writeFile(join(root, 'AGENTS.md'), '<!-- codument:begin -->\nbroken block');
    await expect(createCodumentWorkspaceInstaller(root).install()).rejects.toThrow('Ambiguous');
    expect(await leftovers(root)).toEqual([]); expect(await fs.exists(join(root, 'codument'))).toBe(false);
    const invalid = definition();
    await expect(installCodumentWorkspace({ files: createFileWorkspaceInstallPort(await fixture(), mergeWorkspaceAgents, resolveWorkspaceInstallTargets), inspect },
      { ...invalid, appFiles: invalid.appFiles.filter(file => file.path !== 'SKILL.md') })).rejects.toThrow('migration or review');
  });

  test('publishes validated codument App, builtin Kinds, thin routes and preserves user guidance; repeat does not refresh source', async () => {
    const root = await fixture();
    await fs.writeFile(join(root, 'AGENTS.md'), '# My existing rules\nDo not touch.\n');
    const installer = createCodumentWorkspaceInstaller(root);
    const first = await installer.install({ agents: ['codex'] });
    expect(first.createdApp).toBe(true); expect(first.inspection.ready).toBe(true);
    expect(first.inspection.appId).toBe('codument.workspace');
    const tree = await fs.readdir(join(root, 'codument'), { recursive: true });
    expect(tree.some(p => p.includes('KindDefinitions'))).toBe(false);
    expect(await fs.readFile(join(root, 'AGENTS.md'), 'utf8')).toStartWith('# My existing rules\nDo not touch.\n');
    expect(await fs.exists(join(root, '.agents/skills/codument-impl-track/SKILL.md'))).toBe(false);
    expect(await fs.exists(join(root, 'codument/std'))).toBe(false);
    expect(await fs.readFile(join(root, 'codument/SKILL.md'), 'utf8')).toContain('depa-codument');
    await fs.writeFile(join(root, 'codument/attractors/project.md'), 'User authored project attractor.\n');
    const second = await installer.install();
    expect(second.createdApp).toBe(false); expect(second.writtenFiles).toEqual([]);
    expect(await fs.readFile(join(root, 'codument/attractors/project.md'), 'utf8')).toBe('User authored project attractor.\n');
    await expect(installer.install({ appId: 'other.workspace' })).rejects.toThrow('identity requires reviewed migration');
    expect(await leftovers(root)).toEqual([]);
    expect((await fs.readdir(root)).includes('.codument')).toBe(false);
  });

  test('legacy App, unsafe paths and Skill conflicts do not overwrite or partially install', async () => {
    const legacy = await fixture(); await fs.mkdir(join(legacy, 'codument'));
    await fs.writeFile(join(legacy, 'codument/old.xml'), '<old/>');
    await expect(createCodumentWorkspaceInstaller(legacy).install()).rejects.toThrow('migration or review');
    expect(await fs.readdir(join(legacy, 'codument'))).toEqual(['old.xml']); expect(await leftovers(legacy)).toEqual([]);
    const conflict = await fixture(); await fs.mkdir(join(conflict, '.agents/skills/codument-impl-track'), { recursive: true });
    await fs.writeFile(join(conflict, '.agents/skills/codument-impl-track/SKILL.md'), 'custom skill');
    await createCodumentWorkspaceInstaller(conflict).install({ agents: ['codex'] });
    expect(await fs.readFile(join(conflict, '.agents/skills/codument-impl-track/SKILL.md'), 'utf8')).toBe('custom skill');
    expect(await fs.exists(join(conflict, 'codument'))).toBe(true); expect(await leftovers(conflict)).toEqual([]);
    const unsafe = await fixture(); const outside = await fixture(); await fs.symlink(outside, join(unsafe, '.agents'));
    // No local Skill writes remain, so this unrelated symlink is not traversed.
    await createCodumentWorkspaceInstaller(unsafe).install({ agents: ['codex'] });
    expect(await fs.readdir(outside)).toEqual([]); expect(await leftovers(unsafe)).toEqual([]);
  });

  test('validation failure and source drift roll back only owned staging', async () => {
    const root = await fixture(); const files = createFileWorkspaceInstallPort(root, mergeWorkspaceAgents, resolveWorkspaceInstallTargets);
    await expect(installCodumentWorkspace({ files, inspect: async () => ({ ready: false, memberFiles: [], ownedFiles: [], findings: [] }) }, definition())).rejects.toThrow('migration or review');
    expect(await fs.readdir(root)).toEqual([]);
    const prepared = await files.prepare(definition());
    await fs.writeFile(join(root, 'AGENTS.md'), 'concurrent source');
    await expect(prepared.commit()).rejects.toThrow('source drift'); await prepared.abort();
    expect(await fs.readFile(join(root, 'AGENTS.md'), 'utf8')).toBe('concurrent source');
    expect(await fs.readdir(root)).toEqual(['AGENTS.md']);
  });

  test('staging drift is never published and independently edited scratch is retained', async () => {
    const root = await fixture(); const files = createFileWorkspaceInstallPort(root, mergeWorkspaceAgents, resolveWorkspaceInstallTargets);
    const prepared = await files.prepare(definition());
    const source = join(prepared.validationRoot, 'codument/SKILL.md');
    await fs.writeFile(source, 'external scratch edit');
    await expect(prepared.commit()).rejects.toThrow('App content changed');
    await expect(prepared.abort()).rejects.toThrow('recovery material retained');
    expect(await fs.exists(join(root, 'codument'))).toBe(false);
    expect(await fs.readFile(source, 'utf8')).toBe('external scratch edit');
  });

  test('publication failure including rename-then-throw restores App and root AGENTS', async () => {
    for (const afterRename of [false, true]) {
      const root = await fixture(); const original = 'unmanaged original\n'; await fs.writeFile(join(root, 'AGENTS.md'), original);
      const files = createFileWorkspaceInstallPort(root, mergeWorkspaceAgents, resolveWorkspaceInstallTargets, { ...fs, rename: async (from, to) => {
        if (String(to) === join(root, 'AGENTS.md')) {
          if (afterRename) await fs.rename(from, to);
          throw new Error('injected publication failure');
        }
        return fs.rename(from, to);
      } });
      await expect(installCodumentWorkspace({ files, inspect }, definition())).rejects.toThrow();
      expect(await fs.readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(original);
      expect(await fs.exists(join(root, 'codument'))).toBe(false); expect(await leftovers(root)).toEqual([]);
    }
  });

  test('independent edits after publication are retained with recovery material', async () => {
    const root = await fixture(); let injected = false;
    const files = createFileWorkspaceInstallPort(root, mergeWorkspaceAgents, resolveWorkspaceInstallTargets, { ...fs, link: async (from, to) => {
      await fs.link(from, to);
      if (!injected) { injected = true; await fs.writeFile(join(root, 'codument/attractors/project.md'), 'independent edit'); throw new Error('interrupted'); }
    } });
    await expect(installCodumentWorkspace({ files, inspect }, definition())).rejects.toThrow('recovery material');
    expect(await fs.readFile(join(root, 'codument/attractors/project.md'), 'utf8')).toBe('independent edit');
    expect((await leftovers(root)).some(p => p !== '.codument-install.lock')).toBe(true);
    expect(await fs.exists(join(root, '.codument-install.lock'))).toBe(false);
  });
});
