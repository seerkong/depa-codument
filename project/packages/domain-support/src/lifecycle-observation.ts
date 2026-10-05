import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {LifecycleRef, LifecycleSourceCodec, OwnedLifecycleSnapshot} from 'depa-codument-domain-contract';
import {createWorkspaceEffect} from 'halfcode-lite-skill-app-support/workspace';

/** Shared read-only discovery. The enclosing operation owns locks/revisions;
 * missing is distinct from unsafe or ambiguous input. */
export async function observeFileLifecycle(input: {workspaceRoot: string; resourceDirectory: string; ref: LifecycleRef; codec: LifecycleSourceCodec;
  revision: (file: string, source: string) => string}): Promise<(OwnedLifecycleSnapshot & {content: string}) | undefined> {
  const {ref, codec} = input, workspace = createWorkspaceEffect(input.workspaceRoot);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(ref.id) || !['track', 'mission'].includes(ref.kind)) throw new Error('Invalid lifecycle identity or kind.');
  if (input.resourceDirectory.includes('\\') || input.resourceDirectory.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Lifecycle resource directory must be portable.');
  const matches: Array<OwnedLifecycleSnapshot & {content: string}> = [];
  const filename = ref.kind + '.xnl', absolute = (file: string) => path.join(input.workspaceRoot, file);
  for (const stage of ['pending', 'active', 'archived'] as const) {
    async function visit(directory: string): Promise<void> {
      const type = await workspace.kind(directory);
      if (type === undefined) return;
      if (type !== 'directory') throw new Error(`Lifecycle directory is not a directory: ${directory}`);
      if (await workspace.exists(directory + '/' + ref.kind + '.xml')) throw new Error(`Legacy or competing lifecycle authority requires migration: ${directory}/${ref.kind}.xml`);
      const file = directory + '/' + filename, fileKind = await workspace.kind(file);
      if (fileKind !== undefined) {
        if (fileKind !== 'file' || !(await fs.lstat(absolute(file))).isFile()) throw new Error(`Lifecycle authority is not a regular file: ${file}`);
        const bytes = await fs.readFile(absolute(file));
        let content: string;
        try {content = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);}
        catch (cause) {throw new Error(`Lifecycle source is not valid UTF-8; retain it for review: ${file}`, {cause});}
        await workspace.kind(file);
        const observedId = codec.identify ? codec.identify(content, ref.kind) : codec.inspect(content, ref.kind).id;
        if (observedId === ref.id) {
          const parsed = codec.inspect(content, ref.kind);
          if (parsed.id !== observedId) throw new Error('Lifecycle semantic admission changed the discovered identity.');
          for (const required of ['proposal.md', 'design.md']) {
            const requiredFile = directory + '/' + required;
            if (await workspace.kind(requiredFile) !== 'file' || !(await fs.lstat(absolute(requiredFile))).isFile()) throw new Error(`Missing lifecycle required file: ${requiredFile}`);
          }
          matches.push({...ref, stage, directory, file, content, root: parsed.root, sourceRevision: input.revision(file, content)});
        }
        return;
      }
      for (const entry of (await fs.readdir(absolute(directory), {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isSymbolicLink()) throw new Error(`Lifecycle discovery contains a symlink: ${directory}/${entry.name}`);
        if (entry.isDirectory()) await visit(directory + '/' + entry.name);
      }
    }
    await visit(`${input.resourceDirectory}/${ref.kind}s/${stage}`);
  }
  if (matches.length > 1) throw new Error(`Ambiguous ${ref.kind} authority '${ref.id}': ${matches.map(item => item.file).join(', ')}`);
  return matches[0];
}
