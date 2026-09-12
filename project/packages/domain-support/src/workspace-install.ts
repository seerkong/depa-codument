import * as nodeFs from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { WorkspaceInstallDefinition, WorkspaceInstallPort, WorkspaceInstallOptions, WorkspaceInstallTargets } from 'depa-codument-domain-contract';

type FileSystem = Pick<typeof nodeFs, 'lstat' | 'realpath' | 'readFile' | 'readdir' | 'open' | 'mkdir' | 'mkdtemp' | 'rename' | 'link' | 'unlink' | 'rmdir'>;
interface Identity { dev: number; ino: number; mode?: number }
interface FileState extends Identity { source: string; mode: number }
interface Publication { path: string; next: FileState; before?: FileState; backup?: string }
const identical = (a: Identity | undefined, b: Identity | undefined) => Boolean(a && b && a.dev === b.dev && a.ino === b.ino);
const sameDirectory = (a: Identity | undefined, b: Identity | undefined) => identical(a, b) && a?.mode === b?.mode;
const sameFile = (a: FileState | undefined, b: FileState | undefined) => a === undefined ? b === undefined : identical(a, b) && a.source === b?.source && a.mode === b.mode;
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT';

/** Product filesystem effect. Cooperative exclusion + observed identity/content
 * guards, not a claim of filesystem CAS against arbitrary external editors.
 * No recursive deletion and no writes to an existing App. */
