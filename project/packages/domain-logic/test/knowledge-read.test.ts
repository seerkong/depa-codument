import { expect, it } from 'bun:test';
import { indexKnowledgeSources, lintKnowledgeIndex, readKnowledgeSettings, runKnowledgeRead } from '../src';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
it('retains config defaults, explicit typed settings and conflict policy without treating invalid config as a default', () => {
  expect(readKnowledgeSettings(undefined, 'modeling').enabled).toBe(true);
  expect(readKnowledgeSettings(undefined, 'engineering').enabled).toBe(false);
  const source = `<ModelingConfig #settings ${envelope} {enabled=false} (<Lint {max_lines=12 max_nodes=2}><MergePolicy (<Conflicts [<Conflict {type="same-field" resolve="ours"}>]>)>)>`;
  expect(readKnowledgeSettings(source, 'modeling')).toEqual({enabled: false, thresholds: {maxLines: 12, maxNodes: 2}, mergePolicy: {'same-field': 'ours', 'delete-modify': 'human', 'add-add': 'human'}});
  for (const invalid of [source.replace(envelope, ''), source.replace('enabled=false', 'enabled="false"'), source.replace('max_lines=12', 'max_lines=-1'),
    source.replace('resolve="ours"', 'resolve="ignore"'), source.replace('<Lint {max_lines=12 max_nodes=2}>', '<Lint><Lint>')]) expect(() => readKnowledgeSettings(invalid, 'modeling')).toThrow();
});
it('reads config and sources only as required by legacy gates; lint counts source and top-level members from one snapshot', async () => {
  const trace: string[] = [];
  const source = `<ModelingRegistry #knowledge ${envelope} {modeling_schema="data-topology/v1"} [
<object #domain.orders.first {kind="object"}><object #domain.orders.second {kind="object"}>
]>`;
  const port = {
    async readConfig() { trace.push('config'); return undefined; },
    async observe() { trace.push('sources'); return {directory: 'manual', sources: new Map([['domain/orders/index.xnl', source]])}; },
  };
  expect(await runKnowledgeRead(port, {family: 'engineering', operation: 'validate'})).toEqual({kind: 'skipped', family: 'engineering'});
  expect(trace).toEqual(['config']); trace.length = 0;
  const result = await runKnowledgeRead(port, {family: 'modeling', operation: 'validate', directory: 'manual'});
  expect(result.kind).toBe('validated'); expect(trace).toEqual(['sources']); trace.length = 0;
  const lint = await runKnowledgeRead(port, {family: 'modeling', operation: 'lint', directory: 'manual', maxLines: 1, maxNodes: 1});
  expect(trace).toEqual(['config', 'sources']);
  expect(lint).toEqual({kind: 'linted', family: 'modeling', directory: 'manual', findings: [{file: 'domain/orders/index.xnl', lines: 3, nodeCount: 2, reasons: ['3 lines > 1', '2 nodes > 1']}]});
  // Advisory lint must not become a schema verdict for these incomplete objects.
  expect(result.kind === 'validated' && result.findings.some(finding => finding.severity === 'error')).toBe(true);
  await expect(runKnowledgeRead(port, {family: 'modeling', operation: 'validate', directory: 'manual', deltas: 'example'})).rejects.toThrow('not both');
  await expect(runKnowledgeRead(port, {family: 'modeling', operation: 'lint', maxLines: NaN})).rejects.toThrow('non-negative');
  const invalidIndex = indexKnowledgeSources(new Map([['domain/orders/index.xnl', '<object #old>']]), 'modeling');
  expect(() => lintKnowledgeIndex(invalidIndex, {maxLines: 400, maxNodes: 8})).toThrow('migrate');
});
