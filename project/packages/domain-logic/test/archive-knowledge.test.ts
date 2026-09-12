import {expect, it} from 'bun:test';
import {parseXnl, type DataElementNode} from 'xnl-core';
import {proposeArchiveKnowledge, readKnowledgeArchiveBaseline, knowledgeArchiveOwnerFile} from '../src';

const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const modelFile = 'domain/orders/index.xnl', deltaFile = 'domain/orders.xnl';
function owner(body: string, profile = 'codument-legacy/v1', header = ''): string {
  return `<!-- OWNER -->\r\n<ModelingRegistry #historical.owner ${envelope} {modeling_schema="${profile}" ${header}} [${body}]><!-- END -->`;
}
function object(value = '1'): string {return `<object #domain.orders.value {kind="object" fact_grade="authoritative_fact" single_writer="domain" value=${value} extension={keep=true}} (<types ?TS>type Value = string</?TS>)>`;}
function merge(base: string, ours: string, theirs: string) {
  return proposeArchiveKnowledge({family: 'modeling', baseSources: new Map([[modelFile, base]]), canonicalSources: new Map([[modelFile, ours]]), deltaSources: new Map([[deltaFile, theirs]])});
}
it('merges body changes against an isolated legacy baseline and retains the current owner/source', () => {
  const base = object(), current = owner(object().replace('keep=true', 'keep=false'), 'codument-legacy/v1', 'custom={opaque="KEEP"}');
  const delta = owner(object('2').replace('value=2', 'value=2 <!-- DELTA -->'));
  const result = merge(base, current, delta), source = result.updates.get(modelFile)!;
  expect(result.conflicts).toEqual([]); expect(source).toContain('#historical.owner');
  expect(source).toContain('custom={opaque="KEEP"}'); expect(source).toContain('keep=false'); expect(source).toContain('value=2');
  expect(source).toStartWith('<!-- OWNER -->\r\n'); expect(source).toEndWith('<!-- END -->');
  expect(source).toContain('<types ?TS>type Value = string</?TS>');
  expect(merge(base, source, delta).updates.size).toBe(0);
});
it('does not publish any file when human conflicts remain and retains all explicit resolutions', () => {
  expect(merge(owner(object()), owner(object('2')), owner(object('3'))).conflicts.map(item => [item.file, item.type])).toEqual([[modelFile, 'same-field']]);
  for (const [resolution, value] of [['ours', '2'], ['theirs', '3'], ['base', '1']] as const) {
    const result = proposeArchiveKnowledge({family: 'modeling', baseSources: new Map([[modelFile, owner(object())]]), canonicalSources: new Map([[modelFile, owner(object('2'))]]), deltaSources: new Map([[deltaFile, owner(object('3'))]]), policy: {'same-field': resolution, 'add-add': 'human', 'delete-modify': 'human'}});
    expect(result.conflicts).toEqual([]);
    const source = result.updates.get(modelFile) ?? owner(object('2'));
    const node = (parseXnl(source, {textBlockStyle: true}).nodes[0] as DataElementNode).body![0] as DataElementNode;
    expect(node.attributes!.value).toBe(Number(value));
  }
  const conflict = merge(owner(object()), owner(object('2')), owner(''));
  expect(conflict.updates.size).toBe(0); expect(conflict.conflicts[0].type).toBe('delete-modify');
});
it('preserves different schema interpretation for new subjects and refuses reinterpreting a shared identity', () => {
  const modern = '<object #domain.orders.modern <!-- NEW SUBJECT --> {kind="object" semantic_role="custom" authority_model="value" relations=[]} (<types ?>type Modern = string</?>)>';
  const oldExplicit = object().replace('kind="object"', 'kind="object" modeling_schema="codument-legacy/v1"');
  const result = merge(object(), owner(object()), owner(oldExplicit + modern, 'data-topology/v1'));
  const source = result.updates.get(modelFile)!;
  expect(source).toContain('<!-- NEW SUBJECT -->');
  const root = parseXnl(source, {textBlockStyle: true}).nodes[0] as DataElementNode;
  expect(root.attributes!.modeling_schema).toBe('codument-legacy/v1');
  expect((root.body![1] as DataElementNode).attributes!.modeling_schema).toBe('data-topology/v1');
  expect(() => merge(object(), owner(object()), owner(object(), 'data-topology/v1'))).toThrow('schema interpretation');
});
it('retains engineering owner paths, rejects ambiguous legacy sources and never reopens old normal readers', () => {
  const file = 'global/overview/project.xnl';
  const body = '<overview #global.overview.project.main {kind="overview"} (<desc ?>Project</?><mental-model ?>Structure</?>)>';
  const source = `<EngineeringRegistry #custom ${envelope} {} [${body}]>`;
  const result = proposeArchiveKnowledge({family: 'engineering', baseSources: new Map(), canonicalSources: new Map(), deltaSources: new Map([[file, source]])});
  expect(result.updates.get(file)).toBe(source);
  expect(knowledgeArchiveOwnerFile(file, 'engineering')).toBe(file);
  expect(readKnowledgeArchiveBaseline(new Map([['domain/orders.xnl', object()]]), 'modeling').owners.has(modelFile)).toBe(true);
  expect(() => readKnowledgeArchiveBaseline(new Map([['domain/orders.xml', object()]]), 'modeling')).toThrow('review');
  expect(() => readKnowledgeArchiveBaseline(new Map([['domain/orders.xnl', object()], [modelFile, object()]]), 'modeling')).toThrow('collide');
  expect(() => merge(object(), object(), owner(object()))).toThrow('migrate');
  expect(() => merge(object(), owner(object()), owner(object(), 'codument-legacy/v1', 'extra="new"'))).toThrow('owner review');
  expect(() => knowledgeArchiveOwnerFile('../orders.xnl', 'modeling')).toThrow('portable');
});
it('keeps the aggregate owner for an empty desired body and returns no partial updates across owners', () => {
  const removed = merge(object(), owner(object()), owner(''));
  expect(removed.conflicts).toEqual([]);
  expect(removed.updates.get(modelFile)).toContain('#historical.owner');
  expect(removed.updates.get(modelFile)).not.toContain('#domain.orders.value');
  const other = owner(object().replaceAll('orders', 'other')).replaceAll('#historical.owner', '#other.owner');
  const result = proposeArchiveKnowledge({family: 'modeling', baseSources: new Map([[modelFile, owner(object())], ['domain/other/index.xnl', other]]),
    canonicalSources: new Map([[modelFile, owner(object('2'))], ['domain/other/index.xnl', other]]),
    deltaSources: new Map([[deltaFile, owner(object('3'))], ['domain/other.xnl', other.replace('value=1', 'value=4')]])});
  expect(result.conflicts).toHaveLength(1); expect(result.updates.size).toBe(0);
  expect(() => readKnowledgeArchiveBaseline(new Map([[modelFile, object().replace('authoritative_fact', 'unknown-grade')]]), 'modeling')).toThrow('migration review');
});
it('merges presentation-independent subjects without changing their original text delimiters', () => {
  const base = object();
  const current = owner(object('2').replaceAll('?TS', '?CURRENT'));
  const delta = owner(object().replace('keep=true', 'keep=false').replaceAll('?TS', '?DELTA'));
  const result = merge(base, current, delta);
  const source = result.updates.get(modelFile)!;
  expect(result.conflicts).toEqual([]); expect(source).toContain('value=2'); expect(source).toContain('keep=false');
  expect(source).toContain('?CURRENT>'); expect(merge(base, source, delta).updates.size).toBe(0);
});
