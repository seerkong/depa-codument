import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { KnowledgeScaffoldRequest } from 'depa-codument-domain-contract';
import { lifecycleSourceCodec, knowledgeScaffoldFile, proposeKnowledgeScaffold } from 'depa-codument-domain-logic';
import { createFileKnowledgeScaffoldPort, createFileKnowledgeSourcePort } from '../src';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const request: KnowledgeScaffoldRequest = {family: 'modeling', kind: 'object', name: 'first', plane: 'domain', context: 'orders'};
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-knowledge-write-'));
  const sources = createFileKnowledgeSourcePort(root, lifecycleSourceCodec);
  const port = createFileKnowledgeScaffoldPort(root, {sources, fileFor: knowledgeScaffoldFile});
  const write = async (file: string, source: string) => {await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true}); await fs.writeFile(path.join(root, file), source);};
  return {root, port, write};
}
it('publishes through an opaque one-use observation, preserving source and mode without parallel authorities', async () => {
  const {root, port} = await fixture();
  try {
    await expect(port.observe(request)).rejects.toThrow('not initialized'); expect(await fs.readdir(root)).toEqual([]);
    await fs.mkdir(path.join(root, 'codument'));
    const observed = await port.observe(request), source = proposeKnowledgeScaffold(request, observed);
    await expect(port.publish({...observed}, source)).rejects.toThrow('Unknown');
    const receipt = await port.publish(observed, source);
    expect(receipt.file).toBe(path.join(root, 'codument/modeling/domain/orders/index.xnl'));
    expect(await fs.readFile(receipt.file, 'utf8')).toBe(source);
    expect((await fs.stat(receipt.file)).mode & 0o777).toBe(0o666 & ~process.umask());
    await expect(port.publish(observed, source)).rejects.toThrow('Unknown');
    await fs.chmod(receipt.file, 0o640);
    await fs.writeFile(receipt.file, source + '\r\n');
    const next = {...request, name: 'second'}, nextObservation = await port.observe(next);
    const nextSource = proposeKnowledgeScaffold(next, nextObservation);
    expect(nextSource).toEndWith('\r\n');
    await port.publish(nextObservation, nextSource);
    expect(await fs.readFile(receipt.file, 'utf8')).toBe(nextSource); expect((await fs.stat(receipt.file)).mode & 0o777).toBe(0o640);
    expect((await fs.readdir(root, {recursive: true})).filter(file => file.endsWith('.xnl'))).toEqual(['codument/modeling/domain/orders/index.xnl']);
    expect((await fs.readdir(root, {recursive: true})).some(file => file.includes('.lock') || file.includes('KindDefinition'))).toBe(false);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('retains an unsupported BOM source for review instead of silently dropping bytes to admit a write', async () => {
  const {root, port, write} = await fixture();
  const file = 'codument/modeling/domain/orders/index.xnl';
  const source = `\uFEFF<ModelingRegistry #orders ${envelope} {modeling_schema="data-topology/v1"} []>\r\n`;
  try {
    await write(file, source);
    const observed = await port.observe(request);
    expect(observed.sources.get('domain/orders/index.xnl')).toBe(source);
    // xnl-core 0.3 rejects BOM. Source admission cannot remove it implicitly;
    // a migration/review may propose an explicit byte-level normalization.
    expect(() => proposeKnowledgeScaffold(request, observed)).toThrow("Expected '<'");
    expect(await fs.readFile(path.join(root, file), 'utf8')).toBe(source);
    expect(await fs.exists(path.join(root, 'codument/.lifecycle-write.lock'))).toBe(false);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('rejects changed registry, retained writer lock and target replacement before publishing', async () => {
  const {root, port, write} = await fixture();
  try {
    await fs.mkdir(path.join(root, 'codument'));
    const first = await port.observe(request), source = proposeKnowledgeScaffold(request, first);
    await fs.mkdir(path.join(root, 'codument/.lifecycle-write.lock'));
    await expect(port.publish(first, source)).rejects.toThrow();
    await expect(port.observe(request)).rejects.toThrow('lock');
    await fs.rmdir(path.join(root, 'codument/.lifecycle-write.lock'));
    await write('codument/modeling/domain/other.xnl', `<ModelingRegistry #other ${envelope} {modeling_schema="data-topology/v1"} []>`);
    await expect(port.publish(first, source)).rejects.toThrow('changed');
    expect(await fs.exists(path.join(root, 'codument/modeling/domain/orders/index.xnl'))).toBe(false);
    const next = await port.observe(request);
    await write('codument/modeling/domain/orders/index.xnl', 'USER EDIT');
    await expect(port.publish(next, proposeKnowledgeScaffold(request, next))).rejects.toThrow('changed');
    expect(await fs.readFile(path.join(root, 'codument/modeling/domain/orders/index.xnl'), 'utf8')).toBe('USER EDIT');
    expect(await fs.exists(path.join(root, 'codument/.lifecycle-write.lock'))).toBe(false);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('binds delta publication to exact Track source and stage, not merely its destination directory', async () => {
  const {root, port, write} = await fixture();
  const trackFile = 'codument/tracks/pending/work/track.xnl';
  const original = `<Track #work ${envelope} {status="new"}>`;
  const delta = {...request, track: 'work'};
  try {
    await write(trackFile, original);
    const first = await port.observe(delta), source = proposeKnowledgeScaffold(delta, first);
    await write(trackFile, original + '\n<!-- independent edit -->');
    await expect(port.publish(first, source)).rejects.toThrow('Track context changed');
    const moved = await port.observe(delta);
    await fs.mkdir(path.join(root, 'codument/tracks/active'));
    await fs.rename(path.join(root, 'codument/tracks/pending/work'), path.join(root, 'codument/tracks/active/work'));
    await expect(port.publish(moved, proposeKnowledgeScaffold(delta, moved))).rejects.toThrow('changed');
    const current = await port.observe(delta);
    const receipt = await port.publish(current, proposeKnowledgeScaffold(delta, current));
    expect(receipt.file).toBe('codument/tracks/active/work/modeling_deltas/domain/orders.xnl');
    await write(trackFile, original);
    await expect(port.observe(delta)).rejects.toThrow('2 eligible authorities');
    expect(await fs.readFile(path.join(root, receipt.file), 'utf8')).toContain('#domain.orders.first');
    expect(await fs.exists(path.join(root, 'codument/.lifecycle-write.lock'))).toBe(false);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
