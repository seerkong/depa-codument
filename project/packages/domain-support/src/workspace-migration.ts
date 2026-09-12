import * as nodeFs from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { WorkspaceMigrationPort, WorkspaceMigrationSnapshot } from 'depa-codument-domain-contract';

type FileSystem = Pick<typeof nodeFs, 'lstat' | 'realpath' | 'open' | 'mkdir' | 'readdir' | 'rename' | 'unlink' | 'rmdir'>;
interface Identity { dev: number; ino: number; mode: number }
interface FileState extends Identity { bytes: Buffer }
interface Tree { files: Map<string, FileState>; directories: Map<string, Identity> }
const same = (a: Identity | undefined, b: Identity | undefined) => Boolean(a && b && a.dev === b.dev && a.ino === b.ino && a.mode === b.mode);
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const fingerprint = (bytes: Buffer) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

/** App-wide migration write boundary. Two directory renames are a recoverable
 * transaction, NOT an atomic filesystem swap. Full byte/inode guards reject
 * concurrent edits; arbitrary editors are not claimed to participate in CAS.
 * Only codument/ is published. Backups and phase records are never catalog input. */
export function createFileWorkspaceMigrationPort(workspaceRoot: string, fs: FileSystem = nodeFs, options: {readonly backupDirectory?: string} = {}): WorkspaceMigrationPort {
  const root = resolve(workspaceRoot), app = join(root, 'codument'), lock = join(root, '.codument-migration.lock');
  const backupBase = resolve(root, options.backupDirectory ?? '.codument/workspace-migrations');
  if (!backupBase.startsWith(root + '/') || backupBase === app || backupBase.startsWith(app + '/')) throw new Error('Migration backup directory must be workspace-local and outside the formal codument/ App.');
  const observations = new WeakMap<WorkspaceMigrationSnapshot, Tree>();
  const stat = async (path: string) => { try { return await fs.lstat(path); } catch (error) { if (missing(error)) return undefined; throw error; } };
  const parents = async (path: string) => {
    if (path !== root && !path.startsWith(root + '/')) throw new Error('Workspace migration path escapes root.');
    for (let cursor = path; ; cursor = dirname(cursor)) {
      const value = await stat(cursor);
      if (value && (!value.isDirectory() || value.isSymbolicLink())) throw new Error('Unsafe migration directory: ' + cursor);
      if (cursor === root) break;
    }
  };
  const read = async (path: string): Promise<FileState> => {
    await parents(dirname(path));
    const before = await stat(path);
    if (!before?.isFile() || before.isSymbolicLink()) throw new Error('Unsafe migration file: ' + path);
    const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try { if (!same(before, await handle.stat())) throw new Error('Migration file identity drift.'); bytes = await handle.readFile(); }
    finally { await handle.close(); }
    const after = await stat(path);
    if (!same(before, after) || before.size !== bytes.length || before.mtimeMs !== after?.mtimeMs) throw new Error('Migration file changed while reading.');
    return {dev: before.dev, ino: before.ino, mode: before.mode, bytes};
  };
  const tree = async (location: string): Promise<Tree> => {
    const result: Tree = {files: new Map(), directories: new Map()};
    const visit = async (local: string): Promise<void> => {
      const path = join(location, local); await parents(path);
      const value = await stat(path);
      if (!value?.isDirectory() || value.isSymbolicLink()) throw new Error('Unsafe migration tree.');
      result.directories.set(local, value);
      for (const name of (await fs.readdir(path)).sort()) {
        if (name.endsWith('.write-lock')) throw new Error('Workspace contains an active resource writer: ' + join(local, name));
        const child = join(local, name), state = await stat(join(location, child));
        if (state?.isDirectory() && !state.isSymbolicLink()) await visit(child);
        else result.files.set(child, await read(join(location, child)));
      }
    };
    await visit(''); return result;
  };
  const assertTree = async (location: string, expected: Tree, identities = true) => {
    const actual = await tree(location);
    if (actual.files.size !== expected.files.size || actual.directories.size !== expected.directories.size
      || [...expected.files].some(([path, value]) => {
        const current = actual.files.get(path);
        return !current || !current.bytes.equals(value.bytes) || current.mode !== value.mode || identities && !same(current, value);
      }) || [...expected.directories].some(([path, value]) => {
        const current = actual.directories.get(path);
        return !current || current.mode !== value.mode || identities && !same(current, value);
      })) throw new Error('Workspace migration closure drift: ' + location);
  };
  const requireRoot = async () => {
    if (await fs.realpath(root) !== root) throw new Error('Workspace migration root must not be a symlink.');
    await parents(root); return (await stat(root))!;
  };
  return {
    async observe() {
      await requireRoot();
      if (await stat(lock)) throw new Error('Workspace migration is locked.');
      const observed = await tree(app);
      const snapshot = Object.freeze({sourceRevision: randomUUID(), files: [...observed.files].map(([path, file]) => {
        let source: string | undefined;
        try { source = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(file.bytes); } catch { /* Opaque attachment. */ }
        return Object.freeze({path: 'codument/' + path, fingerprint: fingerprint(file.bytes), mode: file.mode & 0o777, source});
      })});
      observations.set(snapshot, observed); return snapshot;
    },
    async prepare(snapshot, plan) {
      const observed = observations.get(snapshot);
      if (!observed) throw new Error('Unknown workspace migration observation.');
      const rootIdentity = await requireRoot();
      await fs.mkdir(lock, {mode: 0o700}); const lockIdentity = (await stat(lock))!;
      let location: string | undefined, candidateTree: Tree | undefined, backupTree: Tree | undefined;
      let retired = false, published = false, committed = false, closed = false;
      let reservation: Identity | undefined;
      const records = new Map<string, FileState>();
      const guardRoot = async () => {
        if (!same(await stat(root), rootIdentity) || !same(await stat(lock), lockIdentity)) throw new Error('Workspace migration root or lock drift.');
      };
      const mkdir = async (path: string, mode = 0o700): Promise<void> => {
        await guardRoot(); await parents(path);
        if (await stat(path)) return;
        await mkdir(dirname(path)); await fs.mkdir(path, {mode});
      };
      const write = async (path: string, bytes: Buffer, mode = 0o600) => {
        await mkdir(dirname(path));
        const handle = await fs.open(path, 'wx', mode & 0o777);
        try { await handle.writeFile(bytes); await handle.chmod(mode & 0o777); await handle.sync(); }
        finally { await handle.close(); }
        return read(path);
      };
      const ledger = async (phase: string) => {
        const path = join(location!, phase + '.json');
        records.set(path, await write(path, Buffer.from(JSON.stringify({phase, planDigest: plan.planDigest, sourceFingerprint: plan.sourceFingerprint}) + '\n')));
      };
      const release = async () => { if (closed) return; await guardRoot(); await fs.rmdir(lock); closed = true; };
      const abort = async () => {
        if (closed || committed) return;
        try {
          await guardRoot();
          if (published) {
            await assertTree(app, candidateTree!);
            if (await stat(join(location!, 'candidate/codument'))) throw new Error('Recovery candidate path occupied.');
            try { await fs.rename(app, join(location!, 'candidate/codument')); }
            finally { published = same(await stat(app), candidateTree!.directories.get('')); }
            if (published) throw new Error('Cannot withdraw exact published candidate.');
          }
          if (reservation) {
            if (!same(await stat(app), reservation) || (await fs.readdir(app)).length) throw new Error('Independent App reservation edit; preserve recovery material.');
            await fs.rmdir(app); reservation = undefined;
          }
          if (retired) {
            await assertTree(join(location!, 'retired-codument'), observed);
            if (await stat(app)) throw new Error('Independent App appeared; preserve both authorities for recovery.');
            try { await fs.rename(join(location!, 'retired-codument'), app); }
            finally { retired = !same(await stat(app), observed.directories.get('')); }
            if (retired) throw new Error('Cannot restore original App.');
          }
          if (location) await ledger('aborted');
          // Retain exact backup/candidate/ledger for audit, never recursively delete.
        } finally { await release(); }
      };
      try {
        await assertTree(app, observed);
        const changes = new Map<string, string | null>(), modes = new Map<string, number>();
        for (const change of plan.changes) {
          const path = change.path;
          const finderRetirement = change.source === null && path.startsWith('codument/std/') && path.endsWith('/.DS_Store');
          if (!path.startsWith('codument/') || path.includes('\\') || /[\x00-\x1f]/u.test(path)
            || path.split('/').some((part, index, parts) => !part || part === '.' || part === '..'
              || part.startsWith('.') && !(finderRetirement && index === parts.length - 1 && part === '.DS_Store'))
            || changes.has(path.slice(9))) throw new Error('Unsafe or duplicate migration change.');
          changes.set(path.slice(9), change.source);
          if (change.mode !== undefined) {
            if (!Number.isInteger(change.mode) || change.mode < 0 || change.mode > 0o777) throw new Error('Unsafe migration file mode.');
            modes.set(path.slice(9), change.mode);
          }
        }
        location = join(backupBase, randomUUID()); await mkdir(location);
        const backup = join(location, 'backup/codument'), candidate = join(location, 'candidate/codument');
        const localDirectory = (path: string) => {
          if (!path.startsWith('codument/') || path.includes('\\') || /[\x00-\x1f]/u.test(path)
            || path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) throw new Error('Unsafe migration directory proposal.');
          return path.slice(9);
        };
        const removedDirectories = (plan.removeDirectories ?? []).map(localDirectory);
        const relocations = (plan.relocations ?? []).map(move => ({from: localDirectory(move.from), to: localDirectory(move.to)}));
        for (const move of relocations) if (move.from === move.to || move.to.startsWith(move.from + '/') || relocations.some(other => other !== move && (other.from === move.from || other.from.startsWith(move.from + '/')))) throw new Error('Ambiguous migration relocation.');
        const relocatedPath = (path: string) => {
          const move = relocations.find(move => path === move.from || path.startsWith(move.from + '/'));
          return move ? move.to + path.slice(move.from.length) : path;
        };
        for (const target of [backup, candidate]) {
          for (const [path, value] of observed.directories) {
            if (target === candidate && removedDirectories.some(prefix => path === prefix || path.startsWith(prefix + '/'))) continue;
            await mkdir(join(target, target === candidate ? relocatedPath(path) : path), value.mode & 0o777);
          }
          const stagedPaths = new Set<string>();
          for (const [path, value] of observed.files) {
            const destination = target === candidate ? relocatedPath(path) : path;
            const replacement = target === candidate ? changes.get(destination) : undefined;
            if (replacement !== null) {
              // Conflicts are represented in plan diagnostics; never overwrite a
              // staged peer or publish an ambiguous tree, even in review mode.
              if (stagedPaths.has(destination)) {
                if (plan.status !== 'review-required') throw new Error('Migration relocation collision.');
                continue;
              }
              await write(join(target, destination), replacement === undefined ? value.bytes : Buffer.from(replacement), value.mode);
              stagedPaths.add(destination);
            }
          }
          if (target === candidate) for (const [path, source] of changes) if (!stagedPaths.has(path) && source !== null) await write(join(target, path), Buffer.from(source), modes.get(path) ?? 0o644);
          if (target === candidate) for (const path of plan.directories ?? []) await mkdir(join(target, localDirectory(path)), 0o755);
        }
        // Original bytes are backed up before any publication; snapshots are not
        // trusted merely because the copy operation returned successfully.
        await assertTree(backup, observed, false); backupTree = await tree(backup); candidateTree = await tree(candidate);
        records.set(join(location, 'plan.json'), await write(join(location, 'plan.json'), Buffer.from(JSON.stringify(plan, null, 2) + '\n')));
        await ledger('prepared');
        const assertCurrent = async () => {
          await guardRoot(); await assertTree(app, observed); await assertTree(backup, backupTree!); await assertTree(candidate, candidateTree!);
          for (const [path, expected] of records) {
            const actual = await read(path);
            if (!same(actual, expected) || !actual.bytes.equals(expected.bytes)) throw new Error('Workspace migration ledger drift.');
          }
        };
        return {validationRoot: join(location, 'candidate'), backupPath: backup, assertCurrent, abort,
          async commit() {
            if (closed || committed || plan.status === 'review-required') throw new Error('Workspace migration cannot commit.');
            await assertCurrent();
            if (plan.changes.length || plan.relocations?.length || plan.directories?.some(path => !observed.directories.has(path.slice(9))) || plan.removeDirectories?.some(path => observed.directories.has(path.slice(9)))) {
              try { await fs.rename(app, join(location!, 'retired-codument')); }
              finally { retired = same(await stat(join(location!, 'retired-codument')), observed.directories.get('')); }
              if (!retired) throw new Error('App retirement could not be verified.');
              await assertTree(join(location!, 'retired-codument'), observed);
              await ledger('retired');
              await fs.mkdir(app); reservation = (await stat(app))!;
              if (!same(await stat(app), reservation) || (await fs.readdir(app)).length) throw new Error('App reservation drift.');
              try { await fs.rename(candidate, app); }
              finally { published = same(await stat(app), candidateTree!.directories.get('')); if (published) reservation = undefined; }
              if (!published) throw new Error('App publication could not be verified.');
              await assertTree(app, candidateTree!); await ledger('published');
            }
            await ledger('committed'); committed = true; observations.delete(snapshot); await release();
          },
        };
      } catch (cause) {
        try { await abort(); } catch (recovery) { throw new AggregateError([cause, recovery], 'Workspace migration recovery requires attention; retain backup and ledger.', {cause}); }
        throw cause;
      }
    },
  };
}
