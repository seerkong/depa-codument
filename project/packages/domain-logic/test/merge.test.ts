import { describe, expect, it } from 'bun:test';
import { parseXnl } from 'xnl-core';
import { mergeXnlNodes } from '../src/merge';
import { serializeXnlForest } from '../src/registry';

function nodes(source: string) {
  return parseXnl(source, { textBlockStyle: true }).nodes;
}

function mergedText(result: ReturnType<typeof mergeXnlNodes>): string {
  return serializeXnlForest([...result.merged.values()], { textMarkerFactory: () => 'TEST' });
}

describe('generic conservative XNL node merge', () => {
  it('merges disjoint changes to a complete decision node', () => {
    const base = nodes('<decision #decision.a { status = "accepted" confidence = 0.8 }>');
    const ours = nodes('<decision #decision.a { status = "resolved" confidence = 0.8 }>');
    const theirs = nodes('<decision #decision.a { status = "accepted" confidence = 0.9 }>');
    const result = mergeXnlNodes(base, ours, theirs);
    expect(result.conflicts).toEqual([]);
    expect(mergedText(result)).toContain('status = "resolved"');
    expect(mergedText(result)).toContain('confidence = 0.9');
  });

  it('reports same-field, add-add, and delete-modify conflicts', () => {
    const sameField = mergeXnlNodes(
      nodes('<decision #decision.a { status = "accepted" }>'),
      nodes('<decision #decision.a { status = "resolved" }>'),
      nodes('<decision #decision.a { status = "deferred" }>'),
    );
    expect(sameField.conflicts.map(({ type }) => type)).toEqual(['same-field']);

    const addAdd = mergeXnlNodes(
      [],
      nodes('<decision #decision.a { status = "resolved" }>'),
      nodes('<decision #decision.a { status = "deferred" }>'),
    );
    expect(addAdd.conflicts.map(({ type }) => type)).toEqual(['add-add']);

    const deleteModify = mergeXnlNodes(
      nodes('<decision #decision.a { status = "accepted" }>'),
      [],
      nodes('<decision #decision.a { status = "resolved" }>'),
    );
    expect(deleteModify.conflicts.map(({ type }) => type)).toEqual(['delete-modify']);
  });

  it('is idempotent for equivalent repeated nodes and rejects duplicate input ids', () => {
    const source = nodes('<decision #decision.a { status = "accepted" }>');
    const result = mergeXnlNodes([], source, source);
    expect(result.conflicts).toEqual([]);
    expect(result.merged.size).toBe(1);
    expect(() => mergeXnlNodes([], [...source, ...source], [])).toThrow(/Duplicate XNL node id/);
  });

  it('does not silently discard identity-less or non-resource input', () => {
    expect(() => mergeXnlNodes(nodes('<decision>'), [], [])).toThrow('stable identity');
    expect(() => mergeXnlNodes([{ kind: 'Comment', value: 'preserve outside selected merge input' }], [], [])).toThrow('selected');
  });

  it('returns owned copies so later proposal edits cannot mutate source facts', () => {
    const source = nodes('<decision #decision.a { status = "accepted" }>');
    const before = structuredClone(source);
    const result = mergeXnlNodes([], source, source);
    expect(result.merged.get('decision.a')).not.toBe(source[0]);
    expect(source).toEqual(before);
    expect(() => mergeXnlNodes([], source, source, { 'same-field': 'invalid', 'add-add': 'human', 'delete-modify': 'human' } as never)).toThrow('Unknown');
  });

  it('requires conflicts for array edits whose index shifts are order-sensitive', () => {
    const base = nodes('<decision #decision.a { steps = ["a" "b" "c"] }>');
    const ours = nodes('<decision #decision.a { steps = ["b" "c"] }>');
    const theirs = nodes('<decision #decision.a { steps = ["a" "b" "changed"] }>');
    const result = mergeXnlNodes(base, ours, theirs);
    expect(result.conflicts.map((conflict) => conflict.type)).toEqual(['same-field']);
    expect(result.merged.size).toBe(0);
  });

  it('retains explicit human/ours/theirs/base policies without weakening default conflict behavior', () => {
    const base = nodes('<decision #decision.a { status = "accepted" }>');
    const ours = nodes('<decision #decision.a { status = "resolved" }>');
    const theirs = nodes('<decision #decision.a { status = "deferred" }>');
    for (const [resolution, expected] of [['ours', 'resolved'], ['theirs', 'deferred'], ['base', 'accepted']] as const) {
      const result = mergeXnlNodes(base, ours, theirs, { 'same-field': resolution, 'add-add': 'human', 'delete-modify': 'human' });
      expect(result.conflicts).toEqual([]);
      expect(mergedText(result)).toContain(`status = "${expected}"`);
    }
  });
  it('does not classify presentation-only text delimiters or property order as semantic conflicts', () => {
    const base = nodes('<Node #one {a=1 b=1} (<text ?BASE>Meaning</?BASE>)>');
    const ours = nodes('<Node #one {b=1 a=2} (<text ?OURS>Meaning</?OURS>)>');
    const theirs = nodes('<Node #one {a=1 b=2} (<text ?THEIRS>Meaning</?THEIRS>)>');
    const result = mergeXnlNodes(base, ours, theirs);
    expect(result.conflicts).toEqual([]);
    expect(mergedText(result)).toContain('a = 2'); expect(mergedText(result)).toContain('b = 2');
  });
});
