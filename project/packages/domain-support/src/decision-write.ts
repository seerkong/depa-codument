import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DomainSourceSnapshot, DomainSourceWritePort } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';

/** Single-file domain source authority. Cooperative writers share a lock; arbitrary
 * editor drift is checked before publication, not claimed to be OS-atomic CAS. */
export function createFileDomainSourceWritePort(workspaceRoot: string): DomainSourceWritePort {
  const root = path.resolve(workspaceRoot);
  const records = new WeakMap<DomainSourceSnapshot, { source: string | undefined; mode?: number; ino?: number; dev?: number }>();
  function access(file: string) {
    const absolute = path.resolve(root, file);
    if (!absolute.toLowerCase().endsWith('.xnl')) throw new Error('Decision scaffold target must be an .xnl file.');
    const relative = path.relative(root, absolute);
    const inside = relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    const base = inside ? root : path.parse(absolute).root;
    return { absolute, relative: path.relative(base, absolute), port: createWorkspaceEffect(base) };
  }
  async function observe(file: string) {
    const target = access(file);
    const kind = await target.port.kind(target.relative);
    if (kind === 'directory') throw new Error('Decision authority must be a file.');
    if (kind === undefined) return { source: undefined };
    const stat = await fs.lstat(target.absolute);
    if (!stat.isFile()) throw new Error('Domain source must be a regular file.');
    await target.port.kind(target.relative);
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await fs.readFile(target.absolute));
    return { source, mode: stat.mode & 0o777, ino: stat.ino, dev: stat.dev };
  }
  return {
    async read(file) {
      const observation = await observe(file);
      const snapshot = Object.freeze({ file: access(file).absolute, source: observation.source, sourceRevision: randomUUID() });
      records.set(snapshot, observation);
      return snapshot;
    },
    async commit(snapshot, proposed) {
      const expected = records.get(snapshot);
      if (!expected) throw new Error('Unknown Decision source handle.');
      const target = access(snapshot.file);
      const directory = path.dirname(target.absolute);
      const lock = path.join(directory, '.' + path.basename(target.absolute) + '.write-lock');
      const stage = path.join(directory, '.' + path.basename(target.absolute) + '.' + randomUUID() + '.tmp');
      await target.port.makeDirectory(path.dirname(target.relative));
      let locked = false;
      let staged = false;
      let failure: unknown;
      let published = false;
      const cleanupErrors: unknown[] = [];
      try {
        await target.port.kind(path.relative(target.port.root, lock));
        await fs.mkdir(lock, { mode: 0o700 });
        locked = true;
        const sameSource = async () => {
          const actual = await observe(snapshot.file);
          if (actual.source !== expected.source || actual.mode !== expected.mode || actual.ino !== expected.ino || actual.dev !== expected.dev) {
            throw new Error('Decision source changed before commit.');
          }
        };
        await sameSource();
        const handle = await fs.open(stage, 'wx', expected.mode ?? 0o644);
        staged = true;
        try {
          await handle.writeFile(proposed, 'utf8');
          if (expected.mode !== undefined) await handle.chmod(expected.mode);
          await handle.sync();
        }
        finally { await handle.close(); }
        await sameSource();
        if (expected.source === undefined) await fs.link(stage, target.absolute);
        else { await fs.rename(stage, target.absolute); staged = false; }
        published = true;
        records.delete(snapshot);
      } catch (error) {
        failure = error;
      } finally {
        if (staged) try { await fs.unlink(stage); } catch (error) { cleanupErrors.push(error); }
        if (locked) try { await fs.rmdir(lock); } catch (error) { cleanupErrors.push(error); }
      }
      if (!published) {
        if (cleanupErrors.length) throw new AggregateError([failure, ...cleanupErrors], 'Decision commit failed; cleanup requires attention.', { cause: failure });
        throw failure;
      }
      return { file: target.absolute, ...(cleanupErrors.length ? { maintenanceWarnings: cleanupErrors.map(String) } : {}) };
    },
  };
}

/** Retained public name for the original Decision composition. */
export const createFileDecisionWritePort = createFileDomainSourceWritePort;
