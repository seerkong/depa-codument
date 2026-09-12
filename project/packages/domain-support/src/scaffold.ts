import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { DomainSourceSnapshot, LifecycleSourceCodec, ScaffoldLocation, ScaffoldRequest, ScaffoldSourcePort } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';
import { createFileDomainSourceWritePort } from './decision-write';

interface Observation { readonly location: ScaffoldLocation; readonly trackFile?: string; readonly trackSource?: string; readonly delta?: DomainSourceSnapshot }

/** One domain-owned creation transaction. Shares the lifecycle writer lock;
 * staging is private and only a complete directory is published. No stale-lock
 * stealing or crash-atomic guarantee against arbitrary external editors. */
export function createFileScaffoldSourcePort(workspaceRoot: string, codec: Pick<LifecycleSourceCodec, 'inspect'>,
  mutations: Pick<typeof fs, 'rename'> = fs): ScaffoldSourcePort {
  const root = path.resolve(workspaceRoot), workspace = createWorkspaceEffect(root);
  const writes = createFileDomainSourceWritePort(root);
  const observations = new WeakMap<ScaffoldLocation, Observation>();
  const lock = 'codument/.lifecycle-write.lock';
  const absolute = (file: string) => path.join(root, file);
  async function unlocked(): Promise<void> {
    if (await workspace.kind(lock) !== undefined) throw new Error('Lifecycle writer lock exists; inspect retained transaction before retrying.');
  }
  function assertInput(input: ScaffoldRequest): void {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input.id)) throw new Error('Unsafe scaffold identity.');
    if (input.kind === 'BehaviorPatch') {
      if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(input.capability)) throw new Error('Unsafe scaffold capability.');
    } else if (!['Track', 'Mission'].includes(input.kind) || !['active', 'pending'].includes(input.stage)) throw new Error('Unsafe scaffold kind/stage.');
  }
  async function gitHead(): Promise<string | undefined> {
    return new Promise(resolve => execFile('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, timeout: 5000 }, (error, stdout) => resolve(error ? undefined : stdout.trim() || undefined)));
  }
  return {
    async observe(request) {
      const input = Object.freeze(structuredClone(request));
      assertInput(input);
      if (await workspace.kind('codument') !== 'directory') throw new Error('Codument is not initialized. Run codument init first.');
      await unlocked();
      let stage: 'pending' | 'active', directory: string;
      let trackFile: string | undefined, trackSource: string | undefined, delta: DomainSourceSnapshot | undefined;
      if (input.kind === 'BehaviorPatch') {
        const candidates: { stage: 'pending' | 'active'; directory: string }[] = [];
        for (const stage of ['pending', 'active'] as const) {
          const directory = `codument/tracks/${stage}/${input.id}`;
          if (await workspace.kind(directory) === 'directory') candidates.push({ stage, directory });
        }
        if (candidates.length !== 1) throw new Error(`Track '${input.id}' has ${candidates.length} eligible authorities; require exactly one pending or active Track.`);
        const owner = candidates[0];
        stage = owner.stage;
        trackFile = owner.directory + '/track.xnl';
        if (await workspace.kind(owner.directory + '/track.xml') !== undefined) throw new Error('Legacy Track requires migration or review.');
        trackSource = await workspace.readText(trackFile);
        if (trackSource === undefined || codec.inspect(trackSource, 'track').id !== input.id) throw new Error('Track scaffold owner is missing or mismatched.');
        directory = owner.directory + '/behavior_deltas/' + input.capability;
        if (await workspace.kind(directory + '/delta.xml') !== undefined) throw new Error('BehaviorPatch already exists or requires migration.');
        delta = await writes.read(directory + '/delta.xnl');
        if (delta.source !== undefined) throw new Error('BehaviorPatch already exists.');
      } else {
        stage = input.stage;
        directory = `codument/${input.kind.toLowerCase()}s/${stage}/${input.id}`;
        if (await workspace.kind(directory) !== undefined) throw new Error(`${input.kind} '${input.id}' already exists in ${directory}`);
      }
      const location = Object.freeze({ request: input, stage, directory, sourceRevision: randomUUID(), gitHead: input.kind === 'Track' ? await gitHead() : undefined });
      await unlocked();
      observations.set(location, { location, trackFile, trackSource, delta });
      return location;
    },
    async publish(location, proposed) {
      const observed = observations.get(location);
      if (!observed) throw new Error('Unknown scaffold source handle.');
      const files = { ...proposed };
      const expected = observed.delta ? ['delta.xnl'] : [location.request.kind.toLowerCase() + '.xnl', 'proposal.md', 'design.md'];
      if (JSON.stringify(Object.keys(files).sort()) !== JSON.stringify([...expected].sort()) || Object.values(files).some(value => typeof value !== 'string')) throw new Error('Scaffold file closure does not match the resource contract.');
      let locked = false, staged: string | undefined, reservation: { ino: number; dev: number } | undefined;
      let published = false, failure: unknown;
      const warnings: string[] = [];
      try {
        await workspace.kind(lock);
        await fs.mkdir(absolute(lock), { mode: 0o700 });
        locked = true;
        if (observed.delta) {
          if (await workspace.readText(observed.trackFile!) !== observed.trackSource) throw new Error('Track source changed before BehaviorPatch creation.');
          const otherStage = location.stage === 'active' ? 'pending' : 'active';
          if (await workspace.kind(`codument/tracks/${otherStage}/${location.request.id}`) !== undefined) throw new Error('Track authority became ambiguous before BehaviorPatch creation.');
          if (await workspace.kind(path.posix.dirname(observed.trackFile!) + '/track.xml') !== undefined) throw new Error('Track competing legacy authority appeared.');
          if (await workspace.kind(location.directory + '/delta.xml') !== undefined) throw new Error('BehaviorPatch competing legacy authority appeared.');
          const receipt = await writes.commit(observed.delta, files['delta.xnl']);
          warnings.push(...receipt.maintenanceWarnings ?? []);
          published = true;
        } else {
          const parent = path.posix.dirname(location.directory);
          await workspace.makeDirectory(parent);
          if (await workspace.kind(location.directory) !== undefined) throw new Error('Scaffold target already exists.');
          staged = await fs.mkdtemp(absolute(parent + '/.scaffold-'));
          for (const [file, content] of Object.entries(files)) {
            const handle = await fs.open(path.join(staged, file), 'wx', 0o644);
            try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
          }
          await workspace.kind(location.directory);
          await fs.mkdir(absolute(location.directory));
          const owned = await fs.lstat(absolute(location.directory));
          reservation = { ino: owned.ino, dev: owned.dev };
          await fs.chmod(staged, owned.mode & 0o777);
          await workspace.kind(location.directory);
          const current = await fs.lstat(absolute(location.directory));
          if (current.ino !== reservation.ino || current.dev !== reservation.dev) throw new Error('Scaffold target reservation changed before publication.');
          await mutations.rename(staged, absolute(location.directory));
          published = true;
          staged = undefined;
          reservation = undefined;
        }
        observations.delete(location);
      } catch (error) { failure = error; }
      finally {
        if (staged) {
          for (const file of expected) try { await fs.unlink(path.join(staged, file)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') warnings.push(String(error)); }
          try { await fs.rmdir(staged); } catch (error) { warnings.push(String(error)); }
        }
        if (reservation) try {
          const current = await fs.lstat(absolute(location.directory));
          if (current.ino === reservation.ino && current.dev === reservation.dev) await fs.rmdir(absolute(location.directory));
          else warnings.push('Scaffold target reservation changed; retained for inspection.');
        } catch (error) { warnings.push(String(error)); }
        if (locked) try { await fs.rmdir(absolute(lock)); } catch (error) { warnings.push(String(error)); }
      }
      if (!published) {
        if (warnings.length) throw new AggregateError([failure, ...warnings], 'Scaffold failed; cleanup requires attention.', { cause: failure });
        throw failure;
      }
      return warnings.length ? { maintenanceWarnings: warnings } : {};
    },
  };
}
