import { describe, expect, test } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { inspectResourceMigration, planResourceMigration } from '../src/migration';

describe('bootstrap migration proposals', () => {
  test('patches known envelopes without changing identity, arbitrary values, comments or hook order', () => {
    const source = '<!-- before -->\n<Track #original apiVersion="codument.tech/v1alpha1" version="1" {status="active" gap_round=2 custom=["x" 42]} (\n'
      + '<!-- do not drop this evidence -->\n<Hooks [<GapLoop {rounds=3}> <AttractorCheck {profile="depa"}>]>\n<Goal ?>Keep this exact text and </?not-the-end>\n</?>\n)>\n<!-- after -->\n';
    const input = {path: 'codument/tracks/active/original/track.xnl', source};
    const plan = planResourceMigration(input);
    expect(plan.status).toBe('planned');
    expect(plan).toEqual(planResourceMigration(input));
    const target = plan.proposal!.source!;
    expect(target).toStartWith('<!-- before -->\n');
    expect(target).toEndWith('\n<!-- after -->\n');
    expect(target).toContain('<!-- do not drop this evidence -->');
    const before = parseXnl(source, {textBlockStyle: true}).nodes[0] as DataElementNode;
    const after = parseXnl(target, {textBlockStyle: true}).nodes[0] as DataElementNode;
    expect({...after, metadata: before.metadata}).toEqual(before);
    expect(after.metadata).toEqual({envelopeVersion: 'halfcode.resource-envelope/v1', specVersion: 1});
    expect(planResourceMigration({...input, source: target})).toMatchObject({status: 'noop'});
    // A deterministic proposal is deliberately not a claim that incomplete Track semantics passed.
    expect(plan).not.toHaveProperty('valid');
  });

  test('retains between-root comments and nested Decision bodies', () => {
    const source = '<decision #a apiVersion="codument.tech/v1alpha1" [<decision #child {status="pending"}>]>\n<!-- forest ownership -->\n<decision #b {status="pending"}>\n';
    const plan = planResourceMigration({path: 'codument/decisions/global.xnl', source});
    expect(plan.status).toBe('planned');
    expect(plan.proposal!.source).toContain('<!-- forest ownership -->');
    expect(plan.proposal!.source).toContain('<decision #child {status="pending"}>');
    expect(parseXnl(plan.proposal!.source!, {textBlockStyle: true}).nodes).toHaveLength(2);
  });

  test('fails closed on unknown versions, ambiguity and semantic owner decisions', () => {
    const sources = [
      '<Track #t apiVersion="future/v99">', '<Track #t version="2">',
      '<Track #t envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 apiVersion="codument.tech/v1alpha1">',
      '<Track #t envelopeVersion="halfcode.resource-envelope/v1" specVersion=99>',
      '<Mystery #x>', '<Track #t> <Mission #m>', '<Track #t> <Track #u>', '<Track>',
      '<decision-tree #owner {extension="retain"} [<decision #d>]>',
      '<decision #d {durable_candidate=true}>', '<Track #t (<Goal ?one</?> <Goal ?two</?>)>',
      '\uFEFF<Track #t>',
    ];
    for (const source of sources) {
      const plan = planResourceMigration({path: 'codument/tracks/active/t/decisions.xnl', source});
      expect(plan.status).toBe('review-required');
      expect(plan.diagnostics.length).toBeGreaterThan(0);
      expect(plan.proposal).toBeUndefined();
    }
  });

  test('preserves explicit process-local Decision owners while reviewing unowned durable forests', () => {
    for (const durable of ['durable_candidate=true', 'durable_candidate="TRUE"', 'durable-candidate=true']) {
      const source = `<decision #d {${durable}}>`;
      for (const path of ['codument/decisions/global.xnl', 'codument/tracks/active/t/decisions/runtime.xnl', 'codument/missions/archived/m/decisions/decisions.xnl']) {
        expect(planResourceMigration({path, source}).status).toBe('planned');
      }
      expect(planResourceMigration({path: 'codument/tracks/active/t/decisions.xnl', source}).status).toBe('review-required');
    }
  });

  test('distinguishes non-writing inspection, unsupported inputs, and empty forest retirement', () => {
    expect(inspectResourceMigration({path: 'codument/decision.md', source: '# Decision\nKeep alternatives'}).format).toBe('markdown');
    expect(planResourceMigration({path: 'codument/decision.md', source: '# Decision'}).status).toBe('review-required');
    expect(planResourceMigration({path: 'codument/track.xml', source: '<Track />'}).status).toBe('review-required');
    expect(planResourceMigration({path: 'codument/tracks/active/t/decisions.xnl', source: '<!-- audit comment -->\n'})).toMatchObject({status: 'planned', proposal: {source: null}});
    expect(planResourceMigration({path: 'codument/anything.xnl', source: ''}).status).toBe('review-required');
    expect(() => planResourceMigration({path: '../outside.xnl', source: ''})).toThrow('relative');
    const a = inspectResourceMigration({path: 'a.xnl', source: '<Track #a>'});
    const b = inspectResourceMigration({path: 'a.xnl', source: '<Track #b>'});
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});
