import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {createHash} from 'node:crypto';
import {createWorkspaceEffect} from 'halfcode-lite-skill-app-support/workspace';

interface Identity {ino: number; dev: number; mode: number}
export type ArchiveFileState = Identity & ({kind: 'directory'} | {kind: 'file'; bytes: Uint8Array; digest: string});
export interface ArchiveFiles {roots: readonly string[]; entries: ReadonlyMap<string, ArchiveFileState | undefined>}
export interface ArchiveFileEffects {
  publish(stage: string, target: string, replace: boolean): Promise<void>;
  restore(backup: string, target: string): Promise<void>;
  move(source: string, target: string): Promise<void>;
}
const effects: ArchiveFileEffects = {
  async publish(stage, target, replace) {if (replace) await fs.rename(stage, target); else await fs.link(stage, target);},
  async restore(backup, target) {await fs.rename(backup, target);},
  async move(source, target) {await fs.rename(source, target);},
};
const within = (root: string, file: string) => file === root || file.startsWith(root + path.sep);
async function kind(file: string) {return createWorkspaceEffect(path.parse(file).root).kind(file.slice(path.parse(file).root.length));}
export async function readArchiveFile(file: string): Promise<ArchiveFileState | undefined> {
  if (await kind(file) === undefined) return undefined;
  const before = await fs.lstat(file);
  const identity = {ino: before.ino, dev: before.dev, mode: before.mode & 0o777};
  if (before.isDirectory()) return {...identity, kind: 'directory'};
  if (!before.isFile()) throw new Error(`Archive source must be a regular file or directory: ${file}`);
  const bytes = await fs.readFile(file);
  await kind(file);
  const after = await fs.lstat(file);
  if (before.ino !== after.ino || before.dev !== after.dev || before.mode !== after.mode || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || after.size !== bytes.length) throw new Error(`Archive source changed while reading: ${file}`);
  return {...identity, kind: 'file', bytes, digest: createHash('sha256').update(bytes).digest('hex')};
}
export async function observeArchiveFiles(roots: readonly string[], ignored: ReadonlySet<string> = new Set()): Promise<ArchiveFiles> {
  const entries = new Map<string, ArchiveFileState | undefined>();
  async function visit(file: string) {
    if (ignored.has(file) || entries.has(file)) return;
    const state = await readArchiveFile(file);
    entries.set(file, state);
    if (state?.kind === 'directory') {
      for (const name of (await fs.readdir(file)).sort()) await visit(path.join(file, name));
      if (!sameArchiveFile(state, await readArchiveFile(file))) throw new Error('Archive directory changed while observing.');
    }
  }
  for (const root of roots) {
    if (!path.isAbsolute(root) || path.normalize(root) !== root) throw new Error('Archive observation roots must be normalized absolute paths.');
    await visit(root);
  }
  return {roots: [...roots], entries};
}
export function sameArchiveFile(a: ArchiveFileState | undefined, b: ArchiveFileState | undefined): boolean {
  return a?.kind === b?.kind && a?.ino === b?.ino && a?.dev === b?.dev && a?.mode === b?.mode
    && (a?.kind !== 'file' || b?.kind === 'file' && a.digest === b.digest);
}
function sameEntries(a: ArchiveFiles['entries'], b: ArchiveFiles['entries']): boolean {
  return a.size === b.size && [...a].every(([file, state]) => b.has(file) && sameArchiveFile(state, b.get(file)));
}
async function stage(file: string, bytes: Uint8Array, mode: number) {
  const handle = await fs.open(file, 'wx', mode);
  try {await handle.writeFile(bytes); await handle.chmod(mode); await handle.sync();} finally {await handle.close();}
}

/** Private archive effect: one recovery boundary for all publications and the
 * complete process move. Cooperating writers use lifecycle + per-file locks;
 * arbitrary editors are detected, not excluded by an OS-level atomic CAS. */
