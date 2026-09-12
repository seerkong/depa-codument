import { createHash, randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import * as path from 'node:path';
import type { PageControlAgent } from './serve-process';

export async function canonicalWorkspaceRoot(root: string): Promise<string> {
  return realpath(path.resolve(root));
}

export async function workspaceSha8(root: string): Promise<string> {
  const canonical = await canonicalWorkspaceRoot(root);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 8);
}

export function serverInstanceId(): string {
  return randomUUID().replaceAll('-', '').slice(0, 16);
}

export function egoTaskSpaceName(workspaceHash: string, agent: PageControlAgent, serverId: string): string {
  return `codument-${workspaceHash}-${agent}-${serverId.slice(0, 8)}`;
}

