import { expect, it } from 'bun:test';
import type { KnowledgeScaffoldRequest, KnowledgeScaffoldSnapshot } from 'depa-codument-domain-contract';
import { indexKnowledgeSources, knowledgeScaffoldFile, proposeKnowledgeScaffold, validateKnowledgeIndex } from '../src';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
function observation(request: KnowledgeScaffoldRequest, sources = new Map<string, string>()): KnowledgeScaffoldSnapshot {
  return {request, file: knowledgeScaffoldFile(request), directory: `codument/${request.family}`, sources, sourceRevision: 'test'};
}
it('all ten knowledge drafts have one current owner and structural schemas, not a claimed semantic review', () => {
  for (const family of ['modeling', 'engineering'] as const) {
    const kinds = family === 'modeling' ? ['entity', 'object', 'state-machine', 'enum', 'module'] : ['rule', 'howto', 'reference', 'code-map', 'overview'];
    for (const kind of kinds) {
      const request: KnowledgeScaffoldRequest = family === 'modeling'
        ? {family, kind, name: 'example', plane: 'domain', context: 'orders', fields: ['id:string', 'value?:{key:string}'], states: ['initial', 'done']}
        : {family, kind, name: 'example', plane: 'global', category: 'overview', topic: 'project'};
      const observed = observation(request), source = proposeKnowledgeScaffold(request, observed);
      expect(source).toContain(envelope); expect(source).toContain('TODO');
      const index = indexKnowledgeSources(new Map([[observed.file, source]]), family);
      expect(index.ready).toBe(true);
      expect(validateKnowledgeIndex(index).filter(finding => finding.severity === 'error')).toEqual([]);
      if (family === 'modeling') {
        expect(source).toContain('data-topology/v1'); expect(source).not.toContain('fact_grade'); expect(source).not.toContain('single_writer');
        if (kind === 'entity' || kind === 'object') expect(source).toContain('value?: {key:string}');
      }
      expect(() => proposeKnowledgeScaffold(request, observation(request, new Map([[observed.file, source]])))).toThrow();
    }
  }
});
it('preserves legacy profile, comments and unknown content while explicitly selecting the new subject schema', () => {
  const request: KnowledgeScaffoldRequest = {family: 'modeling', kind: 'object', name: 'newValue', plane: 'domain', context: 'orders'};
  const source = `<!-- KEEP -->\n<ModelingRegistry #historical.owner ${envelope} {modeling_schema="codument-legacy/v1" extension={unknown=true}} [
  <!-- older authority --> <object #domain.orders.old {kind="object" fact_grade="canonical" single_writer="historical"} (<types ?>type Old = string</?>)>
]>\n<!-- KEEP END -->`;
  const observed = observation(request, new Map([[knowledgeScaffoldFile(request), source]]));
  const proposal = proposeKnowledgeScaffold(request, observed);
  expect(proposal).toStartWith('<!-- KEEP -->'); expect(proposal).toEndWith('<!-- KEEP END -->');
  expect(proposal).toContain('extension={unknown=true}'); expect(proposal).toContain('fact_grade="canonical" single_writer="historical"');
  expect(proposal).toContain('modeling_schema="codument-legacy/v1"');
  expect(proposal).toContain('modeling_schema = "data-topology/v1"');
  expect(observed.sources.get(observed.file)).toBe(source);
});
it('rejects invalid identities, delimiter injection, old forests and duplicate ownership across the registry', () => {
  const request: KnowledgeScaffoldRequest = {family: 'modeling', kind: 'object', name: 'example', plane: 'domain', context: 'orders'};
  for (const change of [{name: '../escape'}, {context: 'a/b'}, {plane: '/tmp'}, {track: '../escape'}, {kind: 'unknown'},
    {fields: ['value:string\nBAD']}, {fields: ['value:</?ts>']}, {states: ['done</?m>']}]) expect(() => knowledgeScaffoldFile({...request, ...change})).toThrow();
  const observed = observation(request);
  expect(() => proposeKnowledgeScaffold({...request, name: 'other'}, observed)).toThrow('differs');
  const source = proposeKnowledgeScaffold(request, observed);
  expect(() => proposeKnowledgeScaffold(request, observation(request, new Map([['domain/orders.xnl', source]])))).toThrow();
  expect(() => proposeKnowledgeScaffold(request, observation(request, new Map([['domain/orders.xnl', '<object #old>']])))).toThrow('migrate');
  expect(knowledgeScaffoldFile({...request, track: 'work'})).toBe('domain/orders.xnl');
  expect(knowledgeScaffoldFile(request)).toBe('domain/orders/index.xnl');
});
