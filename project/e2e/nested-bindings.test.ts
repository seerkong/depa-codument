import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { verifyNestedBindings } from './nested-verifier';
import type { Run } from './runtime';

test('planning and acceptance binding admission identifies the failing repo before HTTP', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nested-binding-admission-'));
  const workspace = path.join(root, 'workspace');
  const run = { root, workspace, env: process.env } as Run;
  try {
    fs.mkdirSync(path.join(root, 'logs'));
    for (const name of ['main-repo', 'inventory-repo']) {
      const repo = path.join(workspace, name);
      fs.mkdirSync(path.join(repo, 'codument/.local'), { recursive: true });
      execFileSync('git', ['init', '-q', repo]);
      fs.writeFileSync(path.join(repo, 'codument/.local/workspace-bindings.xnl'), '<WorkspaceBindings []>');
    }
    await expect(verifyNestedBindings(run, 'plan-0')).rejects.toThrow(/main-repo.*git check-ignore.*workspace-bindings.xnl.*HTTP servers have not been started/s);
    fs.writeFileSync(path.join(workspace, 'main-repo/codument/.local/.gitignore'), '*\n!.gitignore\n');
    await expect(verifyNestedBindings(run, 'plan-1')).rejects.toThrow(/inventory-repo.*git check-ignore/s);
    fs.writeFileSync(path.join(workspace, 'inventory-repo/codument/.local/.gitignore'), '*\n!.gitignore\n');
    await verifyNestedBindings(run, 'plan-2');
    await verifyNestedBindings(run, 'nested-0');
    expect(fs.readdirSync(path.join(root, 'logs')).every(name => name.endsWith('-ignored.log'))).toBe(true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
