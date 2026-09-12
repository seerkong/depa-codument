import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DomainSourceSnapshot, KnowledgeScaffoldPort, KnowledgeScaffoldRequest, KnowledgeScaffoldSnapshot, KnowledgeSourcePort } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';
import { createFileDomainSourceWritePort } from './decision-write';

type ObservedSources = Awaited<ReturnType<KnowledgeSourcePort['observe']>>;
interface Observation { readonly input: KnowledgeScaffoldRequest; readonly sources: ObservedSources; readonly target: DomainSourceSnapshot }

/** One file publication serialized with process/knowledge writers, with explicit
 * whole-registry and Track source guards. No arbitrary-editor atomic CAS claim. */
export function createFileKnowledgeScaffoldPort(workspaceRoot: string, bindings: {
  readonly sources: KnowledgeSourcePort;
  readonly fileFor: (input: KnowledgeScaffoldRequest) => string;
}): KnowledgeScaffoldPort {
  const root = path.resolve(workspaceRoot), workspace = createWorkspaceEffect(root);
  const sourcePort = bindings.sources, fileFor = bindings.fileFor;
  const writes = createFileDomainSourceWritePort(root);
  const observations = new WeakMap<KnowledgeScaffoldSnapshot, Observation>();
  const lock = 'codument/.lifecycle-write.lock';
  async function unlocked() {
    if (await workspace.kind(lock) !== undefined) throw new Error('Lifecycle writer lock exists; inspect retained transaction before retrying.');
  }
  function same(left: ReadonlyMap<string, string> | undefined, right: ReadonlyMap<string, string> | undefined): boolean {
    if ((left?.size ?? 0) !== (right?.size ?? 0)) return false;
    return [...left ?? []].every(([file, source]) => right?.get(file) === source);
  }
  return {
    async observe(request) {
      const input = structuredClone(request);
      const file = fileFor(input);
      if (file.startsWith('/') || file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..') || !file.endsWith('.xnl')) throw new Error('Knowledge scaffold target must be a portable XNL owner path.');
      if (await workspace.kind('codument') !== 'directory') throw new Error('Codument is not initialized. Run codument init first.');
      await unlocked();
      const observed = await sourcePort.observe({family: input.family, deltas: input.track});
      const directory = observed.directory;
      if (!directory.startsWith('codument/') || directory.split('/').some(part => part === '..' || part === '.') || directory.includes('\\')) throw new Error('Knowledge writer is restricted to formal codument sources.');
      const target = await writes.read(path.posix.join(directory, file));
      if (target.source !== observed.sources.get(file)) throw new Error('Knowledge target changed while observing its registry.');
      await unlocked();
      const snapshot: KnowledgeScaffoldSnapshot = Object.freeze({request: Object.freeze(structuredClone(input)), directory, file,
        sources: new Map(observed.sources), sourceRevision: randomUUID()});
      observations.set(snapshot, {input, target, sources: {directory, sources: new Map(observed.sources), contextSources: new Map(observed.contextSources)}});
      return snapshot;
    },
    async publish(snapshot, source) {
      const observed = observations.get(snapshot);
      if (!observed) throw new Error('Unknown knowledge scaffold source handle.');
      if (typeof source !== 'string') throw new Error('Knowledge proposal must be source text.');
      let locked = false, published = false, failure: unknown;
      const warnings: string[] = [];
      try {
        await workspace.kind(lock);
        await fs.mkdir(path.join(root, lock), {mode: 0o700});
        locked = true;
        const current = await sourcePort.observe({family: observed.input.family, deltas: observed.input.track});
        if (current.directory !== observed.sources.directory || !same(current.sources, observed.sources.sources)
          || !same(current.contextSources, observed.sources.contextSources)) throw new Error('Knowledge registry or Track context changed before publication.');
        const receipt = await writes.commit(observed.target, source);
        warnings.push(...receipt.maintenanceWarnings ?? []);
        published = true;
        observations.delete(snapshot);
      } catch (error) { failure = error; }
      finally { if (locked) try { await fs.rmdir(path.join(root, lock)); } catch (error) { warnings.push(String(error)); } }
      if (!published) {
        if (warnings.length) throw new AggregateError([failure, ...warnings], 'Knowledge scaffold failed; cleanup requires attention.', {cause: failure});
        throw failure;
      }
      const file = observed.input.track ? path.posix.join(observed.sources.directory, snapshot.file) : observed.target.file;
      return {file, ...(warnings.length ? {maintenanceWarnings: warnings} : {})};
    },
  };
}
