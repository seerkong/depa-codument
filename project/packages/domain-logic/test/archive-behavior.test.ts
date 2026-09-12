import {expect, it} from 'bun:test';
import {parseXnl, type DataElementNode} from 'xnl-core';
import {proposeArchiveBehaviors, validateBehaviorTree} from '../src';

const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const requirement = (id: string, text = 'Required behavior.') => `<Requirement #${id} {opaque={nested=[1 true "KEEP"]}} (<Statement ?TXT>${text}</?TXT>)>`;
const behavior = (capability: string, body: string) => `<!-- CANONICAL -->\r\n<Behavior #${capability} ${envelope} {unknown={retained=true}} (<Requirements [${body}]>)><!-- END -->`;
const patch = (operations: string) => `<BehaviorPatch #track.test.patch ${envelope} {capability="cli.one"} (<Mutations [${operations}]>)>`;
function apply(canonical: ReadonlyMap<string, string>, operations: string) {
  return proposeArchiveBehaviors({canonicalSources: canonical, patchSources: new Map([['behavior_deltas/cli/delta.xnl', patch(operations)]])});
}
function root(source: string): DataElementNode {return parseXnl(source, {textBlockStyle: true}).nodes[0] as DataElementNode;}
it('replaces only selected native subtrees, preserves unknown extensions and is idempotent', () => {
  const source = behavior('cli.one', requirement('R1') + '<!-- KEEP -->' + requirement('R2', 'Untouched.'));
  const input = new Map([['custom/owner.xnl', source]]);
  const operations = `<Upsert {selector="behavior://cli.one/requirements/R1"} (${requirement('R1', 'Changed.')})>`;
  const result = apply(input, operations), updated = result.updates.get('custom/owner.xnl')!;
  expect(result.capabilities).toEqual(['cli.one']);
  expect(updated).toContain('unknown={retained=true}'); expect(updated).toContain('opaque={nested=[1 true "KEEP"]}');
  expect(updated).toContain('Untouched.'); expect(updated).toContain('<!-- KEEP -->');
  expect(updated).toStartWith('<!-- CANONICAL -->\r\n'); expect(updated).toEndWith('<!-- END -->');
  expect(validateBehaviorTree(root(updated), 'custom/owner.xnl')).toEqual([]);
  expect(apply(new Map([['custom/owner.xnl', updated]]), operations).updates.size).toBe(0);
  expect(input.get('custom/owner.xnl')).toBe(source);
});
it('creates explicit capabilities, fills an omitted target identity and composes cross-capability moves', () => {
  const source = behavior('cli.one', requirement('R1') + requirement('R2'));
  const result = apply(new Map([['original.xnl', source]]),
    '<Move {selector="behavior://cli.one/requirements/R1" to="behavior://cli.two/requirements/Moved"}>'
    + `<Upsert {selector="behavior://cli.two/requirements/Added"} (${requirement('Added').replace('#Added', '')})>`);
  expect([...result.updates.keys()]).toEqual(['original.xnl', 'cli.two.xnl']);
  expect(result.updates.get('original.xnl')).not.toContain('#R1');
  const moved = result.updates.get('cli.two.xnl')!;
  expect(moved).toContain('#Moved'); expect(moved).toContain('#Added'); expect(moved).toContain('opaque');
  expect(validateBehaviorTree(root(moved), 'cli.two.xnl')).toEqual([]);
});
it('retains nested requirements/suites/cases selector aliases and rejects ambiguous targets', () => {
  const nested = `<Requirement #R1 (<Statement ?>Keep.</?><Suites [<Suite #S1 (<Cases [<Case #C1 {opaque={keep=[1 true]}} (<Then ?>Expected</?>)>]>)>]>)>`;
  const source = behavior('cli.one', nested + requirement('R2'));
  const operations = '<Move {selector="behavior://cli.one/requirements/R1/suites/S1/cases/C1" to="behavior://cli.one/requirements/R1/suites/S2/cases/C2"}>';
  const result = apply(new Map([['cli.one.xnl', source]]), operations).updates.get('cli.one.xnl')!;
  expect(result).toContain('#S2'); expect(result).toContain('#C2'); expect(result).not.toContain('#C1'); expect(result).toContain('opaque');
  const duplicate = behavior('cli.one', requirement('R1') + requirement('R1'));
  expect(() => apply(new Map([['cli.one.xnl', duplicate]]), '<Delete {selector="behavior://cli.one/requirements/R1"}>')).toThrow('Ambiguous');
});
it('rejects an invalid batch without mutating sources or publishing an earlier valid operation', () => {
  const source = behavior('cli.one', requirement('R1') + requirement('R2')), canonical = new Map([['cli.one.xnl', source]]);
  const first = `<Upsert {selector="behavior://cli.one/requirements/R1"} (${requirement('R1', 'Changed.')})>`;
  for (const invalid of [
    '<Delete {selector="behavior://cli.one/requirements/missing"}>',
    '<Delete {selector="behavior://cli.one"}>',
    '<Move {selector="behavior://cli.one/requirements/R1" to="behavior://cli.one/requirements/R1/suites/Child"}>',
    `<Upsert {selector="behavior://cli.one/requirements/R3"} (${requirement('Different')})>`,
    '<Move {selector="behavior://cli.one/requirements/R1" to="behavior://..%2Fescape/requirements/R1"}>',
  ]) expect(() => apply(canonical, first + invalid)).toThrow();
  expect(canonical.get('cli.one.xnl')).toBe(source);
  expect(() => apply(canonical, '<Delete {selector="behavior://cli.one/requirements/R1"}><Delete {selector="behavior://cli.one/requirements/R2"}>')).toThrow('至少需要一个 Requirement');
  expect(() => proposeArchiveBehaviors({canonicalSources: new Map([['a.xnl', source], ['b.xnl', source]]), patchSources: new Map([['delta.xnl', patch(first)]])})).toThrow('multiple source owners');
  expect(() => apply(new Map([['cli.one.xnl', source.replace(envelope, 'apiVersion="old" version=1')]]), first)).toThrow('migration');
});
it('resolves collections in either canonical structural section without flattening their payload', () => {
  const source = `<Behavior #cli.one ${envelope} [<Requirements {unknown={keep=true}} [${requirement('R1')}${requirement('R2')}]>]>`;
  const result = apply(new Map([['cli.one.xnl', source]]), '<Delete {selector="behavior://cli.one/requirements/R1"}>');
  expect(result.updates.get('cli.one.xnl')).not.toContain('#R1');
  expect(result.updates.get('cli.one.xnl')).toContain('unknown={keep=true}');
});
it('orders patch files deterministically, validates the final batch, and preserves replacement move semantics', () => {
  const source = behavior('cli.one', requirement('R1', 'First.') + requirement('R2', 'Second.'));
  const canonical = new Map([['cli.one.xnl', source]]);
  const first = patch('<Delete {selector="behavior://cli.one/requirements/R1"}>').replace('#track.test.patch', '#track.first');
  const second = patch(`<Upsert {selector="behavior://cli.one/requirements/R1"} (${requirement('R1', 'Recreated.')})>`).replace('#track.test.patch', '#track.second');
  const result = proposeArchiveBehaviors({canonicalSources: canonical, patchSources: new Map([['z.xnl', second], ['a.xnl', first]])});
  expect(result.updates.get('cli.one.xnl')).toContain('Recreated.');
  const moved = apply(canonical, '<Move {selector="behavior://cli.one/requirements/R1" to="behavior://cli.one/requirements/R2"}>').updates.get('cli.one.xnl')!;
  expect(moved).toContain('First.'); expect(moved).not.toContain('Second.'); expect(moved).not.toContain('#R1');
  expect(proposeArchiveBehaviors({canonicalSources: new Map([['old.xml', 'historical unrelated source']]), patchSources: new Map()})).toEqual({updates: new Map(), capabilities: []});
});
