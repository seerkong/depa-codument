import {afterEach, expect, it} from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {tmpdir} from 'node:os';
import type {ArchiveRequest} from 'depa-codument-domain-contract';
import {applyArchive, archiveDestinationPrefix, archiveTrackSelectors, assertArchiveRequest, createValidatedLifecycleSourceCodec, lifecycleSourceCodec, proposeArchive, proposeScaffold} from 'depa-codument-domain-logic';
import {createFileArchiveSourcePort, type FileArchiveBindings} from '../src';
const roots: string[] = [];
afterEach(async () => {for (const root of roots.splice(0)) await fs.rm(root, {recursive: true, force: true});});
const nowIso = '2026-09-06T10:03:00.000Z';
const bindings: FileArchiveBindings = {codec: createValidatedLifecycleSourceCodec({file: 'codument', profileNames: []}), async observeProjectContext() {return {codec: lifecycleSourceCodec};}, assertRequest: assertArchiveRequest, trackSelectors: archiveTrackSelectors, destinationPrefix: archiveDestinationPrefix, clock: {nowIso: () => nowIso}, calendar(timestamp) {const date = new Date(timestamp); return {year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes()};}};
async function fixture(request: ArchiveRequest = {kind: 'track', id: 'work'}, transform = (source: string) => source) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'codument-archive-port-'))); roots.push(root);
  const kind = request.kind === 'track' ? 'Track' : 'Mission', directory = `codument/${request.kind}s/active/${request.id}`;
  const files = {...proposeScaffold({request: {kind, id: request.id, stage: 'active'}, stage: 'active', directory, sourceRevision: 'fixture'}, nowIso)};
  files[request.kind + '.xnl'] = transform(files[request.kind + '.xnl'].replace(/status = "[^"]+"/, 'status = "completed"').replace('<SubNodes []>', '<SubNodes [<TaskGroup #G1 {status="DONE"} (<SubNodes [<Task #T1 {status="DONE"}>]>)>]>'));
  await fs.mkdir(path.join(root, directory), {recursive: true});
  for (const [file, source] of Object.entries(files)) await fs.writeFile(path.join(root, directory, file), source);
  return {root, directory, request, files, sources: createFileArchiveSourcePort(root, bindings)};
}
async function put(root: string, file: string, source: string | Uint8Array) {await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true}); await fs.writeFile(path.join(root, file), source);}
it('archives real Track sources without changing their root, and Mission sources with a single revision transition', async () => {
  for (const kind of ['track', 'mission'] as const) {
    const test = await fixture({kind, id: 'work'});
    await put(test.root, test.directory + '/output/unknown.bin', new Uint8Array([0, 255, 17]));
    const receipt = await applyArchive({sources: test.sources}, test.request);
    expect(receipt.directory).toBe(kind === 'track' ? 'codument/tracks/archived/2026-09/2026-09-06-1003-work' : 'codument/missions/archived/2026-09-06-work');
    const source = await fs.readFile(path.join(test.root, receipt.directory, kind + '.xnl'), 'utf8');
    if (kind === 'track') expect(source).toBe(test.files['track.xnl']);
    else expect(lifecycleSourceCodec.inspect(source, kind).root.attributes?.revision).toBe(2);
    expect([...await fs.readFile(path.join(test.root, receipt.directory, 'output/unknown.bin'))]).toEqual([0, 255, 17]);
    await expect(test.sources.observe(test.request)).rejects.toThrow('eligible archive');
  }
});
it('promotes Decision closure, summary and explicit memory candidates in the same real transaction', async () => {
  const test = await fixture();
  const decision = '<decision #choice envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {status="accepted" durable_candidate=true confidence="high" reversibility="reversible"} (<question ?>What survives?</?><answer (<raw-answer ?>Keep sources</?><decision-text ?>Keep sources.</?><rationale ?>Owned facts.</?><evidence ?>Test.</?>)>)>';
  await put(test.root, test.directory + '/decisions/business/choice.xnl', decision);
  await put(test.root, test.directory + '/memory/lessons/safety.md', '    preserve authored indentation\r\n');
  await put(test.root, 'codument/config/attractor-profiles.xnl', '<AttractorProfiles #profiles envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Profiles [<Profile #memory {enabled=true}>]>)>');
  const receipt = await applyArchive({sources: test.sources}, test.request);
  expect(await fs.readFile(path.join(test.root, 'codument/decisions/business/choice.xnl'), 'utf8')).toContain(decision);
  expect(await fs.readFile(path.join(test.root, receipt.summary!), 'utf8')).toContain('- choice');
  expect(receipt.updated.memory).toHaveLength(1);
  expect(await fs.readFile(path.join(test.root, 'codument/memory', receipt.updated.memory![0]), 'utf8')).toEndWith('    preserve authored indentation\r\n');
});
it('rejects mutated handles, newly competing authorities and changed configs without promoting or moving', async () => {
  for (const mode of ['handle', 'duplicate', 'config']) {
    const test = await fixture(), snapshot = await test.sources.observe(test.request), proposal = await proposeArchive(snapshot);
    if (mode === 'handle') (snapshot.processSources as Map<string, string>).set('design.md', 'forged');
    if (mode === 'duplicate') for (const [file, source] of Object.entries(test.files)) await put(test.root, 'codument/tracks/pending/competing/' + file, source);
    if (mode === 'config') await put(test.root, 'codument/config/modeling.xnl', 'independent config');
    await expect(test.sources.publish(snapshot, proposal)).rejects.toThrow();
    expect(await fs.readFile(path.join(test.root, test.directory, 'track.xnl'), 'utf8')).toBe(test.files['track.xnl']);
  }
});
it('resolves external linked tracks and rechecks their source authority before archive', async () => {
  const external = await fixture({kind: 'track', id: 'child'});
  const mission = await fixture({kind: 'mission', id: 'work'}, source => source.replace('<ProjectRef #host {kind="host"}>', '<ProjectRef #host {kind="host"}><ProjectRef #library {kind="external"}>').replace('<Task #T1 {status="DONE"}>', '<Task #T1 {status="DONE"} (<TrackLink #child {state="bound" project_ref="library"}>)>'));
  const sources = createFileArchiveSourcePort(mission.root, {...bindings, projects: {library: external.root}});
  await expect(applyArchive({sources}, mission.request)).rejects.toThrow('bound tracks');
  const snapshot = await sources.observe({...mission.request, yes: true}), proposal = await proposeArchive(snapshot);
  await fs.appendFile(path.join(external.root, external.directory, 'track.xnl'), '<!-- independent edit -->');
  await expect(sources.publish(snapshot, proposal)).rejects.toThrow('sources changed');
  const receipt = await applyArchive({sources}, {...mission.request, yes: true});
  expect(receipt.warnings).toContain('Preserved linked Track library:child:active.');
  expect(await fs.readFile(path.join(external.root, external.directory, 'track.xnl'), 'utf8')).toEndWith('<!-- independent edit -->');
});
it('retains strict text decoding, unsafe-tree refusal and Track source-date naming', async () => {
  const test = await fixture(undefined, source => source.replaceAll(nowIso, '2024-02-29T01:02:00.000Z'));
  expect((await test.sources.observe(test.request)).destination).toBe('codument/tracks/archived/2024-02/2024-02-29-0102-work');
  await put(test.root, test.directory + '/decisions/topic.xnl', new Uint8Array([255, 0]));
  await expect(test.sources.observe(test.request)).rejects.toThrow();
});
it('discovers identities structurally without demanding that unrelated authoring drafts are complete', async () => {
  const test = await fixture();
  const draft = proposeScaffold({request: {kind: 'Track', id: 'unrelated', stage: 'pending'}, stage: 'pending', directory: 'unused', sourceRevision: 'draft'}, nowIso);
  for (const [file, source] of Object.entries(draft)) await put(test.root, 'codument/tracks/pending/unrelated/' + file, source);
  await expect(test.sources.observe({kind: 'track', id: 'unrelated'})).rejects.toThrow('phase-missing');
  expect((await applyArchive({sources: test.sources}, test.request)).kind).toBe('track');
  expect(await fs.readFile(path.join(test.root, 'codument/tracks/pending/unrelated/track.xnl'), 'utf8')).toBe(draft['track.xnl']);
});
