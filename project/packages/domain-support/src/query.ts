import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DomainQuerySource, DomainQuerySourcePort } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-lite-skill-app-support/workspace';

const COMPANIONS = ['proposal.md', 'track.xnl', 'track.xml', 'design.md', 'decisions.xnl', 'decisions.md'];

/** Bounded filesystem snapshots only; syntax and display semantics stay in logic. */
export function createFileDomainQuerySourcePort(workspaceRoot: string): DomainQuerySourcePort {
  const root = path.resolve(workspaceRoot), workspace = createWorkspaceEffect(root);
  async function entries(directory: string): Promise<string[]> {
    const kind = await workspace.kind(directory);
    if (kind === undefined) return [];
    if (kind !== 'directory') throw new Error(`Expected query directory: ${directory}`);
    return (await fs.readdir(path.join(root, directory))).filter(name => !name.startsWith('.')).sort();
  }
  async function read(file: string): Promise<string> {
    const source = await workspace.readText(file);
    if (source === undefined) throw new Error(`Query source disappeared: ${file}`);
    return source;
  }
  function safeIdentity(id: string): boolean {
    if (id.startsWith('decision://')) return false;
    if (!id || id.includes('\\') || path.isAbsolute(id) || id.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Query ID must be a portable relative identity.');
    return true;
  }
  return {
    async ensureWorkspace() {
      if (await workspace.kind('codument') !== 'directory') throw new Error('Codument is not initialized. Run codument init first.');
    },
    async tracks(options) {
      const archived = options.id?.startsWith('archived/') === true;
      if (options.id !== undefined && (!safeIdentity(options.id) || !archived && options.id.includes('/'))) return [];
      const parent = archived ? 'codument/tracks/archived' : 'codument/tracks/active';
      const ids = options.id === undefined ? await entries(parent) : [archived ? options.id.slice('archived/'.length) : options.id];
      const results: DomainQuerySource[] = [];
      for (const id of ids) {
        const directory = parent + '/' + id;
        if (await workspace.kind(directory) !== 'directory') continue;
        const file = directory + '/track.xnl';
        const current = await workspace.kind(file), legacy = await workspace.kind(directory + '/track.xml');
        if (legacy !== undefined) throw new Error(`Track requires migration or conflicting-authority review: ${directory}`);
        if (current === undefined) continue;
        const source = await read(file);
        let files: string[] | undefined, contents: Record<string, string> | undefined;
        if (options.detail) {
          files = [];
          for (const companion of COMPANIONS) if (await workspace.kind(directory + '/' + companion) === 'file') files.push(companion);
          if (options.includeContent) {
            contents = {};
            for (const relative of files) contents[relative] = relative === 'track.xnl' ? source : await read(directory + '/' + relative);
          }
        }
        results.push({ id, file, absolutePath: path.join(root, file), source, files, contents });
      }
      return results;
    },
  };
}
