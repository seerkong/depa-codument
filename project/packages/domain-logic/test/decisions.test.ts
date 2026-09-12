import { describe, expect, it } from 'bun:test';
import { parseXnl } from 'xnl-core';
import { projectDecisionFrontier, readDecisionRecords, validateDecisionSources } from '../src';

const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const full = `<decision #architecture ${envelope} {status="accepted" durable_candidate=true confidence="high" reversibility="reversible"} (
  <options [
    <option {key="A" title="Separate ownership" description="Use explicit ports" recommended=true}>
    <option {key="B" title="Shared object" description="Share implementation" recommended=false}>
  ]>
  <answer (
    <raw-answer ?>Choose A.</?>
    <decision-text ?>Use separate ownership.</?>
    <rationale ?>Keeps authority explicit.</?>
    <evidence ?>Observed two consumers.</?>
  )>
) [<decision #architecture.child {status="resolved"}>]>`;
function validate(source: string, strict = false) { return validateDecisionSources(new Map([['decisions/architecture.xnl', source]]), { strict }); }
function messages(source: string) { return validate(source).map((finding) => finding.message).join('\n'); }

describe('pure Decision source validation', () => {
  it('keeps exact option, answer, durable and nested decision read-model semantics', () => {
    expect(validate(full)).toEqual([]);
    const records = readDecisionRecords(parseXnl(full, { textBlockStyle: true }).nodes);
    expect(records.map((record) => record.id)).toEqual(['architecture', 'architecture.child']);
    expect(records[0]).toMatchObject({status: 'accepted', durableCandidate: true, rawAnswer: 'Choose A.', decisionText: 'Use separate ownership.', confidence: 'high', reversibility: 'reversible'});
    expect(records[0].options).toHaveLength(2);
    expect(records[0].options[0]).toMatchObject({key: 'A', title: 'Separate ownership', recommended: true});
  });

  it('preserves pending warnings, unresolved durable errors and strict severity promotion', () => {
    const pending = `<decision #pending ${envelope} {status="pending" blocks=["task:T1"]}>`;
    expect(validate(pending).map((finding) => finding.severity)).toEqual(['warning', 'warning']);
    expect(validate(pending, true).every((finding) => finding.severity === 'error')).toBe(true);
    expect(messages(full.replace('status="accepted"', 'status="pending"'))).toContain('durable candidate decision has unresolved status');
    expect(validate(full.replace('status="accepted"', 'status="deferred"'))).toEqual([]);
    expect(messages(full.replace('confidence="high"', 'confidence="-"'))).toContain('missing Confidence');
  });

  it('checks option placement, required fields, duplicate keys and exactly one recommendation', () => {
    expect(messages(full.replace('key="B"', 'key="A"'))).toContain('option key is duplicated');
    expect(messages(full.replace('key="A"', ''))).toContain('option is missing key');
    expect(messages(full.replace('title="Shared object"', ''))).toContain('missing title');
    expect(messages(full.replace('description="Share implementation"', ''))).toContain('missing description');
    expect(messages(full.replace('recommended=false', 'recommended=true'))).toContain('exactly one recommended option');
    expect(messages(`<decision #bad ${envelope} [<option {key="A"}>]>`)).toContain('option must be inside an options wrapper');
    expect(messages(`<decision #bad ${envelope} [<options []>]>`)).toContain('options must be inside the decision extend block');
    expect(messages(`<decision #bad ${envelope} (<options [<unexpected>]>)>`)).toContain('options may contain only option child nodes');
  });

  it('keeps complete answer feedback requirements and rejects invalid answer placements', () => {
    expect(messages(full.replace('Choose A.', '-'))).toContain('answer is missing Raw answer');
    expect(messages(full.replace('Use separate ownership.', ''))).toContain('answer is missing Decision text');
    expect(messages(full.replace('Keeps authority explicit.', '-'))).toContain('answer is missing Rationale');
    expect(messages(full.replace('Observed two consumers.', '-'))).toContain('answer is missing Evidence');
    expect(messages(full.replace('<raw-answer', '<unknown-answer'))).toContain('answer may contain only');
    expect(messages(`<decision #bad ${envelope} [<answer>]>`)).toContain('answer must be inside the decision extend block');
  });

  it('detects nested decisions hidden in singleton slots, objects and arrays without discarding their source', () => {
    for (const source of [
      `<decision #root ${envelope} (<decision #hidden>)>`,
      `<decision #root ${envelope} {opaque={nested=[<decision #hidden>]}}>`,
      `<decision #root ${envelope} [<container [<decision #hidden>]>]>`,
    ]) expect(messages(source)).toContain('nested decision must be a direct child');
    expect(messages(`<decision #root ${envelope} ["unexpected text"]>`)).toContain('decision body may contain only nested decision nodes');
    expect(messages(`<DecisionTree #old ${envelope} [<decision #child>]>`)).toContain('top-level roots must use <decision>');
  });

  it('resolves cross-file logical references independently of filenames and detects dependency cycles', () => {
    const root = `<decision #root ${envelope} {status="accepted"}>`;
    const child = `<decision #child ${envelope} {status="resolved" depends_on=["decision://root"] activation={all=["root=A"] any=["decision://root=B"]} derived_from=["root=A"]}>`;
    const sources = new Map([['nested/unrelated-name.xnl', child], ['business/owner.xnl', root]]);
    expect(validateDecisionSources(sources)).toEqual([]);
    sources.set('business/owner.xnl', root.replace('status="accepted"', 'status="accepted" depends_on=["child"]'));
    expect(validateDecisionSources(sources).some((finding) => finding.message.includes('contains a cycle'))).toBe(true);
    expect(messages(child)).toContain('unresolved depends_on');
    expect(messages(child)).toContain('unresolved activation');
    expect(messages(child)).toContain('unresolved derived_from');
  });

  it('includes implicit parent dependencies and refuses malformed reference containers', () => {
    expect(messages(`<decision #root ${envelope} {depends_on=["child"]} [<decision #child>]>`)).toContain('contains a cycle');
    expect(messages(`<decision #root ${envelope} {depends_on="child" activation=[] derived_from=[3]}>`)).toContain('depends_on must be an array');
    expect(messages(`<decision #root ${envelope} {activation=[]}>`)).toContain('activation must be an object');
    expect(messages(`<decision #root ${envelope} {activation={all=["root"]}}>`)).toContain('malformed activation');
    expect(messages(`<decision #root ${envelope} {derived_from=[3]}>`)).toContain('derived_from must contain only non-empty strings');
  });

  it('rejects duplicate and absent IDs, old envelopes, malformed XNL and collapsed singleton slots', () => {
    expect(messages(full + full)).toContain('Duplicate decision node id');
    expect(messages(`<decision ${envelope}>`)).toContain('missing a stable id');
    expect(messages(full.replace(envelope, 'apiVersion="old" version="1"'))).toContain('requires migration');
    expect(validate('<decision #broken')[0].layer).toBe('syntax');
    const collapsed = `<decision #root ${envelope} (<answer><answer>)>`;
    const findings = validate(collapsed);
    expect(findings[0].layer).toBe('syntax');
    expect(findings[0].severity).toBe('error');
  });

  it('projects the pending frontier with parent gates, resolved dependencies, priority and portable provenance', () => {
    const sources = new Map([
      ['owners/parent.xnl', `<decision #parent ${envelope} {status="accepted"} [<decision #child {status="pending" priority="P1" question="Choose a child?" recommendation="A"}>]>`],
      ['unrelated/file.xnl', `<decision #urgent ${envelope} {status="pending" priority="P0" depends_on=["decision://parent"]}> <decision #blocked ${envelope} {status="pending" depends_on=["urgent"]}>`],
    ]);
    expect(projectDecisionFrontier(sources)).toEqual([
      {id: 'urgent', priority: 'P0', question: undefined, recommendation: undefined, depends_on: ['decision://parent'], parent: undefined, source: 'unrelated/file.xnl'},
      {id: 'child', priority: 'P1', question: 'Choose a child?', recommendation: 'A', depends_on: [], parent: 'parent', source: 'owners/parent.xnl'},
    ]);
    sources.set('owners/parent.xnl', sources.get('owners/parent.xnl')!.replace('status="accepted"', 'status="pending"'));
    expect(projectDecisionFrontier(sources).map((entry) => entry.id)).toEqual(['parent']);
    sources.set('owners/parent.xnl', sources.get('owners/parent.xnl')!.replace('status="pending"', 'status="deferred"'));
    expect(projectDecisionFrontier(sources).map((entry) => entry.id)).toEqual(['urgent', 'child']);
  });

  it('never derives a successful frontier from a broken or ambiguous source graph', () => {
    expect(() => projectDecisionFrontier(new Map([['a.xnl', `<decision #a ${envelope} {status="pending" depends_on=["missing"]}>`]]))).toThrow('unresolved');
    expect(() => projectDecisionFrontier(new Map([['a.xnl', full + full]]))).toThrow('Duplicate');
    expect(() => projectDecisionFrontier(new Map([['a.xnl', '<decision #broken']]))).toThrow('invalid XNL');
  });
});
