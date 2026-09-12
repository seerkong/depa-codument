import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { LifecycleKind, LifecycleStage, LifecycleUpdate, TrackLinkTarget } from 'depa-codument-domain-contract/lifecycle';
import type {
  LifecycleCommitReceipt, LifecycleRef, LifecycleRepositoryPort, LifecycleSourceCodec, OwnedLifecycleSnapshot,
} from 'depa-codument-domain-contract/operations';
import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';
import { observeFileLifecycle } from './lifecycle-observation';

export interface FileLifecycleLocation {
  readonly workspaceRoot: string;
  readonly resourceDirectory: string;
}
export interface FileLifecycleRepositorySpec extends FileLifecycleLocation {
  /** Explicit local ProjectRef bindings; never persist physical roots in receipts. */
  readonly projects?: Readonly<Record<string, FileLifecycleLocation>>;
}
export interface FileLifecycleRepositoryBindings {
  readonly codec: LifecycleSourceCodec;
  /** Recheck the observed product context before admitting or publishing work. */
  readonly assertContextCurrent?: () => Promise<void>;
  readonly observeLocationContext?: (location: FileLifecycleLocation) => Promise<Pick<FileLifecycleRepositoryBindings, 'codec' | 'assertContextCurrent'>>;
  /** Pure naming policy supplied by the product, e.g. date + stable ID. */
  archiveName(update: LifecycleUpdate): string;
}
/** Narrow platform mutation binding, also usable for deterministic fault tests. */
export interface LifecycleFileMutations {
  rename(source: string, destination: string): Promise<void>;
  unlink(file: string): Promise<void>;
  rmdir(directory: string): Promise<void>;
}

/** Local filesystem transaction boundary. The workspace-wide lock serializes
 * cooperating writers (including different instances/processes), with no stale
 * lock stealing. CAS checks preserve observed manual edits, but cannot exclude an
 * arbitrary editor racing the final rename. A crash leaves the lock/journal for
 * recovery; this adapter does not claim crash-atomic multi-file publication. */
