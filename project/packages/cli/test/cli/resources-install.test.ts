import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  createEmbeddedResourceEffect,
  createSourceResourceEffect,
  normalizeResourcePath,
  walkResourceFiles,
} from '../../src/cli/effects/resource';
import { createWorkspaceEffect } from '../../src/cli/effects/workspace';
import { loadWebAsset } from '../../src/cli/http/static';
import { applyGlobalInstall } from '../../src/cli/global-install';
import {
  installWorkspaceTemplates,
  installSkillsForTargets,
  parseAgents,
  SKILLS_DIR_BY_AGENT,
  SUPPORTED_AGENTS,
} from '../../src/cli/install';
import { BIN } from '../../src/identity';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(label: string): string {
  const root = mkdtempSync(join(tmpdir(), label));
  roots.push(root);
  return root;
}

describe('template resources', () => {
  test('removes the retired workspace skill when refreshing workspace skills', async () => {
    const root = tempRoot('codument-retired-skill-');
    const resources = createSourceResourceEffect(resolve(import.meta.dir, '..', '..', 'src', 'templates'));
    const skillsDir = join(root, '.agents', 'skills');
    const retired = join(skillsDir, `${BIN}-workspace`);
    mkdirSync(retired, { recursive: true });
    writeFileSync(join(retired, 'SKILL.md'), 'obsolete\n');

    await installSkillsForTargets(resources, (directory) => createWorkspaceEffect(join(root, directory ?? '.')), [{
      agent: 'codex',
      skillsDir: '.agents/skills',
    }]);

    expect(existsSync(retired)).toBe(false);
    expect(readFileSync(join(skillsDir, 'codument-demo', 'SKILL.md'), 'utf8')).toContain('codument');
  });

  test('source resources expose agents, private, and web roots', async () => {
    const resources = createSourceResourceEffect(resolve(import.meta.dir, '..', '..', 'src', 'templates'));
    const paths = (await walkResourceFiles(resources)).map(({ path }) => path);
    expect(paths).toContain('agents/global/skills/codument/SKILL.md');
    expect(paths).toContain('agents/workspace/skills/codument-demo/SKILL.md');
    expect(paths).toContain('agents/workspace/skills/codument-demo/modules/owid-open-data-export/pages/open-data-export/index.html');
    expect(paths).toContain('agents/workspace/skills/codument-demo/manifest.xnl');
    expect(paths).toContain('agents/workspace/skills/codument-demo/modules/owid-open-data-export/pages/open-data-export/manifest.xnl');
    expect(paths).toContain('agents/workspace/skills/codument-demo/LocalFunction/manifest.xnl');
    expect(paths).toContain('agents/workspace/skills/codument-demo/modules/google-search/manifest.xnl');
    expect(paths).toContain('agents/workspace/skills/codument-demo/modules/google-search/host/manifest.xnl');
    expect(paths).toContain('agents/workspace/skills/codument-demo/modules/google-search/host/entry.ts');
    expect(paths).toContain('agents/workspace/skills/codument-demo/KindDefinitions/SkillModule/manifest.xnl');
    expect(paths).toContain('agents/workspace/skills/codument-demo/KindDefinitions/HostBundle/manifest.xnl');
    expect(paths).toContain('agents/workspace/skills/codument-demo/KindDefinitions/PageWorkflowBundle/manifest.xnl');
    expect(paths).toContain('agents/workspace/skills/codument-demo/KindDefinitions/PageObjectBundle/manifest.xnl');
    expect(paths.some((resourcePath) => resourcePath.endsWith('/page.json'))).toBe(false);
    expect(paths.some((resourcePath) => resourcePath.includes('/page-automation/'))).toBe(false);
    expect(paths).toContain('agents/workspace/skills/codument-demo/modules/owid-open-data-export/sops/codument-demo--sop--owid-open-data-export.md');
    expect(paths).toContain('agents/global/skills/codument/references/freeform-sop.md');
    expect(paths).toContain('agents/global/skills/codument/references/typed-leaf-sop.md');
    expect(paths).toContain('agents/global/skills/codument/references/typed-pipeline-sop.md');
    expect(paths).toContain('private/workspace/README.md');
    expect(paths).toContain('private/workspace/workflows/.gitignore');
    expect(paths).toContain('web/index.html');
  });

  test('embedded resources use the same normalized tree', async () => {
    const skill = new File(['demo'], 'resource/agents/workspace/skills/codument-demo/SKILL.md');
    const binary = new File([new Uint8Array([0, 1, 2])], 'resource/web/image.bin');
    const ignore = new File(['*\n!.gitignore\n'], 'resource/private/workspace/workflows/.gitignore.');
    const resources = createEmbeddedResourceEffect([skill, binary, ignore]);
    expect(await resources.readText('agents/workspace/skills/codument-demo/SKILL.md')).toBe('demo');
    expect([...await resources.readBytes('web/image.bin') ?? []]).toEqual([0, 1, 2]);
    expect(await resources.readText('private/workspace/workflows/.gitignore')).toBe('*\n!.gitignore\n');
  });

  test('rejects unsafe paths and serves embedded web assets', async () => {
    expect(() => normalizeResourcePath('../package.json')).toThrow('invalid resource path');
    const index = new File(['<h1>embedded</h1>'], 'resource/web/demo/index.html');
    const resources = createEmbeddedResourceEffect([index]);
    expect(new TextDecoder().decode((await loadWebAsset(resources, '/demo/'))?.body)).toContain('embedded');
    expect((await loadWebAsset(resources, '/demo/'))?.contentType).toContain('text/html');
    expect(await loadWebAsset(resources, '/../package.json')).toBeUndefined();
  });

  test('installs and upgrades the workflows ignore marker without touching run Notebooks', async () => {
    const root = tempRoot('codument-workflow-store-');
    const resources = createSourceResourceEffect(resolve(import.meta.dir, '..', '..', 'src', 'templates'));
    const workspace = createWorkspaceEffect(root);
    await installWorkspaceTemplates(resources, workspace, true);
    const ignore = join(root, '.codument', 'workflows', '.gitignore');
    expect(readFileSync(ignore, 'utf8')).toBe('*\n!.gitignore\n');
    const notebook = join(root, '.codument', 'workflows', 'Test.SOP.Pipeline.md');
    writeFileSync(notebook, 'agent state\n');
    await installWorkspaceTemplates(resources, workspace, true);
    expect(readFileSync(ignore, 'utf8')).toBe('*\n!.gitignore\n');
    expect(readFileSync(notebook, 'utf8')).toBe('agent state\n');
  });
});

