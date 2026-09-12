import * as nodeFs from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import type { MigrationSourceSnapshot, ResourceMigrationSourcePort, ResourceMigrationPlan, MigrationAdmissionDefinition } from 'depa-codument-domain-contract';

type FileSystem = Pick<typeof nodeFs, 'lstat' | 'realpath' | 'open' | 'mkdir' | 'readdir' | 'rename' | 'link' | 'unlink' | 'rmdir'>;
interface Identity { dev: number; ino: number; mode: number }
interface FileState extends Identity { bytes: Buffer }
const sameIdentity = (a: Identity | undefined, b: Identity | undefined) => Boolean(a && b && a.dev === b.dev && a.ino === b.ino && a.mode === b.mode);
const sameFile = (a: FileState | undefined, b: FileState | undefined) => a === undefined ? b === undefined : sameIdentity(a, b) && a.bytes.equals(b!.bytes);
const hash = (bytes: Buffer) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

/** Resource migration transaction, including a full isolated validation
 * view. Persistent backup/ledger stay outside the formal App. Cooperative lock
 * and byte/inode checks are not an OS CAS against arbitrary editors. */
export function createFileResourceMigrationPort(workspaceRoot: string, fs: FileSystem = nodeFs,
  admission?: (plan: ResourceMigrationPlan) => MigrationAdmissionDefinition | undefined): ResourceMigrationSourcePort {
  const root = resolve(workspaceRoot), app = join(root, 'codument');
  const snapshots = new WeakMap<MigrationSourceSnapshot, FileState>();
  const stat = async (file: string) => { try { return await fs.lstat(file); } catch (error) { if (missing(error)) return undefined; throw error; } };
  async function parents(file: string): Promise<void> {
    if (file !== root && !file.startsWith(root + '/')) throw new Error('Migration path escapes workspace.');
    for (let cursor = file; ; cursor = dirname(cursor)) {
      const value = await stat(cursor);
      if (value && (!value.isDirectory() || value.isSymbolicLink())) throw new Error('Unsafe migration directory: ' + cursor);
      if (cursor === root) break;
    }
  }
  function sourcePath(file: string): string {
    if (!file.startsWith('codument/') || file.includes('\\') || /[\x00-\x1f]/u.test(file)
      || file.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) throw new Error('Migration source must be a visible path inside codument/.');
    return join(root, file);
  }
  async function read(file: string): Promise<FileState | undefined> {
    await parents(dirname(file));
    const before = await stat(file);
    if (!before) return undefined;
    if (!before.isFile() || before.isSymbolicLink()) throw new Error('Unsafe migration source: ' + file);
    const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      if (!sameIdentity(before, await handle.stat())) throw new Error('Migration source identity drift.');
      bytes = await handle.readFile();
    } finally { await handle.close(); }
    const after = await stat(file);
    if (!sameIdentity(before, after) || before.size !== bytes.length || before.mtimeMs !== after?.mtimeMs) throw new Error('Migration source drift.');
    return {dev: before.dev, ino: before.ino, mode: before.mode, bytes};
  }
  async function requireRoot(): Promise<Identity> {
    if (await fs.realpath(root) !== root) throw new Error('Migration workspace must not use an ancestor or root symlink.');
    await parents(root);
    if (await stat(join(root, '.codument-migration.lock'))) throw new Error('Workspace migration is locked.');
    return (await stat(root))!;
  }
  return {
    resolve(file) { const absolute = resolve(root, file), local = relative(root, absolute); sourcePath(local); return {relative: local, absolute}; },
    async read(file) {
      await requireRoot();
      const local = relative(root, resolve(root, file));
      const state = await read(sourcePath(local));
      if (!state) throw new Error('Migration source is missing: ' + file);
      const snapshot = Object.freeze({path: local, source: new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(state.bytes), sourceRevision: randomUUID()});
      snapshots.set(snapshot, state); return snapshot;
    },
    async prepare(snapshot, plan, options = {}) {
      const original = snapshots.get(snapshot);
      if (!original || snapshot.path !== plan.path) throw new Error('Unknown migration source observation.');
      if (options.transient && plan.status !== 'noop') throw new Error('Transient migration views cannot perform a transition.');
      const workspaceIdentity = await requireRoot(), file = sourcePath(snapshot.path);
      const targetPath = plan.targetPath ?? snapshot.path, targetFile = sourcePath(targetPath), relocated = targetFile !== file;
      const leafLock = join(dirname(file), '.' + file.slice(file.lastIndexOf('/') + 1) + '.write-lock');
      await parents(dirname(leafLock));
      await fs.mkdir(leafLock, {mode: 0o700});
      const lockIdentity = (await stat(leafLock))!;
      const owned = new Map<string, FileState>(), directories = new Map<string, Identity>();
      const targetDirectories = new Map<string, Identity>();
      let location: string | undefined, stage: string | undefined, published: FileState | undefined;
      let retired = false, uncertainPublication = false, committed = false, closed = false;
      async function guardRoot(): Promise<void> {
        if (!sameIdentity(await stat(root), workspaceIdentity) || !sameIdentity(await stat(leafLock), lockIdentity)) throw new Error('Migration workspace or lock changed.');
      }
      async function mkdir(directory: string): Promise<void> {
        await guardRoot(); await parents(directory);
        if (await stat(directory)) return;
        await mkdir(dirname(directory)); await fs.mkdir(directory, {mode: 0o700});
        directories.set(directory, (await stat(directory))!);
      }
      async function write(target: string, bytes: Buffer, mode = 0o600): Promise<FileState> {
        await mkdir(dirname(target));
        const handle = await fs.open(target, 'wx', mode & 0o777);
        try { await handle.writeFile(bytes); await handle.chmod(mode & 0o777); await handle.sync(); }
        finally { await handle.close(); }
        const state = (await read(target))!; owned.set(target, state); return state;
      }
      const ledger = (name: string, value: unknown) => write(join(location!, name + '.json'), Buffer.from(JSON.stringify(value, null, 2) + '\n'));
      const cleanupStage = async () => {
        if (!stage) return;
        const retained: string[] = [];
        for (const [path, value] of [...owned].reverse()) if (options.transient || path.startsWith(stage + '/')) {
          try { const actual = await read(path); if (actual === undefined) continue;
            if (!sameFile(actual, value)) throw new Error('Staged content changed.');
            await fs.unlink(path);
          } catch { retained.push(path); }
        }
        for (const [path, value] of [...directories].reverse()) if (options.transient || path === stage || path.startsWith(stage + '/')) {
          try { const actual = await stat(path); if (!actual) continue;
            if (!sameIdentity(actual, value)) throw new Error('Staged directory changed.');
            await fs.rmdir(path);
          } catch { retained.push(path); }
        }
        if (retained.length) throw new Error('Migration staging changed; retained for review: ' + retained.join(', '));
      };
      async function release(): Promise<void> {
        if (closed) return;
        await guardRoot(); await fs.rmdir(leafLock); closed = true;
      }
      async function abort(): Promise<void> {
        if (closed || committed) return;
        try {
          await guardRoot();
          if (uncertainPublication) throw new Error('Independent source drift during publication; retain backup and ledger for recovery.');
          if (retired) {
            if (await stat(file)) throw new Error('Independent source appeared after retirement; retain recovery materials.');
            const saved = join(location!, 'retired-source');
            if (!sameFile(await read(saved), original)) throw new Error('Retired source changed.');
            try { await fs.rename(saved, file); }
            catch (error) { if (!sameFile(await read(file), original)) throw error; }
            retired = false;
          }
          if (published) {
            if (!sameFile(await read(targetFile), published)) throw new Error('Independent source edit after migration; retain backup and ledger.');
            if (relocated) {
              try { await fs.unlink(targetFile); }
              catch (error) { if (await stat(targetFile)) throw error; }
              published = undefined;
            } else {
              const backup = join(location!, 'source.backup');
              if (!sameFile(await read(backup), owned.get(backup))) throw new Error('Migration backup changed.');
              const restore = join(location!, 'restore');
              const restored = await write(restore, original!.bytes, original!.mode);
              try { await fs.rename(restore, file); }
              catch (error) { if (!sameFile(await read(file), restored)) throw error; }
              published = undefined;
            }
          }
          for (const [path, identity] of [...targetDirectories].reverse()) {
            if (!sameIdentity(await stat(path), identity)) throw new Error('Migration target directory changed; preserve it.');
            await fs.rmdir(path);
          }
          if (location) await ledger('aborted', {planDigest: plan.planDigest, source: snapshot.path});
          await cleanupStage();
        } finally { await release(); }
      }
      try {
        await guardRoot();
        if (!sameFile(await read(file), original)) throw new Error('Migration source changed before backup.');
        location = join(root, '.codument/migrations', randomUUID());
        await mkdir(location);
        const backup = join(location, 'source.backup');
        await write(backup, original.bytes, original.mode);
        await ledger('plan', {plan, sourceHash: hash(original.bytes), sourceMode: original.mode & 0o777});
        stage = join(location, 'stage');
        await mkdir(stage);
        const observedFiles = new Map<string, FileState>(), observedDirs = new Map<string, Identity>();
        async function observeTree(directory: string, files: Map<string, FileState>, dirs: Map<string, Identity>): Promise<void> {
          await parents(directory);
          const identity = await stat(directory);
          if (!identity?.isDirectory() || identity.isSymbolicLink()) throw new Error('Unsafe migration App directory.');
          dirs.set(relative(root, directory), identity);
          for (const name of (await fs.readdir(directory)).sort()) {
            const child = join(directory, name);
            if (child === leafLock) continue;
            const value = await stat(child);
            if (value?.isDirectory() && !value.isSymbolicLink()) await observeTree(child, files, dirs);
            else { const state = await read(child); if (!state) throw new Error('Migration closure changed.'); files.set(relative(root, child), state); }
          }
        }
        await observeTree(app, observedFiles, observedDirs);
        if (!sameFile(observedFiles.get(snapshot.path), original)) throw new Error('Migration source changed while staging.');
        const existing = relocated ? observedFiles.get(targetPath) : undefined;
        const equalTarget = Boolean(existing && plan.proposal?.source !== null && plan.proposal?.source !== undefined && existing.bytes.equals(Buffer.from(plan.proposal.source)));
        const reviewDiagnostics = relocated && (observedDirs.has(targetPath) || existing && !equalTarget)
          ? ['Migration target already exists with different content; preserve both authorities for review: ' + targetPath] : [];
        for (const [path] of observedDirs) await mkdir(join(stage, path));
        for (const [path, value] of observedFiles) {
          if (relocated && path === snapshot.path && !reviewDiagnostics.length) continue;
          const proposed = path === snapshot.path ? plan.proposal?.source : undefined;
          if (proposed !== null) await write(join(stage, path), proposed === undefined || reviewDiagnostics.length ? value.bytes : Buffer.from(proposed), value.mode);
        }
        if (relocated && !existing && !reviewDiagnostics.length && plan.proposal?.source != null) await write(join(stage, targetPath), Buffer.from(plan.proposal.source), original.mode);
        const definition = !reviewDiagnostics.length ? admission?.(plan) : undefined;
        const admissionRoot = definition ? join(stage, 'admission') : undefined;
        if (definition) {
          await write(join(admissionRoot!, 'manifest.xnl'), Buffer.from(definition.manifest));
          for (const item of definition.files) {
            if (!item.path || item.path.includes('\\') || item.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid migration admission path.');
            sourcePath(item.sourcePath);
            const value = await read(join(stage, item.sourcePath));
            if (!value) {reviewDiagnostics.push('Missing required resource file: ' + item.sourcePath); continue;}
            await write(join(admissionRoot!, item.path), value.bytes, value.mode);
          }
        }
        async function guard(): Promise<void> {
          await guardRoot();
          const files = new Map<string, FileState>(), dirs = new Map<string, Identity>();
          await observeTree(app, files, dirs);
          if (files.size !== observedFiles.size || dirs.size !== observedDirs.size
            || [...observedFiles].some(([path, value]) => !sameFile(files.get(path), value))
            || [...observedDirs].some(([path, value]) => !sameIdentity(dirs.get(path), value))) throw new Error('Migration validation context drift; observe and plan again.');
          for (const [path, value] of owned) if (!sameFile(await read(path), value)) throw new Error('Migration backup, ledger or staged source changed.');
          const stagedFiles = new Map<string, FileState>(), stagedDirs = new Map<string, Identity>();
          await observeTree(stage!, stagedFiles, stagedDirs);
          const expectedFiles = [...owned.keys()].filter(path => path.startsWith(stage + '/'));
          const expectedDirs = [...directories.keys()].filter(path => path === stage || path.startsWith(stage + '/'));
          if (stagedFiles.size !== expectedFiles.length || stagedDirs.size !== expectedDirs.length
            || [...stagedFiles].some(([path, value]) => !sameFile(value, owned.get(join(root, path))))
            || [...stagedDirs].some(([path, value]) => !sameIdentity(value, directories.get(join(root, path))))) throw new Error('Migration staged validation closure changed.');
        }
        return {validationRoot: stage, backupPath: backup, reviewDiagnostics, admissionRoot, assertCurrent: guard, abort,
          async commit() {
            if (closed || committed || options.transient || plan.status === 'review-required' || reviewDiagnostics.length) throw new Error('Migration preparation cannot commit.');
            await guard();
            if (relocated && !equalTarget) {
              const createTargetDirectory = async (directory: string): Promise<void> => {
                await parents(directory);
                if (await stat(directory)) return;
                await createTargetDirectory(dirname(directory));
                await fs.mkdir(directory); targetDirectories.set(directory, (await stat(directory))!);
              };
              await createTargetDirectory(dirname(targetFile));
              const candidate = join(stage!, targetPath), next = owned.get(candidate)!;
              try { await fs.link(candidate, targetFile); }
              finally {
                const actual = await read(targetFile);
                if (sameFile(actual, next)) published = next;
                else uncertainPublication = actual !== undefined;
              }
              if (!published) throw new Error('Migration target publication could not be verified; preserve recovery materials.');
              await ledger('target-published', {path: targetPath, hash: hash(next.bytes)});
            }
            if (plan.proposal?.source === null || relocated) {
              if (!sameFile(await read(file), original)) throw new Error('Migration source changed before retirement.');
              try { await fs.rename(file, join(location!, 'retired-source')); }
              finally {
                retired = sameFile(await read(join(location!, 'retired-source')), original);
                uncertainPublication = !retired && !sameFile(await read(file), original);
              }
              if (!retired) throw new Error('Migration retirement could not be verified; preserve recovery materials.');
            } else if (plan.proposal) {
              const candidate = join(stage!, snapshot.path), candidateState = owned.get(candidate)!;
              try { await fs.rename(candidate, file); }
              finally {
                const current = await read(file);
                if (sameFile(current, candidateState)) published = candidateState;
                else uncertainPublication = !sameFile(current, original);
              }
              if (!published) throw new Error('Migration publication could not be verified; preserve recovery materials.');
            }
            await ledger('committed', {planDigest: plan.planDigest, source: snapshot.path, targetHash: plan.proposal?.source === null ? null : hash(Buffer.from(plan.proposal?.source ?? snapshot.source))});
            committed = true; snapshots.delete(snapshot);
            try { await cleanupStage(); } finally { await release(); }
          },
        };
      } catch (cause) {
        try { await abort(); } catch (recovery) { throw new AggregateError([cause, recovery], 'Migration preparation failed; recovery requires attention.', {cause}); }
        throw cause;
      }
    },
  };
}