export function createFileLifecycleRepository(
  input: FileLifecycleRepositorySpec,
  supplied: FileLifecycleRepositoryBindings,
  mutations: LifecycleFileMutations = fs,
): LifecycleRepositoryPort {
  const spec = structuredClone(input);
  const codec = { ...supplied.codec };
  const archiveName = supplied.archiveName;
  const assertContextCurrent = supplied.assertContextCurrent;
  const observeLocationContext = supplied.observeLocationContext;
  const instance = randomUUID();
  const workspace = createWorkspaceEffect(spec.workspaceRoot);
  portable(spec.resourceDirectory);
  for (const location of Object.values(spec.projects ?? {})) {
    createWorkspaceEffect(location.workspaceRoot);
    portable(location.resourceDirectory);
  }
  const lock = spec.resourceDirectory + '/.lifecycle-write.lock';
  const absolute = (file: string) => path.join(spec.workspaceRoot, file);
  const revision = (file: string, content: string) => createHash('sha256').update(JSON.stringify([instance, file, content])).digest('hex');

  async function unlocked(): Promise<void> {
    if (await workspace.exists(lock)) throw new Error(`Lifecycle writer lock exists; inspect retained transaction before retrying: ${lock}`);
  }

  async function locate(ref: LifecycleRef, includeArchived: boolean): Promise<OwnedLifecycleSnapshot & { content: string }> {
    const found = await observeFileLifecycle({...spec, ref, codec, revision});
    if (!found || (!includeArchived && found.stage === 'archived')) throw new Error(`${ref.kind} '${ref.id}' has no eligible lifecycle authority.`);
    return found;
  }

  async function load(ref: LifecycleRef, options: { includeArchived: boolean }): Promise<OwnedLifecycleSnapshot> {
    const request = { ...ref };
    await unlocked();
    await assertContextCurrent?.();
    const { content: _content, ...snapshot } = await locate(request, options.includeArchived);
    await unlocked();
    await assertContextCurrent?.();
    return snapshot;
  }

  async function readAuthority(file: string): Promise<string | undefined> {
    const kind = await workspace.kind(file);
    if (kind === undefined) return undefined;
    if (kind !== 'file' || !(await fs.stat(absolute(file))).isFile()) throw new Error(`Lifecycle authority is not a regular file: ${file}`);
    const bytes = await fs.readFile(absolute(file));
    const text = bytes.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error(`Lifecycle source is not valid UTF-8; retain it for review: ${file}`);
    return text;
  }

  async function boundTrack(trackId: string, projectRef?: string): Promise<OwnedLifecycleSnapshot> {
    const location = projectRef ? spec.projects?.[projectRef] : undefined;
    if (location) {
      const sameOwner = location.resourceDirectory === spec.resourceDirectory
        && await fs.realpath(location.workspaceRoot) === await fs.realpath(spec.workspaceRoot);
      if (!sameOwner) {
        const context = await observeLocationContext?.(location) ?? { codec };
        return createFileLifecycleRepository(location, { ...context, archiveName }).load({ kind: 'track', id: trackId }, { includeArchived: true });
      }
    }
    return locate({ kind: 'track', id: trackId }, true);
  }

  async function resolveTrack(trackId: string, request: { projectRef?: string; projectKind: 'host' | 'external' }): Promise<TrackLinkTarget> {
    const { projectRef, projectKind } = { ...request };
    if (projectKind !== 'host' && projectKind !== 'external') throw new Error('Unsupported ProjectRef kind.');
    const location = projectRef ? spec.projects?.[projectRef] : undefined;
    if (projectKind === 'external' && !location) throw new Error(`ProjectRef '${projectRef}' is not bound to a local workspace.`);
    await unlocked();
    await assertContextCurrent?.();
    const found = await boundTrack(trackId, projectRef);
    await unlocked();
    await assertContextCurrent?.();
    return { trackId, authority: found.file, ...(projectRef ? { projectRef } : {}) };
  }

  async function commit(sourceInput: OwnedLifecycleSnapshot, updateInput: LifecycleUpdate, bindingInput?: TrackLinkTarget): Promise<LifecycleCommitReceipt> {
    const source = structuredClone(sourceInput);
    const update = structuredClone(updateInput);
    const binding = bindingInput ? { ...bindingInput } : undefined;
    if (update.kind !== source.kind || update.id !== source.id) throw new Error('Lifecycle proposal has mismatched authority.');
    if (!(['pending', 'active', 'archived'] as LifecycleStage[]).includes(update.stage)) throw new Error('Unknown lifecycle destination stage.');
    await workspace.makeDirectory(spec.resourceDirectory);
    await workspace.kind(lock); // Reject a symlink before attempting exclusive mkdir.
    try { await fs.mkdir(absolute(lock)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Lifecycle writer lock exists; inspect retained transaction before retrying: ${lock}`);
      throw error;
    }
    let moved = false;
    let destination = source.directory;
    let temporary: string | undefined;
    let report: string | undefined;
    let retainLock = false;
    let failure: unknown;
    let published = false;
    const warnings: string[] = [];
    try {
      await assertContextCurrent?.();
      const actual = await locate(source, true);
      if (actual.sourceRevision !== source.sourceRevision || actual.file !== source.file || actual.directory !== source.directory || actual.stage !== source.stage) {
        throw new Error('Lifecycle source changed; reload before committing.');
      }
      const proposed = codec.patch(actual.content, source.root, update.root);
      if (codec.inspect(proposed, source.kind).id !== source.id) throw new Error('Lifecycle patch changed root identity.');
      if (binding) {
        const track = await boundTrack(binding.trackId, binding.projectRef);
        if (track.file !== binding.authority) throw new Error('Bound Track authority changed; resolve it again before committing.');
      }
      if (update.stage !== source.stage) {
        const name = update.stage === 'archived' ? archiveName(update) : source.id;
        portable(name);
        if (name.includes('/')) throw new Error('Lifecycle archive name must be a single directory segment.');
        destination = `${spec.resourceDirectory}/${source.kind}s/${update.stage}/${name}`;
        if (await workspace.exists(destination)) throw new Error(`Occupied lifecycle destination: ${destination}`);
        await safeTree(source.directory);
      }
      portable(destination);
      const journal = lock + '/transaction.json';
      await fs.writeFile(absolute(journal), JSON.stringify({
        version: 1, source: source.file, destination, phase: 'prepared',
        sourceDigest: createHash('sha256').update(actual.content).digest('hex'),
        proposalDigest: createHash('sha256').update(proposed).digest('hex'),
      }, null, 2), { flag: 'wx' });
      if (destination !== source.directory) {
        await workspace.makeDirectory(path.posix.dirname(destination));
        if (await workspace.exists(destination)) throw new Error(`Occupied lifecycle destination: ${destination}`);
        await mutations.rename(absolute(source.directory), absolute(destination));
        moved = true;
      }
      const targetFile = destination + '/' + source.kind + '.xnl';
      if (binding) {
        portable(binding.authority);
        identifier(binding.trackId);
        await workspace.makeDirectory(destination + '/reports');
        for (let number = 1; ; number++) {
          const candidate = `${destination}/reports/track-bind-cli-${String(number).padStart(3, '0')}.md`;
          await workspace.kind(candidate);
          let handle: fs.FileHandle;
          try {
            handle = await fs.open(absolute(candidate), 'wx');
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            continue;
          }
          report = candidate;
          try { await handle.writeFile(bindingReport(source, update, binding)); }
          finally { await handle.close(); }
          break;
        }
      }
      temporary = `${destination}/.${source.kind}.xnl-${randomUUID()}.tmp`;
      await workspace.kind(targetFile);
      const mode = (await fs.stat(absolute(targetFile))).mode & 0o777;
      await fs.writeFile(absolute(temporary), proposed, { flag: 'wx', mode });
      // Creation applies the process umask; restore the source's exact mode.
      await fs.chmod(absolute(temporary), mode);
      if (await readAuthority(targetFile) !== actual.content) throw new Error('Lifecycle source changed before publication; reload before committing.');
      await assertContextCurrent?.();
      await mutations.rename(absolute(temporary), absolute(targetFile));
      temporary = undefined;
      published = true; // No rejecting cleanup operation may follow this boundary.
    } catch (error) {
      failure = error;
      const rollbackErrors: unknown[] = [];
      for (const file of [temporary, report]) {
        if (file) try { await mutations.unlink(absolute(file)); } catch (cleanup) {
          if ((cleanup as NodeJS.ErrnoException).code !== 'ENOENT') rollbackErrors.push(cleanup);
        }
      }
      if (moved) {
        try {
          if (await workspace.exists(source.directory)) throw new Error('Source directory became occupied during rollback.');
          await workspace.kind(destination);
          await mutations.rename(absolute(destination), absolute(source.directory));
        } catch (rollback) { rollbackErrors.push(rollback); }
      }
      if (rollbackErrors.length) {
        retainLock = true;
        failure = new AggregateError([error, ...rollbackErrors], `Lifecycle rollback needs recovery; retain transaction at ${lock}`);
      }
    } finally {
      if (!retainLock) {
        try {
          const journal = lock + '/transaction.json';
          if (await workspace.exists(journal)) await mutations.unlink(absolute(journal));
          await mutations.rmdir(absolute(lock));
        } catch (cleanup) {
          if (published) warnings.push(`Lifecycle committed; lock cleanup needs attention at ${lock}: ${String(cleanup)}`);
          else failure = new AggregateError([failure, cleanup], `Lifecycle cleanup needs attention at ${lock}`);
        }
      }
    }
    if (!published) throw failure;
    return { directory: destination, ...(warnings.length ? { maintenanceWarnings: warnings } : {}) };
  }

  async function safeTree(directory: string): Promise<void> {
    if (await workspace.kind(directory) !== 'directory') throw new Error(`Lifecycle move source disappeared: ${directory}`);
    for (const entry of await fs.readdir(absolute(directory), { withFileTypes: true })) {
      const file = directory + '/' + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Lifecycle move contains a symlink: ${file}`);
      if (entry.isDirectory()) await safeTree(file);
      else if (!entry.isFile()) throw new Error(`Unsupported lifecycle file: ${file}`);
    }
  }

  return { load, commit, resolveTrack };
}

function portable(value: string): void {
  if (!value || value.startsWith('/') || value.includes('\\') || /^[A-Za-z]:/.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..') || /[\x00-\x1f`]/.test(value)) {
    throw new Error('Lifecycle storage requires a portable relative path.');
  }
}

function identifier(value: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value) || value === '.' || value === '..') {
    throw new Error('Lifecycle identity or directory name is invalid.');
  }
}

function bindingReport(source: OwnedLifecycleSnapshot, update: LifecycleUpdate, binding: TrackLinkTarget): string {
  return [
    '# Track Bind CLI Receipt', '',
    `- Mission task: \`${update.subject.slice(source.id.length + 1)}\``,
    `- Track: \`${binding.trackId}\``,
    `- Track authority: \`${binding.authority}\``,
    '- State: `bound`',
    `- Bound at: \`${String(update.root.attributes?.updated_at ?? '')}\``, '',
  ].join('\n');
}
