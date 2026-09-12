import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { WORKSPACE_BINDINGS_PATH, type WorkspaceBindingRuntime } from 'depa-codument-domain-contract';
import { createFileDomainSourceWritePort } from './decision-write';

/** Read only the formal config authority, with the workspace port's symlink checks. */
export async function readAttractorProfilesSource(workspaceRoot: string): Promise<string | undefined> {
  const workspace = createWorkspaceEffect(workspaceRoot);
  if (await workspace.kind('codument/config/attractor-profiles.xml') !== undefined) {
    throw new Error('Legacy Attractor profiles require migration or review before normal admission.');
  }
  return workspace.readText('codument/config/attractor-profiles.xnl');
}

export function readLocalWorkspaceBindingsSource(workspaceRoot: string): Promise<string | undefined> {
  return createWorkspaceEffect(workspaceRoot).readText(WORKSPACE_BINDINGS_PATH);
}

export function createFileWorkspaceBindingRuntime(workspaceRoot: string): WorkspaceBindingRuntime {
  const root = path.resolve(workspaceRoot);
  return {
    source: createFileDomainSourceWritePort(root),
    paths: { resolve: input => path.resolve(root, input) },
    privacy: { ensureIgnored: () => ensureLocalBindingsIgnored(root) },
  };
}

/** Protect the machine-local authority before publishing paths. Existing ignore
 * policy and tracked files remain user-owned; never untrack them implicitly. */
async function ensureLocalBindingsIgnored(root: string): Promise<void> {
  const workspace = createWorkspaceEffect(root);
  const ignore = 'codument/.local/.gitignore';
  await workspace.makeDirectory('codument/.local');
  if (await workspace.kind(ignore) === undefined) {
    try { await fs.writeFile(path.join(root, ignore), '*\n!.gitignore\n', { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  // Recheck the public workspace boundary, including an existing/racing symlink.
  if (await workspace.kind(ignore) !== 'file') throw new Error('Local binding ignore policy must be a regular file.');
  const observed = await new Promise<{code: number | string; stderr: string}>(resolve => {
    execFile('git', ['check-ignore', '-q', '--', WORKSPACE_BINDINGS_PATH],
      { cwd: root, timeout: 5000, env: { ...process.env, LC_ALL: 'C' } },
      (error, _stdout, stderr) => resolve({ code: error?.code ?? 0, stderr }));
  });
  if (observed.code === 0) return;
  // A non-Git workspace still receives a portable ignore file for later git init.
  if (observed.code === 128 && observed.stderr.includes('not a git repository')) return;
  throw new Error(`Local binding privacy failed: git check-ignore -q -- ${WORKSPACE_BINDINGS_PATH} in ${root} exited ${observed.code}. Check existing ignore rules and whether the file is already tracked; no binding was published and no file was untracked. ${observed.stderr.trim()}`);
}

export function createCodumentContextGuard(workspaceRoot: string, observed: { readonly profiles?: string; readonly bindings?: string }): () => Promise<void> {
  const expected = { ...observed };
  return async () => {
    const [profiles, bindings] = await Promise.all([readAttractorProfilesSource(workspaceRoot), readLocalWorkspaceBindingsSource(workspaceRoot)]);
    if (profiles !== expected.profiles || bindings !== expected.bindings) throw new Error('Codument context sources changed; observe profiles and project bindings again before committing.');
  };
}
