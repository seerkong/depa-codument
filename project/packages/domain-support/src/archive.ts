import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {WORKSPACE_BINDINGS_PATH, type ArchiveCalendar, type ArchiveRegistry, type ArchiveRequest, type ArchiveSourcePort, type ArchiveSourceSnapshot, type ArchiveTrackObservation, type ArchiveTrackSelector, type LifecycleSourceCodec} from 'depa-codument-domain-contract';
import {observeFileLifecycle} from './lifecycle-observation';
import {commitArchiveFiles, observeArchiveFiles, readArchiveFile, type ArchiveFiles, type ArchiveFileEffects} from './archive-files';

const registries: readonly ArchiveRegistry[] = ['behaviors', 'modeling', 'engineering', 'decisions', 'memory'];
interface Context {codec: LifecycleSourceCodec; assertCurrent?: () => Promise<void>}
export interface FileArchiveBindings extends Context {
  readonly projects?: Readonly<Record<string, string>>;
  readonly observeProjectContext: (root: string) => Promise<Context>;
  readonly assertRequest: (input: ArchiveRequest) => void;
  readonly trackSelectors: (root: ArchiveSourceSnapshot['process']['root']) => readonly ArchiveTrackSelector[];
  readonly destinationPrefix: (input: ArchiveRequest, calendar: ArchiveCalendar) => string;
  readonly clock: {nowIso(): string};
  /** Explicit local timezone observation; Track uses its authoritative updated_at. */
  readonly calendar: (timestamp: string) => ArchiveCalendar;
}
interface ObservedLink {selector: ArchiveTrackSelector; root?: string; context?: Context; found?: Awaited<ReturnType<typeof observeFileLifecycle>>}
interface Observation {snapshot: ArchiveSourceSnapshot; files: ArchiveFiles; links: readonly ObservedLink[]; root: string}
const revision = (file: string, source: string) => createHash('sha256').update(file).update('\0').update(source).digest('hex');
const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
function portable(file: string) {if (file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) throw new Error('Archive output requires a visible portable owner path.');}

/** Pure policy is injected; private handles own complete bytes, directory
 * identities, binding/config inputs and cross-workspace observations. */
