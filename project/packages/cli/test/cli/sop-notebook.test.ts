import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { commandPaths, dispatchCommand } from '../../src/cli/command-registry';
import { createCommandRuntime } from '../../src/cli/runtime';
import { createSopNotebookStore, renderSopNotebook } from '../../src/cli/sop/notebook-store';
import { writeSkillApp, writeSop } from '../fixtures/xnl-skill-app';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const FQN = 'Test.SOP.Pipeline';
const roots: string[] = [];

afterEach(async () => {
  process.exitCode = 0;
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function root(label = 'ai-cli-sop-notebook-'): Promise<string> {
  const value = await fs.mkdtemp(path.join(os.tmpdir(), label));
  roots.push(value);
  return value;
}

function binding(fqn = FQN) {
  return {
    sopFqn: fqn,
    contentDigest: DIGEST,
    procedureFormat: 'markdown-step-graph/v1' as const,
  };
}

function notebookPath(workspace: string, fqn = FQN): string {
  return path.join(workspace, '.codument/workflows', `${fqn}.md`);
}

function pipeline(): string {
  return [
    '<input_contract>', 'Input.', '</input_contract>',
    '<preconditions>', 'Ready.', '</preconditions>',
    '<procedure format="markdown-step-graph/v1">',
    '## Entry', '`run`',
    '## Step `run`',
    '### SOP', '`Test.SOP.Child`',
    '### Enter when', 'Ready.',
    '### Input mapping', 'Input.',
    '### Success', 'Receipt.',
    '### Failure', 'Stop.',
    '### End `success`', 'Return receipt.',
    '</procedure>',
    '<effects>', 'Child owned.', '</effects>',
    '<output_contract>', 'Receipt.', '</output_contract>',
    '<success_criteria>', 'Verified.', '</success_criteria>',
  ].join('\n');
}

async function installPipeline(workspace: string, skillId = 'demo', fqn = FQN, profile = 'typed-pipeline'): Promise<void> {
  const skill = path.join(workspace, '.agents/skills', skillId);
  await writeSkillApp(skill, skillId);
  await writeSop(skill, 'Test.SOP.Child', 'child.md', '# Child');
  await writeSop(skill, fqn, 'pipeline.md', profile === 'typed-pipeline' ? pipeline() : '# Freeform', profile);
}

describe('sparse SOP Notebook materialization', () => {
  test('renders only revision binding and occurred-state sections', () => {
    const markdown = renderSopNotebook(binding());
    expect(markdown).toContain('format: sop-run-notebook/v1');
    expect(markdown).toContain(`sopFqn: ${FQN}`);
    expect(markdown).toContain(`sopContentDigest: ${DIGEST}`);
    expect(markdown).toContain('procedureFormat: markdown-step-graph/v1');
    expect(markdown).toContain('status: not_started');
    expect(markdown).toContain('## Visits');
    expect(markdown).toContain('## Blockers');
    expect(markdown).toContain('## Journal');
    expect(markdown).not.toMatch(/## Step|Route|Entry|future|next step/i);
  });

  test('creates, preserves an existing file byte-for-byte, and resets by replacement only when explicit', async () => {
    const workspace = await root();
    const store = createSopNotebookStore(workspace);
    const created = await store.materialize(binding());
    expect(created).toEqual({
      action: 'created',
      notebookPath: `.codument/workflows/${FQN}.md`,
      sopFqn: FQN,
      contentDigest: DIGEST,
      procedureFormat: 'markdown-step-graph/v1',
    });
    const target = notebookPath(workspace);
    expect(await fs.readFile(target, 'utf8')).toBe(renderSopNotebook(binding()));

    const custom = '# Agent-owned occurred state\n';
    await fs.writeFile(target, custom);
    const before = await fs.lstat(target);
    const existing = await store.materialize(binding());
    const after = await fs.lstat(target);
    expect(existing.action).toBe('existing');
    expect(await fs.readFile(target, 'utf8')).toBe(custom);
    expect({ ino: after.ino, mtimeMs: after.mtimeMs, size: after.size, mode: after.mode })
      .toEqual({ ino: before.ino, mtimeMs: before.mtimeMs, size: before.size, mode: before.mode });

    const reset = await store.materialize(binding(), { reset: true });
    const replaced = await fs.lstat(target);
    expect(reset.action).toBe('reset');
    expect(await fs.readFile(target, 'utf8')).toBe(renderSopNotebook(binding()));
    expect(replaced.ino).not.toBe(before.ino);
    expect((await fs.readdir(path.dirname(target))).sort()).toEqual([`${FQN}.md`]);
  });

  test.each([
    ['path traversal', '../escape.SOP.Run'],
    ['slash', 'Test.SOP.Bad/Name'],
    ['backslash', 'Test.SOP.Bad\\Name'],
    ['removed Kind segment', 'Test.ApplicationSOP.Run'],
    ['removed Kind segment alongside canonical SOP', 'Test.SOP.ApplicationSOP.Run'],
    ['Windows reserved segment', 'Test.SOP.CON'],
    ['overlong filename', `Test.SOP.${'a'.repeat(240)}`],
  ])('rejects %s before creating a workflows file', async (_name, fqn) => {
    const workspace = await root();
    await expect(createSopNotebookStore(workspace).materialize(binding(fqn))).rejects.toThrow();
    expect(await fs.lstat(path.join(workspace, '.codument/workflows')).catch(() => undefined)).toBeUndefined();
  });

  test('rejects a portable case-fold collision instead of creating a second spelling', async () => {
    const workspace = await root();
    const workflows = path.dirname(notebookPath(workspace));
    await fs.mkdir(workflows, { recursive: true });
    await fs.writeFile(path.join(workflows, 'test.sop.pipeline.md'), 'other case');
    await expect(createSopNotebookStore(workspace).materialize(binding())).rejects.toThrow('case-fold collision');
    expect((await fs.readdir(workflows)).sort()).toEqual(['test.sop.pipeline.md']);
  });

  test('rejects workspace, private-root, workflows and leaf symlinks without touching outside data', async () => {
    const outside = await root('ai-cli-sop-notebook-outside-');
    const outsideFile = path.join(outside, 'outside.md');
    await fs.writeFile(outsideFile, 'outside-authority');

    const realWorkspace = await root();
    const linkedWorkspace = `${realWorkspace}-link`;
    roots.push(linkedWorkspace);
    await fs.symlink(realWorkspace, linkedWorkspace);
    await expect(createSopNotebookStore(linkedWorkspace).materialize(binding())).rejects.toThrow('symlink');

    const privateWorkspace = await root();
    await fs.symlink(outside, path.join(privateWorkspace, '.codument'));
    await expect(createSopNotebookStore(privateWorkspace).materialize(binding())).rejects.toThrow('symlink');

    const workflowsWorkspace = await root();
    await fs.mkdir(path.join(workflowsWorkspace, '.codument'));
    await fs.symlink(outside, path.join(workflowsWorkspace, '.codument/workflows'));
    await expect(createSopNotebookStore(workflowsWorkspace).materialize(binding())).rejects.toThrow('symlink');

    const leafWorkspace = await root();
    await fs.mkdir(path.dirname(notebookPath(leafWorkspace)), { recursive: true });
    await fs.symlink(outsideFile, notebookPath(leafWorkspace));
    const leafStore = createSopNotebookStore(leafWorkspace);
    await expect(leafStore.materialize(binding())).rejects.toThrow('symlink');
    await expect(leafStore.materialize(binding(), { reset: true })).rejects.toThrow('symlink');
    expect(await fs.readFile(outsideFile, 'utf8')).toBe('outside-authority');
  });
});

describe('SOP notebook init command contract', () => {
  test('publishes the nested canonical command and stable created/existing/reset receipts', async () => {
    expect(commandPaths()).toContainEqual(['SOP', 'notebook', 'init']);
    const workspace = await root();
    await installPipeline(workspace);
    const runtime = createCommandRuntime(workspace);
    const created = await dispatchCommand(['SOP', 'notebook', 'init', '--fqn', FQN], runtime, true);
    const existing = await dispatchCommand(['SOP', 'notebook', 'init', '--fqn', FQN], runtime, true);
    const reset = await dispatchCommand(['SOP', 'notebook', 'init', '--fqn', FQN, '--reset'], runtime, true);
    expect(created).toMatchObject({ code: 0, data: { action: 'created', sopFqn: FQN } });
    expect(existing).toMatchObject({ code: 0, data: { action: 'existing', sopFqn: FQN } });
    expect(reset).toMatchObject({ code: 0, data: { action: 'reset', sopFqn: FQN } });
  });

  test('does not write for a non-pipeline or duplicate SOP authority', async () => {
    const freeform = await root();
    await installPipeline(freeform, 'demo', 'Test.SOP.Freeform', 'freeform');
    const rejected = await dispatchCommand(
      ['SOP', 'notebook', 'init', '--fqn', 'Test.SOP.Freeform'],
      createCommandRuntime(freeform),
      true,
    );
    expect(rejected.code).toBe(1);
    expect(await fs.lstat(path.join(freeform, '.codument/workflows')).catch(() => undefined)).toBeUndefined();

    const duplicate = await root();
    await installPipeline(duplicate, 'alpha');
    await installPipeline(duplicate, 'beta');
    const duplicateResult = await dispatchCommand(
      ['SOP', 'notebook', 'init', '--fqn', FQN],
      createCommandRuntime(duplicate),
      true,
    );
    expect(duplicateResult.code).toBe(1);
    expect(await fs.lstat(path.join(duplicate, '.codument/workflows')).catch(() => undefined)).toBeUndefined();
  });

  test('fails closed without the composed SOP runtime instead of rebuilding cross-workspace ports', async () => {
    const authorityWorkspace = await root();
    const unrelatedWorkspace = await root();
    await installPipeline(authorityWorkspace);
    const runtime = createCommandRuntime(authorityWorkspace);
    const unrelatedRuntime = createCommandRuntime(unrelatedWorkspace);
    delete runtime.sop;
    runtime.workspace = unrelatedRuntime.workspace;

    const result = await dispatchCommand(['SOP', 'notebook', 'init', '--fqn', FQN], runtime, true);
    expect(result).toMatchObject({ code: 1, message: 'SOP runtime is not configured' });
    expect(await fs.lstat(path.dirname(notebookPath(authorityWorkspace))).catch(() => undefined)).toBeUndefined();
    expect(await fs.lstat(path.dirname(notebookPath(unrelatedWorkspace))).catch(() => undefined)).toBeUndefined();
  });
});
