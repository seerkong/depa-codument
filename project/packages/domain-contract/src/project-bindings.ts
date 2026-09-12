import type { DomainSourceWritePort } from './decisions';

export const WORKSPACE_BINDINGS_PATH = 'codument/.local/workspace-bindings.xnl';
export interface WorkspaceBinding { readonly projectRef: string; readonly workspacePath: string; }
export type WorkspaceBindingCommand = { readonly operation: 'bindings' }
  | { readonly operation: 'bind'; readonly projectRef: string; readonly workspacePath: string }
  | { readonly operation: 'unbind'; readonly projectRef: string };
export interface WorkspaceBindingRuntime {
  readonly source: DomainSourceWritePort;
  readonly paths: { resolve(input: string): string };
  readonly privacy: { ensureIgnored(): Promise<void> };
}
export interface WorkspaceBindingResult {
  readonly bindings: readonly WorkspaceBinding[];
  readonly binding?: WorkspaceBinding;
  readonly maintenanceWarnings?: readonly string[];
}
