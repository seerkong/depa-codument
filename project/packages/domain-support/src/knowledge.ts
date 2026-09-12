import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { KnowledgeFamily, KnowledgeSourcePort, LifecycleSourceCodec } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';

/** Reads an explicitly selected registry; missing roots retain the legacy empty-registry behavior. */
export function createFileKnowledgeSourcePort(workspaceRoot: string, codec: Pick<LifecycleSourceCodec, 'inspect'>): KnowledgeSourcePort {
  const root = path.resolve(workspaceRoot), workspace = createWorkspaceEffect(root);
  async function regularText(absolute: string): Promise<string> {
    const stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Knowledge source must be a regular non-symlink file: ${absolute}`);
    return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(await fs.readFile(absolute));
  }
  async function trackDirectory(id: string): Promise<{directory: string; file: string; source: string}> {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Knowledge delta Track ID must be a safe resource identity.');
    const found: string[] = [];
    for (const stage of ['active', 'pending']) {
      const directory = `codument/tracks/${stage}/${id}`;
      if (await workspace.kind(directory + '/track.xml') !== undefined) throw new Error('Legacy Track requires migration before reading knowledge deltas.');
      if (await workspace.kind(directory + '/track.xnl') !== undefined) found.push(directory);
    }
    if (await workspace.kind(`codument/tracks/${id}`) !== undefined) throw new Error('Legacy flat Track requires migration before reading knowledge deltas.');
    if (found.length !== 1) throw new Error(`Track '${id}' has ${found.length} eligible authorities in codument/tracks/{active,pending}.`);
    const file = found[0] + '/track.xnl';
    const source = await regularText(path.join(root, file));
    if (codec.inspect(source, 'track').id !== id) throw new Error('Knowledge delta Track owner identity does not match its directory.');
    await workspace.kind(file);
    return {directory: found[0], file, source};
  }
  return {
    async readConfig(family: KnowledgeFamily) {
      if (family !== 'modeling' && family !== 'engineering') throw new Error('Unknown knowledge family.');
      const file = `codument/config/${family}.xnl`;
      if (await workspace.kind(`codument/config/${family}.xml`) !== undefined) throw new Error('Legacy knowledge config requires migration or review.');
      if (await workspace.kind(file) === undefined) return undefined;
      const source = await regularText(path.join(root, file));
      await workspace.kind(file);
      return source;
    },
    async observe(input) {
      if (input.family !== 'modeling' && input.family !== 'engineering') throw new Error('Unknown knowledge family.');
      const track = input.deltas === undefined ? undefined : await trackDirectory(input.deltas);
      const directory = track === undefined
        ? input.directory ?? `codument/${input.family}`
        : track.directory + `/${input.family}_deltas`;
      const absolute = path.resolve(root, directory);
      const selected = createWorkspaceEffect(absolute);
      const sources = new Map<string, string>();
      async function visit(relative: string): Promise<void> {
        const kind = await selected.kind(relative);
        if (kind === undefined) {
          if (relative === '') return;
          throw new Error(`Knowledge source directory disappeared: ${relative}`);
        }
        if (kind !== 'directory') throw new Error(`Knowledge source root must be a directory: ${directory}`);
        for (const name of (await fs.readdir(path.join(absolute, relative))).sort()) {
          if (name.startsWith('.')) continue;
          const file = relative ? relative + '/' + name : name;
          const kind = await selected.kind(file);
          if (kind === 'directory') await visit(file);
          else if (/\.xml$/i.test(name)) throw new Error(`Legacy knowledge source requires migration or review: ${file}`);
          else if (/\.xnl$/i.test(name)) {
            const source = await regularText(path.join(absolute, file));
            await selected.kind(file);
            sources.set(file, source);
          }
        }
      }
      await visit('');
      return {directory, sources, ...(track ? {contextSources: new Map([[track.file, track.source]])} : {})};
    },
  };
}
