import {expect, it} from 'bun:test';
import type {ArchiveRequest, ArchiveSourceSnapshot} from 'depa-codument-domain-contract';
import {applyArchive, archiveMissionState, archiveTrackSelectors, lifecycleSourceCodec, proposeArchive, proposeScaffold} from '../src';

const nowIso = '2026-09-06T10:03:00.000Z';
function fixture(request: ArchiveRequest = {kind: 'track', id: 'work'}, transform = (source: string) => source): ArchiveSourceSnapshot {
  const kind = request.kind === 'track' ? 'Track' : 'Mission';
  const files = {...proposeScaffold({request: {kind, id: request.id, stage: 'active'}, stage: 'active', directory: 'source', sourceRevision: 'fixture'}, nowIso)};
  const file = request.kind + '.xnl';
  files[file] = transform(files[file].replace(/status = "[^"]+"/, 'status = "completed"').replace('<SubNodes []>', '<SubNodes [<TaskGroup #G1 {status="DONE"} (<SubNodes [<Task #T1 {status="DONE"}>]>)>]>'));
  const directory = `codument/${request.kind}s/active/work`;
  return {request, process: {kind: request.kind, id: request.id, root: lifecycleSourceCodec.inspect(files[file], request.kind).root, stage: 'active', directory, file: directory + '/' + file, sourceRevision: 'source'},
    processSources: new Map(Object.entries(files)), registries: {decisions: new Map(), memory: new Map()}, configs: {}, linkedTracks: [], nowIso,
    calendar: {year: 2026, month: 9, day: 6, hour: 10, minute: 3}, destination: request.kind === 'track' ? 'codument/tracks/archived/2026-09/2026-09-06-1003-work' : 'codument/missions/archived/2026-09-06-work', sourceRevision: 'all-sources'};
}
it('plans Track move without changing its completed status, and Mission archive as a single root update', async () => {
  const track = fixture(), before = structuredClone(track);
  const proposal = await proposeArchive(track);
  expect(proposal.processUpdates.size).toBe(0);
  expect(track).toEqual(before);
  const mission = fixture({kind: 'mission', id: 'work'});
  const archived = await proposeArchive(mission);
  const root = lifecycleSourceCodec.inspect(archived.processUpdates.get('mission.xnl')!, 'mission').root;
  expect(root.attributes?.status).toBe('archived');
  expect(root.attributes?.revision).toBe(2);
  expect(mission.process.root.attributes?.status).toBe('completed');
});
it('requires explicit confirmation for non-terminal processes and preserves the normal archive transition gate', async () => {
  const mission = fixture({kind: 'mission', id: 'work'}, source => source.replace('status = "completed"', 'status = "active"'));
  await expect(proposeArchive(mission)).rejects.toThrow('--yes');
  expect(() => archiveMissionState(mission.process, nowIso)).toThrow('terminal');
  const proposal = await proposeArchive({...mission, request: {...mission.request, yes: true}});
  expect(proposal.warnings[0]).toContain('source status');
  expect(proposal.processUpdates.get('mission.xnl')).toContain('archived');
});
it('guards exact source identity, full lifecycle semantics, calendar destination and stage before publication', async () => {
  const original = fixture();
  for (const invalid of [
    {...original, destination: 'codument/tracks/archived/elsewhere'},
    {...original, calendar: {...original.calendar, month: 13}},
    {...original, process: {...original.process, stage: 'pending' as const}},
    {...original, processSources: new Map([...original.processSources, ['track.xnl', original.processSources.get('track.xnl')!.replace('#work', '#another')]])},
    fixture(undefined, source => source.replace('<TaskGroup #G1', '<TaskGroup')),
  ]) await expect(proposeArchive(invalid)).rejects.toThrow();
  const mission = fixture({kind: 'mission', id: 'work'});
  await expect(proposeArchive({...mission, destination: mission.destination + '-2'})).resolves.toBeDefined();
  await expect(proposeArchive({...mission, destination: mission.destination + '-1'})).rejects.toThrow('destination');
});
it('requires exact ProjectRef-aware linked-track observations, not a local-id-only lookup', async () => {
  const mission = fixture({kind: 'mission', id: 'work'}, source => source.replace('<ProjectRef #host {kind="host"}>', '<ProjectRef #host {kind="host"}><ProjectRef #library {kind="external"}>').replace('<Task #T1 {status="DONE"}>', '<Task #T1 {status="DONE"} (<TrackLink #child {state="bound" project_ref="library"}>)>'));
  const selectors = archiveTrackSelectors(mission.process.root);
  expect(selectors).toEqual([{trackId: 'child', projectRef: 'library', projectKind: 'external'}]);
  await expect(proposeArchive(mission)).rejects.toThrow('observations');
  const observed = {...mission, linkedTracks: [{...selectors[0], stage: 'unbound' as const}]};
  await expect(proposeArchive(observed)).rejects.toThrow('bound tracks');
  expect((await proposeArchive({...observed, request: {...observed.request, yes: true}})).warnings).toContain('Preserved linked Track library:child:unbound.');
  await expect(proposeArchive({...observed, linkedTracks: [{...selectors[0], stage: 'archived'}]})).resolves.toBeDefined();
});
it('never treats an unrelated legacy artifact as permission to skip Decision review', async () => {
  const track = fixture();
  const withLegacy = {...track, processSources: new Map([...track.processSources, ['spec.md', '# Legacy requirement']])};
  await expect(proposeArchive(withLegacy)).resolves.toBeDefined();
  await expect(proposeArchive({...withLegacy, processSources: new Map([...track.processSources, ['decisions.md', '# Legacy decision']])})).rejects.toThrow('Decision Markdown');
});
it('only publishes after all proposals succeed, with memory activation explicit and process sources immutable', async () => {
  const source = fixture(), publications: unknown[] = [];
  const snapshot = {...source, configs: {profiles: '<AttractorProfiles #profiles envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Profiles [<Profile #memory {enabled=true}>]>)>'}, processSources: new Map([...source.processSources, ['memory/lessons/safety.md', 'Preserve data.']])};
  const sources = {async observe() {return snapshot;}, async publish(observed: ArchiveSourceSnapshot, proposal: unknown) {publications.push(proposal); expect(observed).toBe(snapshot); return {kind: source.request.kind, id: 'work', directory: source.destination, updated: {}, warnings: []};}};
  await applyArchive({sources}, source.request);
  expect(publications).toHaveLength(1);
  expect((await proposeArchive(snapshot)).registryUpdates.memory?.size).toBe(1);
  await expect(applyArchive({sources}, {...source.request, id: 'other'})).rejects.toThrow('different request');
  expect(publications).toHaveLength(1);
});
