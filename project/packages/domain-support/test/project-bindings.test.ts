import { expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { applyWorkspaceBinding } from 'depa-codument-domain-logic';
import { WORKSPACE_BINDINGS_PATH } from 'depa-codument-domain-contract';
import { createFileWorkspaceBindingRuntime } from '../src/config';

async function fixture(git = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'binding-privacy-'));
  if (git) execFileSync('git', ['init', '-q', root]);
  return { root, runtime: createFileWorkspaceBindingRuntime(root),
    bind: { operation: 'bind' as const, projectRef: 'library', workspacePath: '../library' },
    cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}

test('bindings remain read-only; bind creates an idempotent local ignore without touching root policy', async () => {
  const f = await fixture();
  try {
    await fs.writeFile(path.join(f.root, '.gitignore'), '# user owned\r\nnode_modules/\r\n');
    await applyWorkspaceBinding(f.runtime, { operation: 'bindings' });
    expect(await fs.readdir(f.root)).not.toContain('codument');
    await applyWorkspaceBinding(f.runtime, f.bind);
    execFileSync('git', ['check-ignore', '-q', '--', WORKSPACE_BINDINGS_PATH], { cwd: f.root });
    const ignore = path.join(f.root, 'codument/.local/.gitignore');
    const before = await fs.stat(ignore);
    await applyWorkspaceBinding(f.runtime, f.bind);
    expect((await fs.stat(ignore)).mtimeMs).toBe(before.mtimeMs);
    expect(await fs.readFile(ignore, 'utf8')).toBe('*\n!.gitignore\n');
    expect(await fs.readFile(path.join(f.root, '.gitignore'), 'utf8')).toBe('# user owned\r\nnode_modules/\r\n');
  } finally { await f.cleanup(); }
});

test('non-Git workspace gets a future ignore rule, while invalid input writes nothing', async () => {
  const f = await fixture(false);
  try {
    await expect(applyWorkspaceBinding(f.runtime, { ...f.bind, projectRef: '' })).rejects.toThrow('nonempty');
    expect(await fs.readdir(f.root)).toEqual([]);
    await applyWorkspaceBinding(f.runtime, f.bind);
    execFileSync('git', ['init', '-q', f.root]);
    execFileSync('git', ['check-ignore', '-q', '--', WORKSPACE_BINDINGS_PATH], { cwd: f.root });
  } finally { await f.cleanup(); }
});

test('conflicting user ignore and tracked bindings are rejected without publishing or untracking', async () => {
  const f = await fixture();
  try {
    const local = path.join(f.root, 'codument/.local');
    await fs.mkdir(local, { recursive: true });
    const ignore = path.join(local, '.gitignore');
    await fs.writeFile(ignore, '# custom policy\n!workspace-bindings.xnl\n');
    await expect(applyWorkspaceBinding(f.runtime, f.bind)).rejects.toThrow('privacy failed');
    expect(await fs.readdir(local)).toEqual(['.gitignore']);
    expect(await fs.readFile(ignore, 'utf8')).toBe('# custom policy\n!workspace-bindings.xnl\n');
    await fs.writeFile(ignore, '*\n!.gitignore\n');
    const binding = path.join(f.root, WORKSPACE_BINDINGS_PATH);
    await fs.writeFile(binding, '<WorkspaceBindings []>\n');
    execFileSync('git', ['add', '-f', '--', WORKSPACE_BINDINGS_PATH], { cwd: f.root });
    await expect(applyWorkspaceBinding(f.runtime, f.bind)).rejects.toThrow('already tracked');
    expect(await fs.readFile(binding, 'utf8')).toBe('<WorkspaceBindings []>\n');
    expect(execFileSync('git', ['ls-files', '--', WORKSPACE_BINDINGS_PATH], { cwd: f.root, encoding: 'utf8' }).trim()).toBe(WORKSPACE_BINDINGS_PATH);
  } finally { await f.cleanup(); }
});

test('local ignore symlinks cannot mutate outside state or publish bindings', async () => {
  const f = await fixture();
  try {
    const local = path.join(f.root, 'codument/.local');
    await fs.mkdir(local, { recursive: true });
    const target = path.join(f.root, 'user-policy');
    await fs.writeFile(target, 'keep');
    await fs.symlink(target, path.join(local, '.gitignore'));
    await expect(applyWorkspaceBinding(f.runtime, f.bind)).rejects.toThrow();
    expect(await fs.readFile(target, 'utf8')).toBe('keep');
    expect(await fs.readdir(local)).toEqual(['.gitignore']);
  } finally { await f.cleanup(); }
});