export function createFileArchiveSourcePort(workspaceRoot: string, supplied: FileArchiveBindings, effects?: ArchiveFileEffects): ArchiveSourcePort {
  const bindings = {...supplied, projects: {...supplied.projects}}, observations = new WeakMap<ArchiveSourceSnapshot, Observation>();
  async function unlocked(root: string) {if (await readArchiveFile(path.join(root, 'codument/.lifecycle-write.lock')) !== undefined) throw new Error('Lifecycle writer lock exists; inspect retained transaction before retrying.');}
  async function locate(root: string, ref: {kind: 'track' | 'mission'; id: string}, context: Context) {
    await context.assertCurrent?.();
    return observeFileLifecycle({workspaceRoot: root, resourceDirectory: 'codument', ref, codec: context.codec, revision});
  }
  async function resolveLink(root: string, selector: ArchiveTrackSelector): Promise<ObservedLink> {
    const external = selector.projectKind === 'external';
    const selected = selector.projectRef && bindings.projects?.[selector.projectRef];
    if (external && !selected) return {selector};
    // A declared host reference means this workspace; a local binding cannot
    // silently redirect it to another project's authority.
    const location = external ? await fs.realpath(selected!) : root;
    await unlocked(location);
    const context = location === root ? bindings : await bindings.observeProjectContext(location);
    const found = await locate(location, {kind: 'track', id: selector.trackId}, context);
    await unlocked(location);
    return {selector, root: location, context, found};
  }
  function textSources(files: ArchiveFiles, directory: string, select: (relative: string) => boolean): Map<string, string> {
    const result = new Map<string, string>();
    for (const [file, state] of files.entries) {
      const relative = path.relative(directory, file).split(path.sep).join('/');
      if (relative.startsWith('../') || path.isAbsolute(relative) || state?.kind !== 'file' || !select(relative)) continue;
      result.set(relative, decode(state.bytes));
    }
    return result;
  }
  return {
    async observe(request) {
      const input = structuredClone(request); bindings.assertRequest(input);
      const root = await fs.realpath(workspaceRoot);
      await unlocked(root);
      const process = await locate(root, input, bindings);
      if (!process || process.stage === 'archived' || input.kind === 'track' && process.stage !== 'active') throw new Error('Process has no eligible archive authority.');
      const nowIso = bindings.clock.nowIso(), calendar = bindings.calendar(input.kind === 'track' ? String(process.root.attributes?.updated_at) : nowIso);
      const prefix = bindings.destinationPrefix(input, calendar); portable(prefix);
      let destination = prefix, suffix = 2;
      while (await readArchiveFile(path.join(root, destination)) !== undefined) {
        if (input.kind === 'track') throw new Error(`Archive destination already exists: ${destination}`);
        destination = prefix + '-' + suffix++;
      }
      const links: ObservedLink[] = [];
      for (const selector of bindings.trackSelectors(process.root)) links.push(await resolveLink(root, selector));
      const roots = [process.directory, destination, ...registries.map(name => 'codument/' + name), 'codument/config', WORKSPACE_BINDINGS_PATH].map(file => path.join(root, file));
      for (const link of links) if (link.root) {
        roots.push(path.join(link.root, 'codument/config'), path.join(link.root, WORKSPACE_BINDINGS_PATH));
        if (link.found) roots.push(path.join(link.root, link.found.directory));
      }
      const files = await observeArchiveFiles([...new Set(roots)]);
      for (const file of files.entries.keys()) if (/\.[^/]+\.write-lock(?:\/|$)/.test(file)) throw new Error('An observed archive source has a retained writer lock.');
      const configSources = textSources(files, path.join(root, 'codument/config'), file => /\.(xnl|xml)$/i.test(file));
      for (const name of ['attractor-profiles', 'modeling', 'engineering']) if (configSources.has(name + '.xml')) throw new Error('Legacy archive configuration requires migration or review.');
      const processSources = textSources(files, path.join(root, process.directory), file => /\.(xnl|xml|md)$/i.test(file));
      if (processSources.get(input.kind + '.xnl') !== process.content) throw new Error('Process source changed during archive observation.');
      const canonical = Object.fromEntries(registries.map(name => [name, textSources(files, path.join(root, 'codument/' + name), file => !file.split('/').some(segment => segment.startsWith('.')) && (name === 'memory' ? file.endsWith('.md') : /\.(xnl|xml)$/i.test(file)))])) as Record<ArchiveRegistry, Map<string, string>>;
      const linkedTracks: ArchiveTrackObservation[] = links.map(link => {
        if (!link.root) return {...link.selector, stage: 'unbound'};
        return {...link.selector, stage: link.found?.stage ?? 'missing'};
      });
      const {content: _content, ...owned} = process;
      const snapshot: ArchiveSourceSnapshot = {request: input, process: owned, processSources, registries: canonical, configs: {profiles: configSources.get('attractor-profiles.xnl'), modeling: configSources.get('modeling.xnl'), engineering: configSources.get('engineering.xnl')}, linkedTracks, nowIso, calendar, destination, sourceRevision: randomUUID()};
      await unlocked(root); await bindings.assertCurrent?.();
      // No map/AST handed to callers is the private commit authority.
      const handle = Object.freeze(structuredClone(snapshot));
      observations.set(handle, {snapshot: structuredClone(snapshot), files, links, root});
      return handle;
    },
    async publish(handle, proposal) {
      const observed = observations.get(handle);
      if (!observed) throw new Error('Unknown archive source handle.');
      const {snapshot, root} = observed, publication = structuredClone(proposal);
      if (JSON.stringify(structuredClone(handle), (_key, value) => value instanceof Map ? [...value] : value) !== JSON.stringify(snapshot, (_key, value) => value instanceof Map ? [...value] : value)) throw new Error('Archive source handle was modified.');
      const changes = new Map<string, string>();
      for (const [name, updates] of Object.entries(publication.registryUpdates)) {
        if (!registries.includes(name as ArchiveRegistry)) throw new Error('Unknown archive destination registry.');
        for (const [file, source] of updates) {portable(file); if (typeof source !== 'string') throw new Error('Archive publication requires source text.'); changes.set(path.join(root, 'codument', name, file), source);}
      }
      for (const [file, source] of publication.processUpdates) {
        if (file !== (snapshot.request.kind === 'track' ? 'summary.md' : 'mission.xnl') || typeof source !== 'string') throw new Error('Archive cannot rewrite arbitrary process sources.');
        if (file === 'mission.xnl' && bindings.codec.inspect(source, 'mission').id !== snapshot.request.id) throw new Error('Archive cannot change the Mission identity.');
        changes.set(path.join(root, snapshot.process.directory, file), source);
      }
      const receipt = await commitArchiveFiles({workspaceRoot: root, observed: observed.files, changes, move: {source: path.join(root, snapshot.process.directory), destination: path.join(root, snapshot.destination)},
        async assertAuthorityCurrent(moved) {
          const current = await locate(root, snapshot.request, bindings);
          if (current?.directory !== (moved ? snapshot.destination : snapshot.process.directory)) throw new Error('Archive process authority changed.');
          for (const link of observed.links) if (link.root && link.context) {
            if (link.root !== root) await unlocked(link.root);
            const currentLink = await locate(link.root, {kind: 'track', id: link.selector.trackId}, link.context);
            if (currentLink?.directory !== link.found?.directory || currentLink?.sourceRevision !== link.found?.sourceRevision || currentLink?.stage !== link.found?.stage) throw new Error('Archive linked-track authority changed.');
          }
        }}, effects);
      observations.delete(handle);
      return {kind: snapshot.request.kind, id: snapshot.request.id, directory: snapshot.destination,
        updated: Object.fromEntries(Object.entries(publication.registryUpdates).filter(([, updates]) => updates.size).map(([name, updates]) => [name, [...updates.keys()]])),
        ...(publication.processUpdates.has('summary.md') ? {summary: snapshot.destination + '/summary.md'} : {}), warnings: publication.warnings,
        behaviorCapabilities: publication.behaviorCapabilities, promotedMemory: publication.promotedMemory, ...receipt};
    },
  };
}
