import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createWorkspaceEffect } from 'halfcode-lite-skill-app-support/workspace';

/** Snapshot a registry's explicit physical root. Missing roots are empty;
 * missing files during traversal and symlink authorities fail closed. */
export async function readXnlRegistrySources(root: string, options: { readonly rejectLegacy?: boolean } = {}): Promise<ReadonlyMap<string, string>> {
  const workspace = createWorkspaceEffect(root);
  const sources = new Map<string, string>();
  const kind = await workspace.kind('');
  if (kind === undefined) return sources;
  if (kind !== 'directory') throw new Error('Registry root must be a directory.');
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(path.join(root, directory), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relative = directory ? directory + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Registry source contains a symlink: ${relative}`);
      if (entry.isDirectory()) {
        if (await workspace.kind(relative) !== 'directory') throw new Error(`Registry directory changed: ${relative}`);
        await visit(relative);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml') && options.rejectLegacy) {
        throw new Error(`Legacy registry source requires migration or review: ${relative}`);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xnl')) {
        if (await workspace.kind(relative) !== 'file') throw new Error(`Registry source disappeared: ${relative}`);
        const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await fs.readFile(path.join(root, relative)));
        await workspace.kind(relative);
        sources.set(relative, content);
      }
    }
  }
  await visit('');
  return new Map([...sources].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
