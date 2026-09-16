import { expect, it } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { proposeScaffold, validateScaffoldRequest, validateLifecycleTree } from '../src';
import type { ScaffoldLocation, ScaffoldRequest } from 'depa-codument-domain-contract';
const at = '2026-09-06T12:00:00.000Z';
function location(request: ScaffoldRequest): ScaffoldLocation {
  return { request, stage: request.stage, directory: 'explicit-target', sourceRevision: 'test', gitHead: 'a'.repeat(40) };
}
it('produces current envelopes with original pending/active semantics and explicitly unfinished authoring state', () => {
  for (const kind of ['Track', 'Mission'] as const) for (const stage of ['pending', 'active'] as const) {
    const input = location({ kind, stage, id: 'new-feature' });
    const before = structuredClone(input);
    const files = proposeScaffold(input, at);
    expect(Object.keys(files)).toEqual([kind.toLowerCase() + '.xnl', 'proposal.md', 'design.md']);
    const source = files[kind.toLowerCase() + '.xnl'];
    const parsed = parseXnl(source, { textBlockStyle: true });
    expect(parsed.warnings ?? []).toEqual([]);
    const root = parsed.nodes[0] as DataElementNode;
    expect(root.metadata).toEqual({ envelopeVersion: 'halfcode.resource-envelope/v1', specVersion: 1 });
    expect(root.attributes?.created_at).toBe(at);
    if (kind === 'Mission') expect(source).toContain('MissionReconciler');
    expect(validateLifecycleTree(root, { file: 'source', profileNames: [] }).some(finding => finding.rule.includes('phase-missing'))).toBe(true);
    expect(input).toEqual(before);
  }
});
it('rejects unsafe identity, stage, capability and unobserved timestamps before proposing writes', () => {
  expect(() => validateScaffoldRequest({ kind: 'Track', id: '../outside', stage: 'pending' })).toThrow();
  expect(() => proposeScaffold(location({ kind: 'Mission', id: 'valid', stage: 'pending' }), 'not-a-date')).toThrow('timestamp');
});
