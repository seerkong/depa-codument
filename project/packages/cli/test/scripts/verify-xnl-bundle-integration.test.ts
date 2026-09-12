import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  assertCleanCloneSurface,
  integrationCommandPlan,
  legacyAuthorityPaths,
  verificationBinaryName,
} from '../../../../scripts/verify-xnl-bundle-integration';

describe('XNL Bundle integration verifier', () => {
  test('freezes the clean clone, fresh registry install, full check and three-platform release plan', () => {
    const plan = integrationCommandPlan('/source', '/clone');
    expect(plan.map((step) => step.name)).toEqual([
      'clone', 'fresh-install', 'clone-check', 'three-platform-build', 'release-check',
    ]);
    expect(plan[0].command).toContain('/source/scripts/clone.ts');
    expect(plan[0].command).toContain('source-only');
    expect(plan[0].command).not.toContain('--bin');
    expect(plan.slice(1).map((step) => step.command.slice(-1)[0])).toEqual([
      'install', 'check', 'build:release', 'check:release',
    ]);
    expect(verificationBinaryName('darwin')).toBe('depa-codument');
    expect(verificationBinaryName('win32')).toBe('depa-codument.exe');
  });

  test('rejects legacy authority paths and local state while retaining source identity', () => {
    const root = mkdtempSync(join(tmpdir(), 'xnl-verifier-test-'));
    const templates = resolve(root, 'packages/cli/src/templates');
    try {
      mkdirSync(resolve(templates, 'agents/workspace/skills/demo/pages/hello'), { recursive: true });
      mkdirSync(resolve(root, 'packages/cli/src/cli'), { recursive: true });
      writeFileSync(resolve(root, 'packages/cli/src/identity.ts'), 'export const BIN = "example";\n');
      writeFileSync(resolve(root, 'packages/cli/src/cli/command-registry.ts'), 'export const commands = ["Resource"];\n');
      writeFileSync(resolve(templates, 'agents/workspace/skills/demo/manifest.xnl'), '<SkillApp #Example.App>\n');
      expect(legacyAuthorityPaths(root)).toEqual([]);
      expect(() => assertCleanCloneSurface(root)).not.toThrow();

      writeFileSync(resolve(templates, 'agents/workspace/skills/demo/pages/hello/page.json'), '{}\n');
      expect(legacyAuthorityPaths(root)).toEqual(['agents/workspace/skills/demo/pages/hello/page.json']);
      expect(() => assertCleanCloneSurface(root)).toThrow('legacy resource authorities');
      rmSync(resolve(templates, 'agents/workspace/skills/demo/pages/hello/page.json'));

      mkdirSync(resolve(templates, 'agents/workspace/skills/demo/ApplicationSOP'), { recursive: true });
      writeFileSync(resolve(templates, 'agents/workspace/skills/demo/ApplicationSOP/legacy.md'), '# legacy\n');
      expect(legacyAuthorityPaths(root)).toEqual(['agents/workspace/skills/demo/ApplicationSOP/legacy.md']);
      expect(() => assertCleanCloneSurface(root)).toThrow('legacy resource authorities');
      rmSync(resolve(templates, 'agents/workspace/skills/demo/ApplicationSOP'), { recursive: true, force: true });

      writeFileSync(resolve(templates, 'agents/workspace/skills/demo/manifest.xnl'), '<SkillApp #Codument.Demo.App>\n');
      expect(() => assertCleanCloneSurface(root)).not.toThrow();
      mkdirSync(resolve(root, '.agents'));
      expect(() => assertCleanCloneSurface(root)).toThrow('local workspace state');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
