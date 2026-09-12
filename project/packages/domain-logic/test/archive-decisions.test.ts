import { expect, it } from 'bun:test';
import { proposeArchiveDecisions, readDataForestSourceFragments, validateDecisionSources } from '../src';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
function decision(id: string, durable = true, children = '', properties = ''): string {
  return `<decision #${id} ${envelope} {status="accepted" durable_candidate=${durable} confidence="high" reversibility="reversible" ${properties}} (
  <question ?>What should survive?</?>
  <answer (<raw-answer ?>Keep it.</?><decision-text ?>Preserve the complete tree.</?><rationale ?>Authority must remain explicit.</?><evidence ?>Source fixture.</?>)>
  <!-- KEEP INNER COMMENT --> <opaque {nested={keep=[true 7 "中文"]}} ?>unknown payload</?>
) [${children}]>`;
}
it('locates exact complete source roots despite nested data, text delimiters and comments', () => {
  const first = decision('first', false, '<decision #child {status="resolved"}>'), second = decision('second');
  const source = `<!-- between-root remarks remain in archived source -->\r\n${first}\n${second}\n`;
  const fragments = readDataForestSourceFragments(source);
  expect(fragments.map(item => item.source)).toEqual([first, second]);
  expect(fragments[0].source).toContain('KEEP INNER COMMENT');
  expect(() => readDataForestSourceFragments('<Root (<same><same>)>')).toThrow('unambiguous');
});
it('promotes complete durable closures with original source fragments and stable business owner placement', () => {
  const child = decision('parent.child').replace(` ${envelope}`, '');
  const parent = decision('parent', false, child), dependency = decision('dependent', true, '', 'depends_on=["parent.child"] activation={all=["parent=chosen"]}');
  const processSources = new Map([['decisions/business/topic.xnl', parent + '\n' + decision('unselected', false)], ['decisions/platform/runtime.xnl', dependency]]);
  const existing = '<!-- PRESERVE CANONICAL -->\n' + decision('existing', false) + '\r\n';
  const canonicalSources = new Map([['business/topic.xnl', existing]]);
  const result = proposeArchiveDecisions({processSources, canonicalSources});
  expect([...result.updates.keys()]).toEqual(['business/topic.xnl', 'platform/runtime.xnl']);
  expect(result.updates.get('business/topic.xnl')).toStartWith(existing);
  expect(result.updates.get('business/topic.xnl')).toContain(parent);
  expect(result.updates.get('business/topic.xnl')).not.toContain('#unselected');
  expect(result.updates.get('platform/runtime.xnl')).toContain(dependency);
  const published = new Map([...canonicalSources, ...result.updates]);
  expect(validateDecisionSources(published).filter(finding => finding.severity === 'error')).toEqual([]);
  expect(proposeArchiveDecisions({processSources, canonicalSources: published}).updates.size).toBe(0);
  expect(canonicalSources.get('business/topic.xnl')).toBe(existing);
  // An identical tree already owned elsewhere is not copied to a second path.
  expect(proposeArchiveDecisions({processSources: new Map([['decisions/new/path.xnl', parent]]), canonicalSources: new Map([['old/owner.xnl', parent]])}).updates.size).toBe(0);
});
it('rejects root-level durable promotion, partial owner overlap, changed hierarchy and unresolved cross-file dependencies', () => {
  const parent = decision('parent', false, decision('parent.child').replace(` ${envelope}`, ''));
  expect(() => proposeArchiveDecisions({processSources: new Map([['decisions.xnl', parent]]), canonicalSources: new Map()})).toThrow('business-semantic owner');
  expect(() => proposeArchiveDecisions({processSources: new Map([['decisions/.hidden/owner.xnl', parent]]), canonicalSources: new Map()})).toThrow('visible');
  const processSources = new Map([['decisions/business/owner.xnl', parent]]);
  expect(() => proposeArchiveDecisions({processSources, canonicalSources: new Map([['elsewhere.xnl', decision('parent', false)]])})).toThrow('partially overlaps');
  expect(() => proposeArchiveDecisions({processSources, canonicalSources: new Map([['elsewhere.xnl', parent.replace('unknown payload', 'independent edit')]])})).toThrow('changes an existing owner');
  expect(() => proposeArchiveDecisions({processSources: new Map([['decisions/business/owner.xnl', decision('dangling', true, '', 'depends_on=["missing"]')]]), canonicalSources: new Map()})).toThrow('unresolved');
  expect(() => proposeArchiveDecisions({processSources: new Map([['decisions/one.xnl', parent], ['decisions/two.xnl', parent]]), canonicalSources: new Map()})).toThrow('Duplicate');
  const source = decision('processOnly', false);
  expect(proposeArchiveDecisions({processSources: new Map([['decisions.xnl', source]]), canonicalSources: new Map()}).updates.size).toBe(0);
});
