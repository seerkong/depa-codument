import { describe, expect, it } from 'bun:test';
import { explainXnlParseError, xmlStyleTextClosers } from '../src/xnl-diagnostics';

describe('XNL closer diagnostics', () => {
  it('names XML-style text closers instead of only repeating the parser miss', () => {
    const source = '<Given ?>hello</Given>';
    expect(xmlStyleTextClosers(source)).toEqual(['</Given>']);
    expect(explainXnlParseError(source, new Error('Missing closing text tag </?> for <Given>'))).toBe('expected </?>, got </Given>');
  });
});
