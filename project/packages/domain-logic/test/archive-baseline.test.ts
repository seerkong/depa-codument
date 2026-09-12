import { expect, it } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { selectKnowledgeArchiveBaseline } from '../src';
const root = (fields = '') => parseXnl(`<Track #example {${fields}}>`).nodes[0] as DataElementNode;
it('keeps the no-baseline first-registry rule and never guesses a base for existing knowledge', () => {
  const empty = new Map<string, string>(), existing = new Map([['domain/orders/index.xnl', 'authored']]);
  for (const family of ['modeling', 'engineering'] as const) {
    expect(selectKnowledgeArchiveBaseline(root(), family, empty)).toEqual({kind: 'empty'});
    expect(() => selectKnowledgeArchiveBaseline(root(), family, existing)).toThrow(`no ${family}_base_commit`);
    expect(selectKnowledgeArchiveBaseline(root(`${family}_base_commit="abc123"`), family, existing)).toEqual({kind: 'git', commit: 'abc123'});
    for (const value of ['true', '"--help"', '"a b"']) expect(() => selectKnowledgeArchiveBaseline(root(`${family}_base_commit=${value}`), family, empty)).toThrow('Invalid');
  }
});
