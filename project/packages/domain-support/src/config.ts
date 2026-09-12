import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';
import * as path from 'node:path';
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
  return { source: createFileDomainSourceWritePort(root), paths: { resolve: input => path.resolve(root, input) } };
}

export function createCodumentContextGuard(workspaceRoot: string, observed: { readonly profiles?: string; readonly bindings?: string }): () => Promise<void> {
  const expected = { ...observed };
  return async () => {
    const [profiles, bindings] = await Promise.all([readAttractorProfilesSource(workspaceRoot), readLocalWorkspaceBindingsSource(workspaceRoot)]);
    if (profiles !== expected.profiles || bindings !== expected.bindings) throw new Error('Codument context sources changed; observe profiles and project bindings again before committing.');
  };
}
