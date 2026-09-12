import {expect, it} from 'bun:test';
import {parseXnl, type DataElementNode} from 'xnl-core';
import {patchDataTreeSource} from '../src';

function root(source: string): DataElementNode {return parseXnl(source, {textBlockStyle: true}).nodes[0] as DataElementNode;}
it('patches nested values and body edits without erasing comments, unchanged literals or extensions', () => {
  const source = '<!-- PREFIX -->\r\n<Owner #owner extension={unknown=[1 "keep"]} {profile=\'old\'} [\r\n'
    + '<Node #one {config={a=1 <!-- INNER --> b=[1 2]} untouched=\'literal\'} (<text ?TXT>KEEP <Node #fake> <!-- text --> </?TXT>)>\r\n'
    + '<!-- BETWEEN --><Node #two {value="old"}>\r\n]><!-- SUFFIX -->';
  const before = root(source), after = structuredClone(before);
  const first = after.body![0] as DataElementNode;
  (first.attributes!.config as Record<string, unknown>).a = 2;
  (first.attributes!.config as Record<string, unknown>).b = [1, 3, 4];
  after.body!.splice(1, 1, root('<Node #three {value="new"}>'));
  const result = patchDataTreeSource(source, before, after);
  expect(root(result)).toEqual(after);
  for (const fragment of ['<!-- PREFIX -->\r\n', '<!-- INNER -->', '<!-- BETWEEN -->', '<!-- SUFFIX -->', "untouched='literal'", 'extension={unknown=[1 "keep"]}', '<text ?TXT>KEEP <Node #fake> <!-- text --> </?TXT>']) expect(result).toContain(fragment);
  expect(source).toContain('#two');
  expect(patchDataTreeSource(result, after, structuredClone(after))).toBe(result);
});
it('keeps comments from removed syntax, admits explicit text edits, and preserves unrelated child bytes', () => {
  const source = '<Owner #owner {removed={a=1 <!-- KEEP REMOVAL --> b=2}} [<Node #old <!-- KEEP NODE --> {v=1}>] (<text ?DOC>old</?DOC> <unknown {v=\'exact\'}>)>';
  const before = root(source), after = structuredClone(before);
  delete after.attributes!.removed;
  after.body = [];
  const text = after.extend!.children.text;
  if (text.kind !== 'TextElement') throw new Error('fixture');
  text.text = 'new </?other> <Node #opaque>';
  const result = patchDataTreeSource(source, before, after);
  expect(root(result)).toEqual(after);
  expect(result).toContain('<!-- KEEP REMOVAL -->'); expect(result).toContain('<!-- KEEP NODE -->');
  expect(result).toContain("<unknown {v='exact'}>");
});
it('rejects stale and ambiguous sources and makes no-op patches byte-identical', () => {
  const source = '<Owner #owner {v=1}><!-- trailing -->', before = root(source);
  expect(patchDataTreeSource(source, before, structuredClone(before))).toBe(source);
  expect(() => patchDataTreeSource(source.replace('v=1', 'v=2'), before, before)).toThrow('changed');
  const ambiguous = '<Owner (<Same><Same>)>';
  expect(() => patchDataTreeSource(ambiguous, root(ambiguous), root('<Owner>'))).toThrow('unambiguous');
});
it('handles distant changes in a large subject without imposing a smaller authoring limit', () => {
  const source = '<Owner #owner {' + Array.from({length: 900}, (_, index) => `field${index}=${index} `).join('') + '}>';
  const before = root(source), after = structuredClone(before);
  after.attributes!.field0 = -1; after.attributes!.field899 = -2;
  const result = patchDataTreeSource(source, before, after);
  expect(root(result)).toEqual(after); expect(result).toContain('field450=450');
});
it('checks deterministic structural-edit combinations against the canonical parser', () => {
  const source = '<Owner #owner metadata={opaque=[true "中文"]} {a=1 nested={x="old" y=[1 2 3]}} [<Child #a {v=1}><!-- FIXED --><Child #b {v=2}>] (<text ?FIX>original</?FIX>)>';
  for (let variant = 0; variant < 64; variant++) {
    const before = root(source), after = structuredClone(before);
    if (variant & 1) after.attributes!.a = false;
    if (variant & 2) after.attributes!.nested = {x: 'new "quoted"', y: [3, 1], extra: null};
    if (variant & 4) after.body!.reverse();
    if (variant & 8) after.body!.push(root('<Child #c {v=3}>'));
    if (variant & 16) after.body!.splice(0, 1);
    if (variant & 32) after.metadata.metadata = {opaque: ['changed'], newKey: 3};
    let result: string;
    try {result = patchDataTreeSource(source, before, after);}
    catch (cause) {throw new Error(`Structural edit variant ${variant}`, {cause});}
    expect(root(result)).toEqual(after); expect(result).toContain('<!-- FIXED -->');
  }
});
it('keeps opening tag names indivisible when unrelated child syntax is removed', () => {
  const source = '<Owner [<First #one {a=1}><Second #two {b=2}>]>';
  const before = root(source), after = structuredClone(before);
  after.body!.splice(0, 1);
  expect(root(patchDataTreeSource(source, before, after))).toEqual(after);
});
it('chooses a deterministic safe delimiter when new text contains the prior closer', () => {
  const source = '<Owner #owner (<text ?DOC>old</?DOC>)>', before = root(source), after = structuredClone(before);
  const text = after.extend!.children.text;
  if (text.kind !== 'TextElement') throw new Error('fixture');
  text.text = 'literal </?DOC> and </?CODUMENT_PATCH> must survive';
  const result = patchDataTreeSource(source, before, after);
  const actual = root(result).extend!.children.text;
  if (actual.kind !== 'TextElement') throw new Error('fixture');
  expect(actual.text).toBe(text.text); expect(actual.textMarker).not.toBe('DOC');
  expect(patchDataTreeSource(source, before, after)).toBe(result);
});
