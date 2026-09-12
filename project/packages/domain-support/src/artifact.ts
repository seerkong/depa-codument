import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { ArtifactSyncPort, ArtifactSyncSnapshot } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';

interface FileState {bytes: Uint8Array; digest: string; mode: number; ino: number; dev: number}
interface Observation {source: string; target: string; sources: Map<string, FileState>; targets: Map<string, FileState>}
export interface ArtifactFileEffects {
  publish(stage: string, target: string, replace: boolean): Promise<void>;
  restore(backup: string, target: string): Promise<void>;
}
const fileEffects: ArtifactFileEffects = {
  async publish(stage, target, replace) {if (replace) await fs.rename(stage, target); else await fs.link(stage, target);},
  async restore(backup, target) {await fs.rename(backup, target);},
};

/** Explicit directory delivery, with cooperative target locking and retained
 * recovery evidence. No arbitrary-editor atomic CAS or global cwd mutation. */
export function createFileArtifactSyncPort(workspaceRoot: string, effects: ArtifactFileEffects = fileEffects): ArtifactSyncPort {
  const root = path.resolve(workspaceRoot), mutations = {...effects};
  const observations = new WeakMap<ArtifactSyncSnapshot, Observation>();
  function guard(absolute: string) {
    const relative = path.relative(root, absolute);
    const inside = relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    const base = inside ? root : path.parse(absolute).root;
    return createWorkspaceEffect(base).kind(path.relative(base, absolute));
  }
  async function read(file: string): Promise<FileState | undefined> {
    const kind = await guard(file);
    if (kind === undefined) return undefined;
    const stat = await fs.lstat(file);
    if (!stat.isFile()) throw new Error(`Artifact path must be a regular non-symlink file: ${file}`);
    const bytes = await fs.readFile(file);
    await guard(file);
    const after = await fs.lstat(file);
    if (after.ino !== stat.ino || after.dev !== stat.dev || after.mode !== stat.mode || after.size !== bytes.length) throw new Error(`Artifact changed while reading: ${file}`);
    return {bytes, digest: createHash('sha256').update(bytes).digest('hex'), mode: stat.mode & 0o777, ino: stat.ino, dev: stat.dev};
  }
  async function collect(source: string): Promise<Map<string, FileState>> {
    if (await guard(source) !== 'directory') throw new Error(`Artifact source directory does not exist: ${source}`);
    const files = new Map<string, FileState>();
    async function visit(relative: string) {
      const absolute = path.join(source, relative);
      if (await guard(absolute) !== 'directory') throw new Error('Artifact source directory changed.');
      for (const name of (await fs.readdir(absolute)).sort()) {
        const child = relative ? relative + '/' + name : name;
        if (await guard(path.join(source, child)) === 'directory') await visit(child);
        else {
          const file = await read(path.join(source, child));
          if (!file) throw new Error('Artifact source disappeared.');
          files.set(child, file);
        }
      }
    }
    await visit('');
    return files;
  }
  async function targets(target: string, files: ReadonlyMap<string, FileState>) {
    const kind = await guard(target);
    if (kind !== undefined && kind !== 'directory') throw new Error('Artifact target must be a directory.');
    const result = new Map<string, FileState>();
    for (const file of files.keys()) {
      const state = await read(path.join(target, file));
      if (state) result.set(file, state);
    }
    return result;
  }
  function same(a: FileState | undefined, b: FileState | undefined): boolean {
    return a?.digest === b?.digest && a?.mode === b?.mode && a?.ino === b?.ino && a?.dev === b?.dev;
  }
  function sameMap(a: ReadonlyMap<string, FileState>, b: ReadonlyMap<string, FileState>): boolean {
    return a.size === b.size && [...a].every(([file, state]) => same(state, b.get(file)));
  }
  async function stage(file: string, bytes: Uint8Array, mode: number) {
    const handle = await fs.open(file, 'wx', mode);
    try {await handle.writeFile(bytes); await handle.chmod(mode); await handle.sync();} finally {await handle.close();}
  }
  async function physicalPath(file: string): Promise<string> {
    if (await guard(file) !== undefined) return fs.realpath(file);
    return path.join(await physicalPath(path.dirname(file)), path.basename(file));
  }
  return {
    async observe(input) {
      const source = path.resolve(root, input.source), target = path.resolve(root, input.target);
      const inside = (a: string, b: string) => {const relative = path.relative(a, b); return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));};
      const physicalSource = await physicalPath(source), physicalTarget = await physicalPath(target);
      if (inside(physicalSource, physicalTarget) || inside(physicalTarget, physicalSource)) throw new Error('Artifact source and target trees must not overlap.');
      const sources = await collect(source), observedTargets = await targets(target, sources);
      const snapshot = Object.freeze({source, target, sourceRevision: randomUUID(),
        sources: new Map([...sources].map(([file, state]) => [file, state.digest])), targets: new Map([...observedTargets].map(([file, state]) => [file, state.digest]))});
      observations.set(snapshot, {source, target, sources, targets: observedTargets});
      return snapshot;
    },
    async publish(snapshot) {
      const observed = observations.get(snapshot);
      if (!observed) throw new Error('Unknown artifact source handle.');
      const changed = [...observed.sources].filter(([file, state]) => state.digest !== observed.targets.get(file)?.digest);
      async function assertCurrent() {
        if (!sameMap(await collect(observed!.source), observed!.sources) || !sameMap(await targets(observed!.target, observed!.sources), observed!.targets)) throw new Error('Artifact source or target changed before publication.');
      }
      if (!changed.length) {await assertCurrent(); observations.delete(snapshot); return {};}
      const lock = path.join(path.dirname(observed.target), '.' + path.basename(observed.target) + '.codument-artifact-sync.lock');
      const createdDirectories: string[] = [], attempted: {file: string; backup?: string; staged: FileState}[] = [];
      let locked = false, published = false, failure: unknown, recoveryRequired = false;
      let lockIdentity: {ino: number; dev: number} | undefined;
      const warnings: string[] = [];
      async function ensureDirectory(directory: string): Promise<void> {
        const kind = await guard(directory);
        if (kind === 'directory') return;
        if (kind !== undefined) throw new Error(`Artifact parent is not a directory: ${directory}`);
        await ensureDirectory(path.dirname(directory));
        try {await fs.mkdir(directory); createdDirectories.push(directory);}
        catch (error) {if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await guard(directory) !== 'directory') throw error;}
      }
      try {
        await ensureDirectory(path.dirname(lock));
        await guard(lock);
        await fs.mkdir(lock, {mode: 0o700}); locked = true;
        lockIdentity = await fs.lstat(lock);
        await assertCurrent();
        const entries: {file: string; stage: string; backup?: string; staged: FileState}[] = [];
        for (const [index, [file, state]] of changed.entries()) {
          const original = observed.targets.get(file), stagedFile = path.join(lock, `new-${index}`);
          const mode = original?.mode ?? (state.mode & ~process.umask());
          await stage(stagedFile, state.bytes, mode);
          const backup = original ? path.join(lock, `backup-${index}`) : undefined;
          if (backup) await stage(backup, original!.bytes, original!.mode);
          entries.push({file, stage: stagedFile, backup, staged: (await read(stagedFile))!});
        }
        await stage(path.join(lock, 'recovery.json'), new TextEncoder().encode(JSON.stringify({source: observed.source, target: observed.target,
          entries: entries.map(entry => ({path: entry.file, backup: entry.backup && path.basename(entry.backup), originalDigest: observed.targets.get(entry.file)?.digest, proposedDigest: entry.staged.digest}))}, null, 2)), 0o600);
        for (const entry of entries) {
          const target = path.join(observed.target, entry.file);
          await ensureDirectory(path.dirname(target));
          if (!same(await read(path.join(observed.source, entry.file)), observed.sources.get(entry.file)) || !same(await read(target), observed.targets.get(entry.file))) throw new Error('Artifact file changed before publication.');
          attempted.push(entry);
          await mutations.publish(entry.stage, target, observed.targets.has(entry.file));
          if (!same(await read(target), entry.staged)) throw new Error('Artifact publication did not produce the proposed file.');
        }
        const expectedTargets = new Map(observed.targets);
        for (const entry of entries) expectedTargets.set(entry.file, entry.staged);
        if (!sameMap(await collect(observed.source), observed.sources) || !sameMap(await targets(observed.target, observed.sources), expectedTargets)) throw new Error('Artifact sources or published targets changed during delivery.');
        published = true;
        observations.delete(snapshot);
      } catch (error) {
        failure = error;
        for (const entry of [...attempted].reverse()) {
          try {
            const target = path.join(observed.target, entry.file), actual = await read(target);
            if (same(actual, observed.targets.get(entry.file))) continue;
            if (!same(actual, entry.staged)) throw new Error(`Independent edit prevents artifact rollback: ${target}`);
            if (entry.backup) await mutations.restore(entry.backup, target);
            else await fs.unlink(target);
            const restored = await read(target), original = observed.targets.get(entry.file);
            if (restored?.digest !== original?.digest || restored?.mode !== original?.mode) throw new Error(`Artifact rollback did not restore ${target}`);
          } catch (restoreError) {recoveryRequired = true; warnings.push(String(restoreError));}
        }
      } finally {
        if (locked && !recoveryRequired) try {
          const current = await fs.lstat(lock);
          if (!current.isDirectory() || current.ino !== lockIdentity?.ino || current.dev !== lockIdentity?.dev) throw new Error(`Artifact lock ownership changed; cleanup requires attention at ${lock}`);
          await fs.rm(lock, {recursive: true});
        } catch (error) {warnings.push(String(error));}
        if (!published && !recoveryRequired) for (const directory of [...createdDirectories].reverse()) {
          try {await fs.rmdir(directory);} catch (error) {if (!['ENOTEMPTY', 'ENOENT', 'EEXIST'].includes((error as NodeJS.ErrnoException).code ?? '')) warnings.push(String(error));}
        }
      }
      if (!published) {
        if (recoveryRequired) throw new AggregateError([failure, ...warnings], `Artifact sync failed; recovery required. Backups preserved at ${lock}`, {cause: failure});
        if (warnings.length) throw new AggregateError([failure, ...warnings], 'Artifact sync failed; cleanup requires attention.', {cause: failure});
        throw failure;
      }
      return warnings.length ? {maintenanceWarnings: warnings} : {};
    },
  };
}