export function createFileWorkspaceInstallPort(workspaceRoot: string,
  mergeAgents: (source: string, block: string) => string,
  selectTargets: (options?: WorkspaceInstallOptions, stored?: string) => WorkspaceInstallTargets,
  fs: FileSystem = nodeFs): WorkspaceInstallPort {
  const root = resolve(workspaceRoot);
  const app = join(root, 'codument'), lock = join(root, '.codument-install.lock');
  const stat = async (path: string) => { try { return await fs.lstat(path); } catch (e) { if (missing(e)) return undefined; throw e; } };
  const checkParents = async (path: string) => {
    if (path !== root && (!path.startsWith(root + '/') || relative(root, path).split('/').includes('..'))) throw new Error('Install path escapes workspace.');
    for (let cursor = path; ; cursor = dirname(cursor)) {
      const value = await stat(cursor);
      if (value && (!value.isDirectory() || value.isSymbolicLink())) throw new Error(`Unsafe install directory: ${cursor}`);
      if (cursor === root) break;
    }
  };
  const read = async (path: string): Promise<FileState | undefined> => {
    await checkParents(dirname(path));
    const before = await stat(path);
    if (!before) return undefined;
    if (!before.isFile() || before.isSymbolicLink()) throw new Error(`Unsafe install file: ${path}`);
    const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      if (!identical(await handle.stat(), before)) throw new Error(`Install source identity drift: ${path}`);
      bytes = await handle.readFile();
    } finally { await handle.close(); }
    const after = await stat(path);
    if (!identical(before, after) || before.size !== bytes.length || before.mtimeMs !== after?.mtimeMs) throw new Error(`Install source drift: ${path}`);
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return { dev: before.dev, ino: before.ino, mode: before.mode & 0o777, source };
  };
  const portable = (path: string) => {
    if (!path || path.includes('\\') || /[\x00-\x1f]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error(`Invalid installation asset path: ${path}`);
    return path;
  };
  return { async prepare(definition: WorkspaceInstallDefinition) {
    if (await fs.realpath(root) !== root) throw new Error('Installation root must be a real directory, not a symlink path.');
    await checkParents(root);
    const workspaceIdentity = (await stat(root))!;
    const requireWorkspace = async () => {
      if (!sameDirectory(await stat(root), workspaceIdentity)) throw new Error('Installation workspace root changed.');
    };
    const agentConfiguration = await read(join(app, 'config/cli-tools.json'));
    const targets = selectTargets(definition.options, agentConfiguration?.source);
    for (const directory of targets.directories) {
      portable(directory);
      const first = directory.split('/')[0]!.toLowerCase();
      if (first === 'codument' || first === '.codument' || first.startsWith('.codument-install')) throw new Error('Agent Skill target cannot contain the formal App or private Host state.');
    }
    const appFiles = [...definition.appFiles, { path: 'config/cli-tools.json', source: targets.configuration }];
    const files = [...appFiles.map(file => ({ ...file, path: `codument/${portable(file.path)}` })),
      ...targets.directories.flatMap(directory => definition.skillFiles.map(file => ({ ...file, path: `${directory}/${portable(file.path)}` })))];
    if (new Set(files.map(file => file.path)).size !== files.length) throw new Error('Duplicate installation asset path.');
    for (const file of definition.appFiles) if (file.path.split('/').some(p => p === 'KindDefinitions' || p.startsWith('.'))) throw new Error('App installation cannot distribute hidden sources or KindDefinitions.');
    for (const path of definition.appDirectories) portable(path);
    const lockHandle = await fs.open(lock, 'wx', 0o600).catch(error => { throw new Error(`Workspace installation is locked or cannot reserve ${lock}: ${String(error)}`); });
    const lockIdentity = await lockHandle.stat();
    const ownedFiles = new Map<string, FileState>(), ownedDirs = new Map<string, Identity>();
    const publications: Publication[] = [];
    const retirements: { path: string; backup: string; before: FileState; moved: boolean }[] = [];
    let staging: string | undefined, appIdentity: Identity | undefined, committed = false, closed = false;
    const directoriesCreated: string[] = [];
    const mkdir = async (path: string) => {
      await requireWorkspace();
      await checkParents(path);
      if (await stat(path)) return;
      await mkdir(dirname(path));
      await fs.mkdir(path);
      ownedDirs.set(path, (await stat(path))!); directoriesCreated.push(path);
    };
    const write = async (path: string, source: string, mode = 0o644) => {
      await mkdir(dirname(path));
      const handle = await fs.open(path, 'wx', mode);
      try { await handle.writeFile(source); await handle.chmod(mode); await handle.sync(); }
      finally { await handle.close(); }
      const state = (await read(path))!; ownedFiles.set(path, state); return state;
    };
    const assertOwnedAppTree = async (location: string) => {
      const stagedApp = join(staging!, 'codument');
      if (!sameDirectory(await stat(location), ownedDirs.get(stagedApp))) throw new Error('App directory changed.');
      const expectedFiles = new Map([...ownedFiles].filter(([path]) => path.startsWith(stagedApp + '/'))
        .map(([path, state]) => [join(location, relative(stagedApp, path)), state]));
      const expectedDirectories = new Set([...ownedDirs.keys()].filter(path => path.startsWith(stagedApp + '/')));
      const observedFiles = new Set<string>(), observedDirectories = new Set<string>();
      const visit = async (path: string): Promise<void> => {
        for (const name of await fs.readdir(path)) {
          const child = join(path, name), value = await stat(child);
          if (value?.isDirectory() && !value.isSymbolicLink()) {
            const original = join(stagedApp, relative(location, child));
            if (!sameDirectory(value, ownedDirs.get(original))) throw new Error('App directory changed.');
            observedDirectories.add(original); await visit(child);
          } else {
            if (!sameFile(await read(child), expectedFiles.get(child))) throw new Error('App content changed.');
            observedFiles.add(child);
          }
        }
      };
      await visit(location);
      if (observedFiles.size !== expectedFiles.size || observedDirectories.size !== expectedDirectories.size) throw new Error('App closure changed.');
    };
    const cleanup = async () => {
      const retained: string[] = [];
      for (const [path, state] of [...ownedFiles].reverse()) {
        try { const current = await read(path); if (!current) continue;
          if (!sameFile(current, state)) { retained.push(path); continue; }
          await fs.unlink(path);
        } catch { retained.push(path); }
      }
      for (const path of [...directoriesCreated].reverse()) {
        try { const current = await stat(path); if (!current) continue;
          if (!sameDirectory(current, ownedDirs.get(path))) { retained.push(path); continue; }
          await fs.rmdir(path);
        } catch { retained.push(path); }
      }
      return retained;
    };
    const release = async () => {
      if (closed) return;
      await lockHandle.close(); closed = true;
      if (!identical(await stat(lock), lockIdentity)) throw new Error(`Install lock changed; not removed: ${lock}`);
      await fs.unlink(lock);
    };
    const rollback = async () => {
      if (committed || closed) return;
      const retained: string[] = [];
      // Roll back only exact content and inode written by this transaction.
      for (const retired of [...retirements].reverse().filter(file => file.moved)) {
        try {
          if (await stat(retired.path) || !sameFile(await read(retired.backup), retired.before)) throw new Error('Retired Skill or its target changed.');
          try { await fs.rename(retired.backup, retired.path); }
          catch (error) { if (!sameFile(await read(retired.path), retired.before)) throw error; }
        } catch { retained.push(retired.path); }
      }
      for (const publication of [...publications].reverse()) {
        try {
          const current = await read(publication.path);
          if (!sameFile(current, publication.next)) { retained.push(publication.path); continue; }
          if (publication.backup) {
            const backup = await read(publication.backup);
            if (!sameFile(backup, ownedFiles.get(publication.backup))) throw new Error('Recovery backup changed.');
            try { await fs.rename(publication.backup, publication.path); }
            catch (error) { if (!sameFile(await read(publication.path), backup)) throw error; }
          } else {
            try { await fs.unlink(publication.path); }
            catch (error) { if (await stat(publication.path)) throw error; }
          }
        } catch { retained.push(publication.path); }
      }
      if (appIdentity) {
        try {
          if (!sameDirectory(await stat(app), appIdentity)) throw new Error('App destination changed.');
          // A renamed tree is moved back only if its complete closure is unchanged.
          await assertOwnedAppTree(app);
          try { await fs.rename(app, join(staging!, 'codument')); }
          catch (error) { if (!identical(await stat(join(staging!, 'codument')), appIdentity) || await stat(app)) throw error; }
          appIdentity = undefined;
        } catch { retained.push(app); }
      }
      if (retained.length) {
        await release();
        throw new Error(`Independent changes retained at ${retained.join(', ')}; recovery material: ${staging}`);
      }
      const leftovers = await cleanup(); await release();
      if (leftovers.length) throw new Error(`Installation recovery material retained: ${leftovers.join(', ')}`);
    };
    try {
      await lockHandle.writeFile(JSON.stringify({ operation: 'workspace-install', pid: process.pid }));
      staging = await fs.mkdtemp(join(root, '.codument-install-'));
      ownedDirs.set(staging, (await stat(staging))!); directoriesCreated.push(staging);
      const existingApp = await stat(app);
      if (existingApp && (!existingApp.isDirectory() || existingApp.isSymbolicLink())) throw new Error('Existing codument is not a regular App directory.');
      if (existingApp && !agentConfiguration) throw new Error('Existing App without stored agent configuration requires migration or review.');
      if (definition.retiredSkillFiles?.length && !definition.retainRecovery) throw new Error('Skill retirement requires durable recovery storage.');
      for (const file of targets.directories.flatMap(directory => (definition.retiredSkillFiles ?? []).map(file => ({ ...file, path: directory + '/' + portable(file.path) })))) {
        portable(file.path);
        if (!targets.directories.some(directory => file.path.startsWith(directory + '/')) || files.some(write => write.path === file.path)
          || retirements.some(retired => retired.path === join(root, file.path))) throw new Error('Retired Skill path is outside selected targets or conflicts.');
        const path = join(root, file.path), before = await read(path);
        if (!before) continue;
        if (before.source !== file.source) throw new Error(`Modified legacy Skill requires review: ${file.path}`);
        const backup = join(staging, 'retired', file.path);
        await mkdir(dirname(backup));
        retirements.push({ path, backup, before, moved: false });
      }
      const pending: { path: string; source: string; before?: FileState; staged?: string; backup?: string }[] = [];
      for (const file of files.filter(f => !f.path.startsWith('codument/'))) {
        const path = join(root, file.path), before = await read(path);
        if (before && before.source !== file.source) throw new Error(`Existing Skill differs; initialization will not overwrite ${path}. Use reviewed migration.`);
        if (!before) pending.push({ path, source: file.source });
      }
      for (const instruction of targets.instructionFiles) {
        if (instruction !== 'AGENTS.md' && instruction !== 'CLAUDE.md') throw new Error('Unsupported root instruction file.');
        const path = join(root, instruction), before = await read(path);
        const source = mergeAgents(before?.source ?? '', definition.agentsBlock);
        if (before?.source !== source) pending.push({ path, source, before });
      }
      if (!existingApp) {
        await mkdir(join(staging, 'codument'));
        for (const directory of definition.appDirectories) await mkdir(join(staging, 'codument', directory));
        for (const file of files.filter(f => f.path.startsWith('codument/'))) await write(join(staging, file.path), file.source);
      }
      for (const [index, file] of pending.entries()) {
        file.staged = join(staging, 'publication', String(index));
        await write(file.staged, file.source, file.before?.mode);
        if (file.before) { file.backup = join(staging, 'before', String(index)); await write(file.backup, file.before.source, file.before.mode); }
      }
      await write(join(staging, 'recovery.json'), JSON.stringify({ operation: 'workspace-install', root, createdApp: !existingApp,
        retired: retirements.map(file => ({ path: relative(root, file.path), backup: relative(staging!, file.backup), digest: createHash('sha256').update(file.before.source).digest('hex') })),
        files: pending.map(f => ({ path: relative(root, f.path), staged: relative(staging!, f.staged!), backup: f.backup && relative(staging!, f.backup),
          beforeDigest: f.before && createHash('sha256').update(f.before.source).digest('hex') })) }, null, 2), 0o600);
      let attempted = false;
      return {
        validationRoot: existingApp ? root : staging,
        abort: rollback,
        async commit() {
          if (attempted || closed) throw new Error('Installation transaction is no longer pending.');
          attempted = true;
          await requireWorkspace();
          if (!identical(await stat(lock), lockIdentity)) throw new Error('Installation lock drift.');
          if (!sameFile(await read(join(app, 'config/cli-tools.json')), agentConfiguration)) throw new Error('Agent installation configuration drift.');
          if (existingApp ? !identical(await stat(app), existingApp) : Boolean(await stat(app))) throw new Error('App destination drift.');
          for (const file of pending) if (!sameFile(await read(file.path), file.before)) throw new Error(`Installation source drift: ${file.path}`);
          for (const file of retirements) if (!sameFile(await read(file.path), file.before)) throw new Error(`Retired Skill source drift: ${file.path}`);
          for (const file of pending) {
            if (!sameFile(await read(file.staged!), ownedFiles.get(file.staged!))) throw new Error('Staged publication changed.');
            if (file.backup && !sameFile(await read(file.backup), ownedFiles.get(file.backup))) throw new Error('Recovery backup changed.');
          }
          if (!existingApp) {
            await assertOwnedAppTree(join(staging!, 'codument'));
            // Reserve a directory; rename may replace only this still-empty inode.
            await fs.mkdir(app); const reservation = (await stat(app))!;
            ownedDirs.set(app, reservation); directoriesCreated.push(app);
            if (!identical(await stat(app), reservation) || (await fs.readdir(app)).length) throw new Error('App reservation changed.');
            const candidate = (await stat(join(staging!, 'codument')))!;
            try { await fs.rename(join(staging!, 'codument'), app); }
            finally { if (identical(await stat(app), candidate)) appIdentity = candidate; }
          }
          for (const file of pending) {
            await mkdir(dirname(file.path));
            if (!sameFile(await read(file.path), file.before)) throw new Error(`Installation source drift: ${file.path}`);
            const next = ownedFiles.get(file.staged!)!;
            try {
              if (file.before) await fs.rename(file.staged!, file.path);
              else await fs.link(file.staged!, file.path); // atomic no-clobber
            } finally {
              if (identical(await stat(file.path), next)) publications.push({ path: file.path, next, before: file.before, backup: file.backup });
            }
          }
          for (const file of retirements) {
            if (!sameFile(await read(file.path), file.before) || await stat(file.backup)) throw new Error(`Retired Skill source drift: ${file.path}`);
            try { await fs.rename(file.path, file.backup); }
            finally { if (sameFile(await read(file.backup), file.before)) { file.moved = true; ownedFiles.set(file.backup, file.before); } }
          }
          committed = true;
          // Published paths are no longer cleanup targets; only scratch is retired.
          const publishedParents = new Set(directoriesCreated.filter(p => !p.startsWith(staging! + '/') && p !== staging));
          for (const path of publishedParents) ownedDirs.delete(path);
          for (let i = directoriesCreated.length - 1; i >= 0; i--) if (publishedParents.has(directoriesCreated[i]!)) directoriesCreated.splice(i, 1);
          const preserveRecovery = definition.retainRecovery && (pending.length > 0 || retirements.length > 0);
          const leftovers = preserveRecovery ? [] : await cleanup(); await release();
          if (leftovers.length) throw new Error(`Installation committed; scratch cleanup requires review: ${leftovers.join(', ')}`);
          return { createdApp: !existingApp, backupPath: preserveRecovery ? staging : undefined,
            writtenFiles: [...(!existingApp ? appFiles.map(f => `codument/${f.path}`) : []), ...pending.map(f => relative(root, f.path)), ...retirements.map(f => relative(root, f.path))] };
        },
      };
    } catch (error) {
      try { await rollback(); } catch (recoveryError) { throw new AggregateError([error, recoveryError], 'Installation preparation failed with retained recovery material.'); }
      throw error;
    }
  } };
}
