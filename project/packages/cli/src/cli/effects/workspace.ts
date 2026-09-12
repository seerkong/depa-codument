import * as path from 'node:path';
import { FileSystemWorkspaceEffect as HostWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';
import type { WorkspacePort } from 'halfcode-cli-lite-skill-app-contract/host';
export type { WorkspacePort as WorkspaceEffect } from 'halfcode-cli-lite-skill-app-contract/host';

export class FileSystemWorkspaceEffect extends HostWorkspaceEffect {
  constructor(root: string) { super(path.resolve(root)); }
}
export function createWorkspaceEffect(root = process.cwd()): WorkspacePort {
  return new FileSystemWorkspaceEffect(root);
}
