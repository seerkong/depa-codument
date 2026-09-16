import {parseXnl, type DataElementNode} from 'xnl-core';
import type {ArchiveCalendar, ArchivePublication, ArchiveRegistry, ArchiveRequest, ArchiveSourcePort, ArchiveSourceSnapshot, ArchiveTrackSelector} from 'depa-codument-domain-contract';
import {archiveMissionState} from './lifecycle';
import {lifecycleSourceCodec} from './lifecycle-source';
import {patchLifecycleSource} from './source-patch';
import {readAttractorProfileEnabled, readAttractorProfileNames} from './config';
import {validateLifecycleTree} from './lifecycle-validation';
import {proposeArchiveDecisions} from './archive-decisions';
import {formatArchiveCalendar, proposeArchiveMemory, proposeArchiveSummary} from './archive-memory';
import {attr, descendants, id} from './validation-tree';

export function assertArchiveRequest(input: ArchiveRequest): void {
  if (!['track', 'mission'].includes(input.kind) || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input.id)) throw new Error('Archive requires a valid process kind and identity.');
  if (input.yes !== undefined && typeof input.yes !== 'boolean') throw new Error('Archive confirmation must be boolean.');
}

export function archiveDestinationPrefix(input: ArchiveRequest, observed: ArchiveCalendar): string {
  assertArchiveRequest(input);
  const calendar = formatArchiveCalendar(observed), prefix = `codument/${input.kind}s/archived/`;
  return input.kind === 'track' ? `${prefix}${calendar.monthBucket}/${calendar.minutePrefix}-${input.id}` : `${prefix}${calendar.day}-${input.id}`;
}

/** ProjectRef interpretation belongs to domain logic; effects resolve these
 * explicit selectors in their observed workspace bindings. */
export function archiveTrackSelectors(root: DataElementNode): readonly ArchiveTrackSelector[] {
  if (root.tag !== 'Mission') return [];
  const nodes = descendants(root), projects = nodes.filter(node => node.tag === 'ProjectRef');
  return nodes.filter(node => node.tag === 'TrackLink' && attr(node, 'state') === 'bound').map(link => {
    const trackId = id(link);
    if (!trackId) throw new Error('Bound archive TrackLink requires a stable identity.');
    const projectRef = attr(link, 'project_ref');
    if (!projectRef) return {trackId, projectKind: 'host' as const};
    const matches = projects.filter(project => id(project) === projectRef);
    const projectKind = matches.length === 1 ? attr(matches[0], 'kind') : undefined;
    if (projectKind !== 'host' && projectKind !== 'external') throw new Error(`Archive TrackLink has an unknown or ambiguous ProjectRef '${projectRef}'.`);
    return {trackId, projectRef, projectKind};
  });
}

/** Inspect all proposals before a single publication. Git historical blobs and
 * source snapshots stay observations; only the injected port may commit them. */
