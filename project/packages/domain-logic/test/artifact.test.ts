import { expect, it } from 'bun:test';
import { planArtifactChanges, syncArtifacts } from '../src';
import type { ArtifactSyncSnapshot } from 'depa-codument-domain-contract';
const snapshot: ArtifactSyncSnapshot = {source: '/explicit/source', target: '/explicit/target', sourceRevision: 'opaque',
  sources: new Map([['same', '1'], ['create', '2'], ['update', '3']]), targets: new Map([['same', '1'], ['update', '4'], ['extra', '5']])};
it('artifact planning retains original change/order/status contract without publishing dry-run or conflicts', async () => {
  const trace: string[] = [], port = {async observe() {trace.push('observe'); return snapshot;}, async publish(observed: ArtifactSyncSnapshot) {expect(observed).toBe(snapshot); trace.push('publish'); return {};}};
  const changes = [{path: 'create', status: 'create'}, {path: 'same', status: 'unchanged'}, {path: 'update', status: 'update'}] as const;
  expect(planArtifactChanges(snapshot)).toEqual(changes);
  const request = {source: 'source', target: 'target'};
  expect(await syncArtifacts(port, request)).toEqual({status: 'conflict', source: snapshot.source, target: snapshot.target, changes});
  expect(await syncArtifacts(port, {...request, dryRun: true, force: true})).toMatchObject({status: 'dry-run', changes});
  expect(trace).toEqual(['observe', 'observe']);
  expect(await syncArtifacts(port, {...request, force: true})).toMatchObject({status: 'synced', changes});
  expect(trace).toEqual(['observe', 'observe', 'observe', 'publish']);
  await expect(syncArtifacts(port, {...request, source: ''})).rejects.toThrow('--source');
  await expect(syncArtifacts(port, {...request, force: 'false' as unknown as boolean})).rejects.toThrow('boolean');
});
it('does not turn publication failure into a synced receipt and keeps cleanup warnings explicit', async () => {
  const request = {source: 'source', target: 'target', force: true};
  const port = {async observe() {return snapshot;}, async publish() {throw new Error('recovery required');}};
  await expect(syncArtifacts(port, request)).rejects.toThrow('recovery required');
  expect(await syncArtifacts({...port, async publish() {return {maintenanceWarnings: ['retained lock']};}}, request)).toMatchObject({status: 'synced', maintenanceWarnings: ['retained lock']});
});
