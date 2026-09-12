import { expect, it } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { indexKnowledgeSources, validateKnowledgeIndex, validateModelingNode, validateEngineeringNode } from '../src';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const node = (source: string) => parseXnl(source, {textBlockStyle: true}).nodes[0] as DataElementNode;
const modern = '<object #domain.orders.value {kind="object" semantic_role=["value" "project_custom"] authority_model="immutable_value" relations=[]} (<types ?>type Value = string</?>)>';
const legacy = '<object #domain.orders.authority {kind="entity" fact_grade="authoritative_fact" single_writer="external://owner"} (<types ?>type Entity = string</?>)>';
const wrap = (body: string, profile = 'data-topology/v1', id = 'knowledge.orders') => `<ModelingRegistry #${id} ${envelope} {modeling_schema="${profile}"} [${body}]>`;

it('keeps DataTopology labels open and legacy semantics explicit without inventing an owner for immutable values', () => {
  expect(validateModelingNode(node(modern), 'data-topology/v1')).toEqual([]);
  expect(validateModelingNode(node(legacy), 'codument-legacy/v1')).toEqual([]);
  expect(validateModelingNode(node(legacy), 'data-topology/v1')).toHaveLength(3);
  expect(validateModelingNode(node(modern), 'codument-legacy/v1')).toHaveLength(2);
  expect(validateModelingNode(node(legacy.replace('authoritative_fact', 'made-up')), 'codument-legacy/v1')).toContain("#domain.orders.authority: invalid fact_grade 'made-up'");
  expect(validateModelingNode(node(modern.replace('relations=[]', 'relations=[{relation="custom_project" target="external://source"} {relation="observes" target="runtime-input"}]')), 'data-topology/v1')).toEqual([]);
  expect(validateModelingNode(node(modern.replace('relations=[]', 'relations=[{relation="observes"}]')), 'data-topology/v1')).toHaveLength(1);
  expect(validateModelingNode(node(modern.replace('semantic_role=["value" "project_custom"]', 'semantic_role=[]')), 'data-topology/v1')).toHaveLength(1);
  expect(validateModelingNode(node(modern.replace('<types ?>type Value = string</?>', '')), 'data-topology/v1')).toContain('#domain.orders.value (kind=object): entity requires a <types> representation');
  expect(validateModelingNode(node(modern.replace('relations=[]', 'relations=[] fact_grade="historical-note"')), 'data-topology/v1')).toEqual([]);
});
it('indexes nested owners once, preserves source bytes and keeps local schema overrides from changing siblings', () => {
  const source = '<!-- original -->\n' + wrap(legacy.replace('(<types', '(<children [' + modern.replace('kind="object"', 'kind="object" modeling_schema="data-topology/v1"') + ']><types'), 'codument-legacy/v1');
  const input = new Map([['domain/orders/index.xnl', source]]);
  const index = indexKnowledgeSources(input, 'modeling');
  expect(index.findings).toEqual([]);
  expect([...index.registry.index.keys()]).toEqual(['domain.orders.authority', 'domain.orders.value']);
  const child = index.registry.index.get('domain.orders.value')!;
  expect(child.owner).toEqual({file: 'domain/orders/index.xnl', topLevelIndex: 0});
  expect(child.ancestors.map(item => item.id)).toContain('domain.orders.authority');
  expect(child.uri).toBe('modeling://domain/orders/value');
  expect(index.registry.sources.get('domain/orders/index.xnl')).toBe(source);
  expect(validateKnowledgeIndex(index)).toEqual([]);
  expect(input.get('domain/orders/index.xnl')).toBe(source);
});
it('does not admit unwrapped history, duplicate slots/ids/URIs, missing identities or unknown profiles as a usable index', () => {
  for (const source of [legacy, wrap(modern, 'unknown'), wrap(modern.replace('kind="object"', 'kind="object" modeling_schema="unknown"')),
    wrap(modern + modern), wrap(modern.replace('#domain.orders.value ', '')), wrap('42'),
    wrap(modern.replace('(<types', '(<types ?>first</?><types'))]) {
    const index = indexKnowledgeSources(new Map([['domain/orders/index.xnl', source]]), 'modeling');
    expect(index.ready).toBe(false);
    expect(validateKnowledgeIndex(index).some(finding => finding.severity === 'error')).toBe(true);
    expect(index.registry.sources.get('domain/orders/index.xnl')).toBe(source);
  }
  const duplicateUri = indexKnowledgeSources(new Map([['domain/orders/index.xnl', wrap(modern + modern.replace('#domain.orders.value', '#orders.value'))]]), 'modeling');
  expect(duplicateUri.findings.map(finding => finding.rule)).toContain('modeling.duplicate-uri');
});
it('validates original minimum representations for every engineering kind and keeps nested schema checks', () => {
  const shapes = {overview: ['desc', 'mental-model'], howto: ['when-to-use', 'steps', 'verification'], rule: ['rule', 'rationale', 'enforcement'],
    example: ['scenario', 'walkthrough'], reference: ['scope', 'source-of-truth', 'update-procedure'], troubleshooting: ['symptoms', 'diagnosis', 'fix'],
    runbook: ['preconditions', 'steps', 'verification', 'rollback'], 'code-map': ['scope', 'paths', 'update-procedure']};
  for (const [kind, tags] of Object.entries(shapes)) {
    const source = `<knowledge #global.overview.project.example {kind="${kind}"} (${tags.map(tag => `<${tag} ?>authored</?>`).join('')})>`;
    expect(validateEngineeringNode(node(source))).toEqual([]);
    expect(validateEngineeringNode(node(source.replace(`<${tags[0]} ?>authored</?>`, '')))).toHaveLength(1);
    const index = indexKnowledgeSources(new Map([['global/overview/project/index.xnl', `<EngineeringRegistry #knowledge.project ${envelope} [${source}]>`]]), 'engineering');
    expect(validateKnowledgeIndex(index)).toEqual([]);
  }
});
it('retains cross-file reference/path/plane checks and uses the same modeling URI for deltas', () => {
  const referenced = modern.replace('relations=[]', 'relations=[{relation="observes" target="modeling://domain/orders/authority"}]');
  const sources = new Map([['domain/orders/index.xnl', wrap(referenced)], ['domain/orders/other.xnl', wrap(legacy, 'codument-legacy/v1', 'knowledge.other')]]);
  expect(validateKnowledgeIndex(indexKnowledgeSources(sources, 'modeling'))).toEqual([]);
  sources.delete('domain/orders/other.xnl');
  expect(validateKnowledgeIndex(indexKnowledgeSources(sources, 'modeling')).map(finding => finding.rule)).toContain('modeling.dangling-reference');
  const delta = indexKnowledgeSources(new Map([['domain/orders.xnl', wrap(modern)]]), 'modeling', 'deltas');
  expect(delta.registry.index.get('domain.orders.value')?.uri).toBe('modeling://domain/orders/value');
  expect(validateKnowledgeIndex(delta)).toEqual([]);
  const misplaced = indexKnowledgeSources(new Map([['backend/other/index.xnl', wrap(modern)]]), 'modeling');
  expect(validateKnowledgeIndex(misplaced).map(finding => finding.rule)).toEqual(expect.arrayContaining(['modeling.id-context-mismatch', 'modeling.id-plane-mismatch', 'modeling.missing-domain-plane']));
  const empty = validateKnowledgeIndex(indexKnowledgeSources(new Map(), 'modeling'));
  expect(empty).toHaveLength(1); expect(empty[0].severity).toBe('warning');
});