describe('global installation without MCP mutation', () => {
  test('limits coding-agent skill targets to the maintained tool set', () => {
    expect(SUPPORTED_AGENTS).toEqual(['eidolon', 'opencode', 'codex']);
    expect(Object.keys(SKILLS_DIR_BY_AGENT)).toEqual(['eidolon', 'opencode', 'codex']);
    expect(parseAgents('unsupported')).toEqual(['codex']);
  });

  test('installs the Codex host skill and leaves Codex config byte-identical', async () => {
    const home = tempRoot('codument-home-');
    const codexConfig = join(home, '.codex', 'config.toml');
    mkdirSync(join(home, '.codex'), { recursive: true });
    writeFileSync(codexConfig, '[mcp_servers.keep]\ncommand="keep"\n');
    const beforeCodex = readFileSync(codexConfig, 'utf8');
    const resources = createSourceResourceEffect(resolve(import.meta.dir, '..', '..', 'src', 'templates'));

    const receipt = await applyGlobalInstall(
      resources,
      (root) => createWorkspaceEffect(join(home, root ?? '.')),
      home,
      'init-global',
    );

    expect(receipt.skills.map(({ agent }) => agent)).toEqual(['codex']);
    expect(readFileSync(codexConfig, 'utf8')).toBe(beforeCodex);
    const installedSkill = join(home, '.agents', 'skills', 'depa-codument');
    expect(readFileSync(join(installedSkill, 'SKILL.md'), 'utf8')).toContain('name: depa-codument');
    expect(readFileSync(join(installedSkill, 'operations/plan-track.md'), 'utf8')).toContain('kind: CommandOperation');
    for (const reference of ['freeform-sop.md', 'typed-leaf-sop.md', 'typed-pipeline-sop.md']) {
      expect(readFileSync(join(installedSkill, 'references/host/references', reference), 'utf8')).toContain('SOP');
    }
  });
});
