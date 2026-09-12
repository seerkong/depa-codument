import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { VerificationRuntime } from 'depa-codument-domain-contract/lifecycle';
import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';

export interface FileVerificationSpec {
  readonly workspaceRoot: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}
export interface FileVerificationBindings {
  /** Locate the canonical Track in this workspace (not a second discovery rule). */
  readonly locateTrack: (id: string) => Promise<{ readonly directory: string; readonly file: string }>;
  readonly output: { write(bytes: Uint8Array): void };
  readonly clock: { nowIso(): string };
  /** Product-owned pure projection. Omitted means conservative raw-byte invalidation. */
  readonly projectTrackContract?: (source: string) => string;
}

const FALLBACK_IGNORED_DIRS = new Set([
  '.git', '.tmp', '.venv', '.e2e-venv', 'node_modules', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
]);

/** No cwd mutation, lifecycle discovery, or domain state writes. */
export function createFileVerificationRuntime(spec: FileVerificationSpec, bindings: FileVerificationBindings): VerificationRuntime {
  if (!path.isAbsolute(spec.workspaceRoot)) throw new Error('Verification workspace root must be absolute.');
  const root = path.resolve(spec.workspaceRoot);
  const env = { ...spec.env };
  const locateTrack = bindings.locateTrack;
  const output = bindings.output;
  const clock = bindings.clock;
  const projectTrackContract = bindings.projectTrackContract;
  const workspace = createWorkspaceEffect(root);

  async function locate(id: string): Promise<{ directory: string; file: string }> {
    const location = await locateTrack(id);
    const directory = portable(location.directory);
    const file = portable(location.file);
    if (!file.startsWith(directory + '/')) throw new Error('Track authority must be inside its owned directory.');
    if (await workspace.kind(directory) !== 'directory' || await workspace.kind(file) !== 'file') throw new Error('Track authority is missing.');
    return { directory, file };
  }

  function receiptFile(directory: string, id: string): string {
    if (!/^vr-[a-f0-9]{20}$/.test(id)) throw new Error('Invalid verification receipt identity.');
    return `${directory}/reports/verification/${id}.json`;
  }

  return {
    clock,
    digest: { sha256: (content) => createHash('sha256').update(content).digest('hex') },
    workspace: {
      async fingerprint(track) {
        const location = await locate(track);
        const hash = createHash('sha256').update('codument-verification-workspace-v2\0');
        const trackSource = await workspace.readText(location.file);
        if (trackSource === undefined) throw new Error('Track authority disappeared.');
        hash.update(JSON.stringify({ versions: process.versions, env: Object.entries(env).sort(([a], [b]) => a.localeCompare(b)) })).update('\0');
        hash.update(location.file).update('\0').update(projectTrackContract?.(trackSource) ?? trackSource).update('\0');
        const paths = (await gitVisibleFiles(root, env)) ?? await fallbackFiles(root);
        for (const relative of [...new Set(paths)].sort()) {
          if (relative === location.file || relative.startsWith(location.directory + '/reports/verification/')) continue;
          hash.update(relative).update('\0');
          const absolute = path.join(root, portable(relative));
          await workspace.kind(path.posix.dirname(relative));
          let stat;
          try { stat = await fs.lstat(absolute); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            hash.update('missing\0');
            continue;
          }
          hash.update(stat.mode & 0o111 ? 'executable\0' : 'regular\0');
          if (stat.isSymbolicLink()) hash.update(await fs.readlink(absolute));
          else if (stat.isFile()) hash.update(await fs.readFile(absolute));
          hash.update('\0');
        }
        return hash.digest('hex');
      },
    },
    receipts: {
      async read(track, id) {
        const location = await locate(track);
        const content = await workspace.readText(receiptFile(location.directory, id));
        if (content === undefined) return undefined;
        try { return JSON.parse(content); }
        catch (error) {
          if (error instanceof SyntaxError) return undefined;
          throw error;
        }
      },
      async write(receipt) {
        const location = await locate(receipt.track);
        await workspace.writeTextAtomic(receiptFile(location.directory, receipt.id), JSON.stringify(receipt, null, 2));
      },
    },
    execution: {
      async run(command, captureOutput) {
        // Recheck the bound root before launching a command after a long read.
        if (await workspace.kind('') !== 'directory') throw new Error('Verification workspace is missing.');
        const child = Bun.spawn([...command], {
          cwd: root, env, stdin: 'inherit', stdout: captureOutput ? 'pipe' : 'inherit', stderr: captureOutput ? 'pipe' : 'inherit',
        });
        const [exitCode, stdout, stderr] = await Promise.all([
          child.exited,
          captureOutput ? new Response(child.stdout).bytes() : undefined,
          captureOutput ? new Response(child.stderr).bytes() : undefined,
        ]);
        if (stdout?.length) output.write(stdout);
        if (stderr?.length) output.write(stderr);
        return { exitCode };
      },
    },
  };
}

function portable(value: string): string {
  if (!value || value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`Invalid workspace-relative path: ${value}`);
  return value;
}

async function gitVisibleFiles(root: string, env: Record<string, string | undefined>): Promise<string[] | undefined> {
  let child;
  try { child = Bun.spawn(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' }); }
  catch { return undefined; }
  const [code, stdout] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (code !== 0) return undefined;
  return stdout.split('\0').filter(Boolean).map(portable);
}

async function fallbackFiles(root: string): Promise<string[]> {
  const paths: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && FALLBACK_IGNORED_DIRS.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() || entry.isSymbolicLink()) paths.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  }
  await visit(root);
  return paths;
}