export async function proposeArchive(snapshot: ArchiveSourceSnapshot): Promise<ArchivePublication> {
  const observed = structuredClone(snapshot), input = observed.request;
  assertArchiveRequest(input);
  const authority = observed.process;
  if (authority.kind !== input.kind || authority.id !== input.id || authority.stage === 'archived'
    || input.kind === 'track' && authority.stage !== 'active') throw new Error('Archive source has no eligible process authority.');
  const rootFile = `${input.kind}.xnl`, original = observed.processSources.get(rootFile);
  if (original === undefined) throw new Error('Archive process root source is missing.');
  const admitted = lifecycleSourceCodec.inspect(original, input.kind);
  if (admitted.id !== input.id || JSON.stringify(admitted.root) !== JSON.stringify(authority.root)) throw new Error('Archive process snapshot differs from its source authority.');
  const validation = validateLifecycleTree(admitted.root, {file: authority.file, profileNames: readAttractorProfileNames(observed.configs.profiles)});
  if (validation.some(finding => finding.severity === 'error')) throw new Error(validation.filter(finding => finding.severity === 'error').map(finding => `${finding.rule}: ${finding.message}`).join('\n'));
  const terminal = input.kind === 'track' ? ['completed'] : ['completed', 'cancelled', 'superseded'];
  const warnings: string[] = [];
  if (!terminal.includes(String(admitted.root.attributes?.status))) {
    if (!input.yes) throw new Error('Process is not terminal; re-run with --yes/-y to archive explicitly.');
    warnings.push(`Archiving non-terminal ${input.kind} source status '${admitted.root.attributes?.status}' under explicit confirmation.`);
  }
  const references = archiveTrackSelectors(admitted.root);
  if (references.length !== observed.linkedTracks.length || references.some((ref, index) => {
    const actual = observed.linkedTracks[index];
    return actual.trackId !== ref.trackId || actual.projectRef !== ref.projectRef || actual.projectKind !== ref.projectKind;
  })) throw new Error('Archive linked-track observations do not cover the declared selectors.');
  for (const link of observed.linkedTracks) {
    if (!['pending', 'active', 'archived', 'missing', 'unbound'].includes(link.stage)) throw new Error('Archive linked-track observation has an unknown stage.');
    if (link.stage === 'archived') continue;
    if (!input.yes) throw new Error(`Mission has active or missing bound tracks: ${link.trackId}:${link.stage}. Re-run with --yes to preserve them.`);
    warnings.push(`Preserved linked Track ${link.projectRef ? link.projectRef + ':' : ''}${link.trackId}:${link.stage}.`);
  }
  const expected = archiveDestinationPrefix(input, observed.calendar);
  const suffix = observed.destination.slice(expected.length);
  if (observed.destination !== expected && (input.kind !== 'mission' || !observed.destination.startsWith(expected) || !/^-(?:[2-9]|[1-9][0-9]+)$/.test(suffix))) throw new Error('Archive destination differs from the observed calendar/identity policy.');
  for (const [file, source] of observed.processSources) {
    if (file.endsWith('.xnl')) {
      const parsed = parseXnl(source, {textBlockStyle: true});
      if (parsed.warnings?.length) throw new Error(`Ambiguous XNL before archive: ${file}`);
    }
    const basename = file.split('/').at(-1)!.toLowerCase();
    if (['decision.md', 'decisions.md'].includes(basename) || file.startsWith('decisions/') && file.endsWith('.md')) throw new Error(`Legacy Decision Markdown requires migration review before archive: ${file}`);
  }
  const select = (prefix: string) => new Map([...observed.processSources].filter(([file]) => file.startsWith(prefix)).map(([file, source]) => [file.slice(prefix.length), source]));
  const decisionSources = new Map([...observed.processSources].filter(([file]) => file === 'decisions.xnl' || file.startsWith('decisions/') && file.endsWith('.xnl')));
  const decisions = proposeArchiveDecisions({processSources: decisionSources, canonicalSources: observed.registries.decisions});
  warnings.push(...decisions.warnings.map(finding => `${finding.file}: ${finding.message}`));
  const registryUpdates: Partial<Record<ArchiveRegistry, ReadonlyMap<string, string>>> = {decisions: decisions.updates};
  const memory = proposeArchiveMemory({enabled: readAttractorProfileEnabled(observed.configs.profiles, 'memory'), archiveId: observed.destination.split('/').at(-1)!, calendar: observed.calendar,
    candidates: select('memory/'), canonicalSources: observed.registries.memory});
  registryUpdates.memory = memory.updates;
  const processUpdates = new Map<string, string>();
  if (input.kind === 'mission') {
    const update = archiveMissionState(authority, observed.nowIso, {confirmed: input.yes});
    processUpdates.set(rootFile, patchLifecycleSource(original, admitted.root, update.root));
  } else {
    const summary = proposeArchiveSummary({processId: input.id, decisionSources, existingSource: observed.processSources.get('summary.md')});
    if (summary !== undefined) processUpdates.set('summary.md', summary);
  }
  return {registryUpdates, processUpdates, warnings, promotedMemory: memory.promoted};
}

export async function applyArchive(runtime: {readonly sources: ArchiveSourcePort}, request: ArchiveRequest) {
  const input = structuredClone(request);
  assertArchiveRequest(input);
  const observed = await runtime.sources.observe(input);
  if (JSON.stringify(observed.request) !== JSON.stringify(input)) throw new Error('Archive observer returned a different request.');
  const proposal = await proposeArchive(observed);
  return runtime.sources.publish(observed, proposal);
}