export async function commitArchiveFiles(input: {
  readonly workspaceRoot: string;
  readonly observed: ArchiveFiles;
  readonly changes: ReadonlyMap<string, string>;
  readonly move: {readonly source: string; readonly destination: string};
  /** Replays authority/context discovery without trying to acquire our lock. */
  readonly assertAuthorityCurrent?: (moved: boolean) => Promise<void>;
}, supplied: ArchiveFileEffects = effects): Promise<{maintenanceWarnings?: readonly string[]}> {
  const root = path.resolve(input.workspaceRoot), formal = path.join(root, 'codument');
  const observed = structuredClone(input.observed), changes = new Map(input.changes), move = {...input.move}, mutations = {...supplied};
  if (![move.source, move.destination, ...changes.keys()].every(file => path.normalize(file) === file && within(formal, file) && file !== formal)) throw new Error('Archive transaction is restricted to formal codument paths.');
  if (within(move.source, move.destination) || within(move.destination, move.source) || observed.entries.get(move.source)?.kind !== 'directory'
    || !observed.entries.has(move.destination) || observed.entries.get(move.destination) !== undefined) throw new Error('Archive requires a disjoint observed source directory and absent destination.');
  for (const file of changes.keys()) {
    if (!observed.roots.some(boundary => within(boundary, file)) || within(move.destination, file)) throw new Error('Archive publication must belong to an observed source boundary.');
    const before = observed.entries.get(file);
    if (before && before.kind !== 'file') throw new Error('Archive publication cannot overwrite a directory.');
  }
  const globalLock = path.join(formal, '.lifecycle-write.lock'), ignored = new Set<string>();
  const locks: {file: string; identity: ArchiveFileState}[] = [], created: string[] = [];
  const ownedRecoveryFiles = new Map<string, ArchiveFileState>();
  const attempted: {file: string; staged: ArchiveFileState; backup?: string}[] = [];
  let moveAttempted = false, moved = false, movedExpectedApplied = false, published = false, recoveryRequired = false, failure: unknown;
  const warnings: string[] = [], expected = new Map(observed.entries);
  async function stageOwned(file: string, bytes: Uint8Array, mode: number) {
    await stage(file, bytes, mode);
    ownedRecoveryFiles.set(file, (await readArchiveFile(file))!);
  }
  function withinObserved(file: string) {return observed.roots.some(boundary => within(boundary, file));}
  async function assertCurrent() {
    for (const lock of locks) if (!sameArchiveFile(lock.identity, await readArchiveFile(lock.file))) throw new Error(`Archive lock ownership changed: ${lock.file}`);
    const current = await observeArchiveFiles(observed.roots, ignored);
    if (!sameEntries(current.entries, expected)) throw new Error('Archive sources changed before or during publication.');
    await input.assertAuthorityCurrent?.(moved);
  }
  async function ensureDirectory(directory: string): Promise<void> {
    const state = await readArchiveFile(directory);
    if (state?.kind === 'directory') return;
    if (state || !within(formal, directory)) throw new Error(`Archive parent is not an owned directory: ${directory}`);
    await ensureDirectory(path.dirname(directory));
    await fs.mkdir(directory); created.push(directory);
    if (withinObserved(directory)) expected.set(directory, await readArchiveFile(directory));
  }
  async function lock(file: string) {
    await kind(file);
    await fs.mkdir(file, {mode: 0o700});
    const identity = (await readArchiveFile(file))!;
    locks.push({file, identity}); ignored.add(file);
  }
  function movedEntries(entries: ArchiveFiles['entries']) {
    const result = new Map(entries);
    for (const [file, state] of entries) if (within(move.source, file)) {result.delete(file); result.set(move.destination + file.slice(move.source.length), state);}
    result.set(move.source, undefined);
    return result;
  }
  try {
    await lock(globalLock);
    await assertCurrent();
    // Decision writers do not take the lifecycle lock. Acquire precisely the
    // destination locks they use, and still re-observe whole source boundaries.
    for (const file of [...changes.keys()].sort()) {
      await ensureDirectory(path.dirname(file));
      await lock(path.join(path.dirname(file), '.' + path.basename(file) + '.write-lock'));
    }
    await assertCurrent();
    const entries: {file: string; stage: string; staged: ArchiveFileState; backup?: string}[] = [];
    for (const [index, [file, source]] of [...changes].entries()) {
      const old = observed.entries.get(file), stagedFile = path.join(globalLock, `new-${index}`);
      const mode = old?.mode ?? 0o644 & ~process.umask();
      await stageOwned(stagedFile, new TextEncoder().encode(source), mode);
      const backup = old?.kind === 'file' ? path.join(globalLock, `backup-${index}`) : undefined;
      if (backup && old?.kind === 'file') await stageOwned(backup, old.bytes, old.mode);
      entries.push({file, stage: stagedFile, staged: (await readArchiveFile(stagedFile))!, backup});
    }
    await stageOwned(path.join(globalLock, 'recovery.json'), new TextEncoder().encode(JSON.stringify({version: 1, move, roots: observed.roots,
      originals: [...observed.entries].map(([file, state]) => ({file, kind: state?.kind, ino: state?.ino, dev: state?.dev, mode: state?.mode, digest: state?.kind === 'file' ? state.digest : undefined})),
      entries: entries.map(entry => ({file: entry.file, backup: entry.backup && path.basename(entry.backup), digest: entry.staged.kind === 'file' ? entry.staged.digest : undefined}))}, null, 2)), 0o600);
    for (const entry of entries) {
      await assertCurrent();
      attempted.push(entry);
      await mutations.publish(entry.stage, entry.file, observed.entries.get(entry.file)?.kind === 'file');
      expected.set(entry.file, entry.staged);
      await assertCurrent();
    }
    await ensureDirectory(path.dirname(move.destination));
    await assertCurrent();
    // File locks in the process must be released before its tree moves. The
    // lifecycle lock remains held; final snapshots still detect other writers.
    for (const owned of [...locks].reverse().filter(item => within(move.source, item.file))) {
      if (!sameArchiveFile(owned.identity, await readArchiveFile(owned.file))) throw new Error('Archive process file lock changed.');
      await fs.rmdir(owned.file); ignored.delete(owned.file); locks.splice(locks.indexOf(owned), 1);
    }
    await assertCurrent();
    moveAttempted = true;
    await mutations.move(move.source, move.destination); moved = true;
    const afterMove = movedEntries(expected); expected.clear(); for (const pair of afterMove) expected.set(...pair); movedExpectedApplied = true;
    await assertCurrent();
    published = true;
  } catch (error) {
    failure = error;
    if (moveAttempted) try {
      const actual = await readArchiveFile(move.destination), original = observed.entries.get(move.source);
      moved = sameArchiveFile(actual, original);
      if (moved) {
        const current = await observeArchiveFiles([move.destination]);
        const owned = new Map([...(movedExpectedApplied ? expected : movedEntries(expected))].filter(([file]) => within(move.destination, file)));
        if (!sameEntries(current.entries, owned) || await readArchiveFile(move.source) !== undefined) throw new Error('Independent edit prevents archive directory rollback.');
        await mutations.move(move.destination, move.source); moved = false;
      } else if (!sameArchiveFile(await readArchiveFile(move.source), original)) throw new Error('Archive process location changed; manual recovery required.');
    } catch (restoreError) {recoveryRequired = true; warnings.push(String(restoreError));}
    for (const entry of [...attempted].reverse()) try {
      const file = moved && within(move.source, entry.file) ? move.destination + entry.file.slice(move.source.length) : entry.file;
      const actual = await readArchiveFile(file), original = observed.entries.get(entry.file);
      if (sameArchiveFile(actual, original)) continue;
      if (!sameArchiveFile(actual, entry.staged)) throw new Error(`Independent edit prevents archive file rollback: ${file}`);
      if (entry.backup) await mutations.restore(entry.backup, file); else await fs.unlink(file);
      const restored = await readArchiveFile(file);
      if (restored?.kind !== original?.kind || restored?.mode !== original?.mode || restored?.kind === 'file' && (original?.kind !== 'file' || restored.digest !== original.digest)) throw new Error(`Archive restore failed: ${file}`);
    } catch (restoreError) {recoveryRequired = true; warnings.push(String(restoreError));}
  } finally {
    for (const owned of [...locks].reverse()) {
      if (owned.file === globalLock && recoveryRequired) continue;
      try {
        if (!sameArchiveFile(owned.identity, await readArchiveFile(owned.file))) throw new Error(`Archive lock ownership changed; retain ${owned.file}`);
        if (owned.file === globalLock) {
          const currentFiles = (await fs.readdir(globalLock)).map(name => path.join(globalLock, name));
          for (const file of currentFiles) if (!ownedRecoveryFiles.has(file) || !sameArchiveFile(ownedRecoveryFiles.get(file), await readArchiveFile(file))) throw new Error(`Archive recovery contents changed; retain ${globalLock}`);
          for (const file of currentFiles) {
            if (!sameArchiveFile(ownedRecoveryFiles.get(file), await readArchiveFile(file))) throw new Error(`Archive recovery file changed; retain ${file}`);
            await fs.unlink(file);
          }
        }
        await fs.rmdir(owned.file);
      } catch (error) {warnings.push(String(error));}
    }
    if (!published && !recoveryRequired) for (const directory of [...created].reverse()) try {await fs.rmdir(directory);} catch (error) {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes((error as NodeJS.ErrnoException).code ?? '')) warnings.push(String(error));
    }
  }
  if (!published) {
    if (recoveryRequired) throw new AggregateError([failure, ...warnings], `Archive failed; recovery required. Backups retained at ${globalLock}`, {cause: failure});
    if (warnings.length) throw new AggregateError([failure, ...warnings], 'Archive failed; cleanup requires attention.', {cause: failure});
    throw failure;
  }
  return warnings.length ? {maintenanceWarnings: warnings} : {};
}
