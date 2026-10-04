import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { parse } from 'yaml';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS as assets, createCodumentGuidanceOperations, createGlobalGuidanceResourceEffect, GLOBAL_APP_ROOT } from '../src/global-guidance';

const legacySkillName = /(?<![A-Za-z0-9_-])codument-[a-z][a-z0-9-]*/;

function documentParts(source: string): { metadata: Record<string, unknown>; body: string } {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!frontmatter) return { metadata: {}, body: source };
  return { metadata: parse(frontmatter[1]!) ?? {}, body: source.slice(frontmatter[0].length) };
}

function currentGuidanceIssues(asset: { path: string; source: string }): string[] {
  const { metadata, body } = documentParts(asset.source);
  const guidance = asset.path === 'SKILL.md' ? body : asset.source;
  const issues: string[] = [];
  if (asset.path !== 'SKILL.md' && Object.hasOwn(metadata, 'name')) issues.push('standalone Skill frontmatter');
  if (/^#\s+skill\s*:/im.test(guidance)) issues.push('standalone Skill heading');
  if (asset.path.startsWith('references/std/compat/')) return issues;
  if (legacySkillName.test(guidance)) issues.push('old Skill name in current guidance');
  if (/references\/std\/(?:operations|commands|skill)\//.test(guidance)
    || /(?<![A-Za-z0-9_/.-])std\/(?:methods|operations|protocols|spec|attractors)\//.test(guidance)
    || guidance.includes('@/codument/std/')) issues.push('retired standard path');
  if (/\bdepa-codument\s+[a-z][a-z0-9-]*`?\s+skill\b/i.test(guidance)) issues.push('CLI command described as a separate Skill');
  return issues;
}

test('complete App has closed document links and no retired layout', () => {
  const paths = new Set(assets.map(asset => asset.path));
  for (const asset of assets) {
    let directory = posix.dirname(asset.path);
    while (directory !== '.') {
      paths.add(directory);
      directory = posix.dirname(directory);
    }
  }
  expect(paths.has('references/std/compat/operation-alias.md')).toBe(true);
  for (const asset of assets) {
    expect(asset.path).not.toMatch(/^std\/|kernel-pointer|\/commands\/|\/skill\/|\/std\/operations\//);
    for (const match of asset.source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1]!.split('#')[0]!;
      if (!target || /[:< ]/.test(target)) continue;
      const resolved = posix.normalize(posix.join(posix.dirname(asset.path), target)).replace(/\/$/, '');
      expect(paths.has(resolved), `${asset.path}: ${target}`).toBe(true);
    }
  }
});

test('old Skill names are confined to discovery metadata and compatibility references', () => {
  for (const asset of assets.filter(asset => asset.path.endsWith('.md'))) {
    expect(currentGuidanceIssues(asset), asset.path).toEqual([]);
  }
});

test('guidance guard rejects old calls, retired paths and independent operation Skills', () => {
  const skill = assets.find(asset => asset.path === 'SKILL.md')!;
  const operation = assets.find(asset => asset.path === 'operations/discuss.md')!;
  const invalid = [
    { ...skill, source: `${skill.source}\n调用 codument-plan-track skill。` },
    { ...operation, source: `${operation.source}\n调用 codument-impl-track skill。` },
    { path: 'references/authoring.md', source: '正文在 `references/std/operations/discuss.md`。' },
    { path: 'references/authoring.md', source: '读取 `std/methods/workflow.md`。' },
    { path: 'references/authoring.md', source: '读取 `@/codument/std/AGENTS.md`。' },
    { path: 'references/authoring.md', source: '---\nname: update-sop\n---\n# Update SOP' },
    { path: 'references/std/compat/history.md', source: '---\nname: update-sop\n---\n# Update SOP' },
    { path: 'operations/discuss.md', source: '# skill: discuss' },
    { path: 'operations/discuss.md', source: '请使用 `depa-codument discuss` skill。' },
  ];
  for (const asset of invalid) {
    expect(currentGuidanceIssues(asset).length, asset.source).toBeGreaterThan(0);
  }
  expect(currentGuidanceIssues(skill)).toEqual([]);
  expect(currentGuidanceIssues({ path: 'references/std/compat/history.md', source: 'codument-impl-track used codument/std/operations/' })).toEqual([]);
});

test('historical aliases resolve to resource-owned commands without defining a second command registry', async () => {
  const aliasSource = assets.find(asset => asset.path === 'references/std/compat/operation-alias.md')!.source;
  const aliases = [...aliasSource.matchAll(/^\|\s*(codument-[a-z0-9-]+)\s*\|\s*([a-z0-9-]+)\s*\|$/gm)]
    .map(match => ({ legacySkill: match[1]!, command: match[2]! }));
  const oldNames = aliases.map(alias => alias.legacySkill);
  const skill = assets.find(asset => asset.path === 'SKILL.md')!;
  const { metadata } = documentParts(skill.source);
  expect(typeof metadata.description).toBe('string');
  const discoveredNames = [...String(metadata.description).matchAll(new RegExp(legacySkillName.source, 'g'))].map(match => match[0]);
  expect(aliases.length).toBeGreaterThan(0);
  expect(new Set(oldNames).size).toBe(oldNames.length);
  expect(discoveredNames.sort()).toEqual(oldNames.sort());

  const operations = await createCodumentGuidanceOperations();
  const commands = new Set(operations.map(operation => operation.command));
  for (const alias of aliases) expect(commands.has(alias.command), alias.legacySkill).toBe(true);
  for (const operation of operations) {
    expect(/^#\s+([a-z][a-z0-9-]*)\b/m.exec(operation.markdown)?.[1], operation.command).toBe(operation.command);
  }
});

test('fixed root loads actual resource metadata, ignores other Apps and fails closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'depa-fixed-app-'));
  try {
    const resources = createGlobalGuidanceResourceEffect(root);
    await expect(createCodumentGuidanceOperations(resources)).rejects.toThrow('manifest is missing');
    for (const asset of assets) {
      const file = join(root, GLOBAL_APP_ROOT, asset.path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, asset.path === 'operations/discuss.md' ? asset.source.replace('command: discuss', 'command: discuss-renamed') : asset.source);
    }
    await mkdir(join(root, 'unrelated'), { recursive: true });
    await writeFile(join(root, 'unrelated/manifest.xnl'), 'malformed unrelated App');
    const operations = await createCodumentGuidanceOperations(resources);
    expect(operations.some(operation => operation.command === 'discuss-renamed')).toBe(true);
    expect(operations.some(operation => operation.command === 'discuss')).toBe(false);
    await writeFile(join(root, GLOBAL_APP_ROOT, 'manifest.xnl'), 'broken');
    await expect(createCodumentGuidanceOperations(resources)).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});
