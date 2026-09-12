import { expect, it } from 'bun:test';
import { proposeDecisionCreation, validateDecisionSources } from '../src';

const metadata = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const root = `<!-- keep -->\r\n<decision #root ${metadata} {status='accepted' extension={text="<decision #fake>"}} (<question ?TEXT>literal [ ] < > <!-- keep --></?TEXT>)>`;
it('creates a new decision forest or inserts one child while retaining every original byte', () => {
  const created = proposeDecisionCreation(undefined, { file: 'decisions.xnl', id: 'new' });
  expect(created).toContain('#new envelopeVersion=');
  expect(validateDecisionSources(new Map([['decisions.xnl', created]])).filter(finding => finding.severity === 'error')).toEqual([]);
  const appended = proposeDecisionCreation(root, { file: 'decisions.xnl', id: 'next' });
  expect(appended.startsWith(root + '\n')).toBe(true);
  const child = proposeDecisionCreation(root, { file: 'decisions.xnl', id: 'child', parent: 'root' });
  expect(child.startsWith(root.slice(0, -1))).toBe(true);
  expect(child).toContain('<decision #child {');
  const grandchild = proposeDecisionCreation(child, { file: 'decisions.xnl', id: 'grandchild', parent: 'child' });
  expect(grandchild).toContain('<decision #grandchild {');
  expect(grandchild).toContain('literal [ ] < > <!-- keep -->');
  const sibling = proposeDecisionCreation(child, { file: 'decisions.xnl', id: 'sibling', parent: 'root' });
  expect(sibling).toContain('<decision #sibling {');
  expect(validateDecisionSources(new Map([['decisions.xnl', sibling]])).filter(finding => finding.severity === 'error')).toEqual([]);
});
it('refuses duplicate identities, unknown parent, ambiguous input and historical authority', () => {
  for (const [source, id, parent] of [[root, 'root'], [root, 'new', 'missing'], [root + root, 'new'], [root.replace('specVersion=1', 'apiVersion="old"'), 'new']] as const) {
    expect(() => proposeDecisionCreation(source, { file: 'decisions.xnl', id, parent })).toThrow();
  }
  expect(() => proposeDecisionCreation(root, { file: 'decisions.md', id: 'new' })).toThrow('.xnl');
  expect(() => proposeDecisionCreation(root, { file: 'decisions.xnl', id: '../new' })).toThrow('Invalid');
});
