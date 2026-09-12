import { homedir } from 'node:os';
import * as path from 'node:path';

export function isFilesystemRoot(dir: string): boolean {
  const resolved = path.resolve(dir);
  return resolved === path.parse(resolved).root;
}

export async function resolveWorkspaceRoot(options: {
  explicit?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  lookupHostWorkspace?: () => Promise<string | undefined>;
} = {}): Promise<string> {
  const explicit = options.explicit?.trim();
  if (explicit) return path.resolve(explicit);

  const cwd = path.resolve(options.cwd ?? process.cwd());
  if (!isFilesystemRoot(cwd)) return cwd;

  const env = options.env ?? process.env;
  for (const key of ['VSCODE_CWD', 'INIT_CWD', 'PWD'] as const) {
    const value = env[key]?.trim();
    if (!value) continue;
    const resolved = path.resolve(value);
    if (!isFilesystemRoot(resolved)) return resolved;
  }

  const host = await options.lookupHostWorkspace?.();
  if (host?.trim()) {
    const resolved = path.resolve(host.trim());
    if (!isFilesystemRoot(resolved)) return resolved;
  }

  return isFilesystemRoot(cwd) ? homedir() : cwd;
}
