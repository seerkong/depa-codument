import { expect, test } from 'bun:test';
import { readUiProposal, uiProposalSchema } from './ui-proposal';

test('structured output is the selected advisory transport, never a second verdict authority', () => {
  const files: Record<string, string> = { scratch: '{"status":"passed"}', final: '{"status":"failed"}' };
  const reader = { readText: (file: string) => files[file] };
  expect(readUiProposal(reader, { advisoryFile: 'scratch', structuredOutput: 'final' })).toEqual({status:'failed'});
  expect(() => readUiProposal(reader, { advisoryFile: 'scratch', structuredOutput: 'missing' })).toThrow('no advisory');
  expect(readUiProposal(reader, { advisoryFile: 'scratch' })).toEqual({status:'passed'});
});

test.each(['UI verdict: failed', '```json\n{"status":"passed"}\n```', 'null', '[]', 'true'])('prose and non-object outputs cannot fabricate a proposal: %s', (source) => {
  expect(() => readUiProposal({readText: () => source}, {advisoryFile:'final'})).toThrow('not a JSON object');
});

test('schema constrains transport representation, not business assertions', () => {
  const schema = uiProposalSchema('session-1') as {required:string[];properties:Record<string, {enum?:string[];items?:{properties:Record<string,unknown>}}>};
  expect(schema.properties.session?.enum).toEqual(['session-1']);
  expect(schema.properties.status?.enum).toEqual(['passed','failed','infrastructure-failed']);
  expect(schema.required).toContain('findingEvidence');
  expect(schema.properties.actions?.items?.properties).toHaveProperty('observationId');
  expect(schema.properties.actions?.items?.properties).not.toHaveProperty('observed');
  expect(JSON.stringify(schema)).not.toContain('todo');
});
