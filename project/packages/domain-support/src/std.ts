import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StdDocumentationPort } from 'depa-codument-domain-contract';

/** Read-only author documentation, independent of Codument workspace installation. */
export function createFileStdDocumentationPort(workspaceRoot: string, selection: { include(portablePath: string): boolean }): StdDocumentationPort {
  return { async observe(directory) {
    const root = path.resolve(workspaceRoot, directory ?? 'src/templates/codument/std');
    let stat;
    try { stat = await fs.lstat(root); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`std directory does not exist: ${root}`);
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`std directory must be a real directory, not a symlink: ${root}`);
    const sources = new Map<string, string>();
    async function visit(directoryPath: string): Promise<void> {
      for (const name of (await fs.readdir(directoryPath)).sort()) {
        const candidate = path.join(directoryPath, name);
        const relative = path.relative(root, candidate).split(path.sep).join('/');
        if (!selection.include(relative)) continue;
        const entry = await fs.lstat(candidate);
        if (entry.isSymbolicLink()) throw new Error(`std documentation symlink is not supported: ${candidate}`);
        if (entry.isDirectory()) await visit(candidate);
        else if (name.endsWith('.md')) {
          if (!entry.isFile()) throw new Error(`std documentation must be a regular file: ${candidate}`);
          const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await fs.readFile(candidate));
          sources.set(relative, source);
        }
      }
    }
    await visit(root);
    return { root, sources };
  } };
}
