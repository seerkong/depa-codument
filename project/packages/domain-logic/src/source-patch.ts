import { parseXnl, stringifyLineBlock, wordToString, type DataElementNode, type ElementNode, type XnlNode } from 'xnl-core';

interface Token { start: number; end: number; value: string; kind: 'atom' | 'string' | 'punct' | 'text' }
interface Edit { start: number; end: number; value: string }
interface ElementSpan {
  start: number;
  end: number;
  bodyEnd?: number;
  markerAt: number;
  id?: { start: number; end: number };
  attributes?: { end: number; fields: Map<string, { start: number; end: number }> };
  attributesAt: number;
}

/** Apply a complete checked data-tree proposal while retaining source tokens
 * that still mean the same thing. Comments outside text values are never edit
 * targets, including comments belonging to removed syntax. This is a source
 * locator, not another parser: xnl-core admits both trees and judges the result.
 * Lifecycle's narrower writer intentionally remains a separate admission gate. */
export function patchDataTreeSource(source: string, expected: DataElementNode, proposed: DataElementNode): string {
  if (!sourceSemanticEqual(parseRoot(source), expected)) throw new Error('Data source changed before patching.');
  if (sourceSemanticEqual(expected, proposed)) return source;
  const rendered = renderDataProposal(proposed);
  if (!sourceSemanticEqual(parseRoot(rendered), proposed)) throw new Error('Rendered data proposal does not reproduce the complete semantic tree.');
  const before = patchTokens(source), after = patchTokens(rendered);
  const cache = new Map<string, string>();
  function key(token: Token): string {
    const cached = cache.get(token.value);
    if (cached !== undefined) return cached;
    let value = token.value;
    if (token.kind === 'string') value = JSON.stringify(parseRoot(`<Value {value=${value}}>`).attributes?.value);
    else if (token.kind === 'text') value = JSON.stringify(parseXnl(`<Text ${value}`, {textBlockStyle: true}).nodes.map(node => element(node) && node.kind === 'TextElement' ? node.text : node));
    const result = `${token.kind}:${value}`;
    cache.set(token.value, result);
    return result;
  }
  const beforeKeys = before.map(key), afterKeys = after.map(key);
  let prefix = 0, oldEnd = before.length, newEnd = after.length;
  while (prefix < oldEnd && prefix < newEnd && beforeKeys[prefix] === afterKeys[prefix]) prefix++;
  while (oldEnd > prefix && newEnd > prefix && beforeKeys[oldEnd - 1] === afterKeys[newEnd - 1]) { oldEnd--; newEnd--; }
  const matches = tokenCorrespondence(beforeKeys, afterKeys, prefix, oldEnd, prefix, newEnd);
  matches.push([oldEnd, newEnd]);
  const edits: Edit[] = [];
  let old = prefix, next = prefix;
  for (const [oldMatch, nextMatch] of matches) {
    let replacement = '';
    if (next < nextMatch) {
      replacement = oldMatch - old === 1 && nextMatch - next === 1
        ? after[next].value
        : rendered.slice(after[next - 1]?.end ?? 0, after[nextMatch]?.start ?? rendered.length);
    }
    if (old < oldMatch) {
      edits.push({start: before[old].start, end: before[old].end, value: replacement});
      for (let index = old + 1; index < oldMatch; index++) edits.push({start: before[index].start, end: before[index].end, value: ''});
    } else if (replacement) {
      const position = before[old]?.start ?? source.length;
      edits.push({start: position, end: position, value: replacement});
    }
    old = oldMatch + 1; next = nextMatch + 1;
  }
  const result = applyEdits(source, edits);
  if (!sourceSemanticEqual(parseRoot(result), proposed)) throw new Error('Data source patch did not reproduce the complete semantic tree; retain source for review.');
  return result;
}

function renderDataProposal(proposed: DataElementNode): string {
  let marker = 'CODUMENT_PATCH';
  while (JSON.stringify(proposed).includes(`</?${marker}>`)) marker += '_';
  const rendering = structuredClone(proposed);
  function retainSafeMarkers(value: unknown): void {
    if (Array.isArray(value)) {value.forEach(retainSafeMarkers); return;}
    if (!object(value)) return;
    if (value.kind === 'TextElement' && typeof value.text === 'string'
      && typeof value.textMarker === 'string' && value.text.includes(`</?${value.textMarker}>`)) value.textMarker = marker;
    Object.values(value).forEach(retainSafeMarkers);
  }
  retainSafeMarkers(rendering);
  return stringifyLineBlock(rendering, {textBlockStyle: true, textMarkerFactory: () => marker});
}

/** Hirschberg correspondence uses linear row storage instead of an N*M table.
 * Unchanged prefixes/suffixes are retained before splitting distant edits. */
function tokenCorrespondence(before: readonly string[], after: readonly string[],
  oldStart: number, oldEnd: number, newStart: number, newEnd: number): [number, number][] {
  const result: [number, number][] = [];
  function scores(aStart: number, aEnd: number, bStart: number, bEnd: number, reverse: boolean): Uint32Array {
    const width = bEnd - bStart, row = new Uint32Array(width + 1);
    for (let a = 0; a < aEnd - aStart; a++) {
      let diagonal = 0;
      for (let b = 1; b <= width; b++) {
        const previous = row[b];
        const aIndex = reverse ? aEnd - 1 - a : aStart + a;
        const bIndex = reverse ? bEnd - b : bStart + b - 1;
        row[b] = before[aIndex] === after[bIndex] ? diagonal + 1 : Math.max(row[b], row[b - 1]);
        diagonal = previous;
      }
    }
    return row;
  }
  function visit(aStart: number, aEnd: number, bStart: number, bEnd: number): void {
    while (aStart < aEnd && bStart < bEnd && before[aStart] === after[bStart]) result.push([aStart++, bStart++]);
    let suffix = 0;
    while (aStart < aEnd && bStart < bEnd && before[aEnd - 1] === after[bEnd - 1]) {aEnd--; bEnd--; suffix++;}
    if (aEnd - aStart === 1) {
      for (let index = bStart; index < bEnd; index++) if (before[aStart] === after[index]) {result.push([aStart, index]); break;}
    } else if (aStart < aEnd && bStart < bEnd) {
      const middle = aStart + Math.floor((aEnd - aStart) / 2);
      let split = 0;
      {
        const forward = scores(aStart, middle, bStart, bEnd, false);
        const reverse = scores(middle, aEnd, bStart, bEnd, true);
        for (let index = 1; index <= bEnd - bStart; index++) {
          if (forward[index] + reverse[bEnd - bStart - index] > forward[split] + reverse[bEnd - bStart - split]) split = index;
        }
      }
      visit(aStart, middle, bStart, bStart + split);
      visit(middle, aEnd, bStart + split, bEnd);
    }
    for (let index = 0; index < suffix; index++) result.push([aEnd + index, bEnd + index]);
  }
  visit(oldStart, oldEnd, newStart, newEnd);
  return result;
}

function sourceSemanticEqual(a: unknown, b: unknown): boolean {
  function normalize(_key: string, value: unknown): unknown {
    if (!object(value)) return value;
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => !(value.kind === 'TextElement' && key === 'textMarker'))
      .map(key => [key, value[key]]));
  }
  return JSON.stringify(a, normalize) === JSON.stringify(b, normalize);
}

function patchTokens(source: string): Token[] {
  const tokens = tokenize(source), result: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], next = tokens[index + 1];
    // The parser requires #word and <Tag adjacency. They move indivisibly when
    // repeated node headers align across a body insertion/removal.
    if (['#', '<'].includes(token.value) && next?.kind === 'atom' && token.end === next.start) {
      result.push({start: token.start, end: next.end, value: source.slice(token.start, next.end), kind: 'atom'});
      index++;
    } else result.push(token);
  }
  return result;
}

/** Direct knowledge body members retain their own complete authored fragments. */
export function readDataBodySourceFragments(source: string): readonly {node: DataElementNode; source: string}[] {
  const root = parseRoot(source);
  const tokens = tokenize(source), spans = elementSpans(tokens, tokenPairs(tokens));
  let marker = '__codument_body_span';
  while (source.includes(marker)) marker += '_';
  const annotated = parseRoot(applyEdits(source, spans.map((span, index) => ({start: span.markerAt, end: span.markerAt, value: ` ${marker}=${index} `}))));
  return (root.body ?? []).map((node, index) => {
    const located = annotated.body?.[index];
    if (!element(node) || node.kind !== 'DataElement' || !element(located)) throw new Error('Knowledge source body requires data members.');
    const spanIndex = located.metadata[marker], span = typeof spanIndex === 'number' ? spans[spanIndex] : undefined;
    if (!span) throw new Error('Knowledge member source span was not resolved.');
    const fragment = source.slice(span.start, span.end + 1);
    if (!equal(parseRoot(fragment), node)) throw new Error('Knowledge source fragment does not reproduce its complete tree.');
    return {node, source: fragment};
  });
}

/** Locate complete data roots without reserializing their nested source. The
 * enclosing source still owns between-root comments; callers retain it in the
 * archive when promoting a selected subset of the forest. */
export function readDataForestSourceFragments(source: string): readonly {node: DataElementNode; source: string}[] {
  const parse = (input: string) => {
    const parsed = parseXnl(input, {textBlockStyle: true});
    if (parsed.warnings?.length || parsed.nodes.some(node => !element(node) || node.kind !== 'DataElement')) throw new Error('Source fragments require an unambiguous data forest.');
    return parsed.nodes as DataElementNode[];
  };
  const original = parse(source);
  const tokens = tokenize(source), spans = elementSpans(tokens, tokenPairs(tokens));
  let marker = '__codument_forest_span';
  while (source.includes(marker)) marker += '_';
  const annotated = parse(applyEdits(source, spans.map((span, index) => ({start: span.markerAt, end: span.markerAt, value: ` ${marker}=${index} `}))));
  return original.map((node, index) => {
    const spanIndex = annotated[index]?.metadata[marker];
    const span = typeof spanIndex === 'number' ? spans[spanIndex] : undefined;
    if (!span) throw new Error('Data root source span was not resolved.');
    const fragment = source.slice(span.start, span.end + 1);
    if (!equal(parse(fragment), [node])) throw new Error('Data source fragment does not reproduce its complete tree.');
    return {node, source: fragment};
  });
}

/** One insertion/removal in a local config root's body. The parser, not source
 * offsets, remains the authority for whether the complete result is correct. */
export function patchRootBodySource(source: string, expected: DataElementNode, proposed: DataElementNode,
  change: { readonly insert: string } | { readonly remove: number }): string {
  if (!equal(parseRoot(source), expected)) throw new Error('Config source changed before patching.');
  const tokens = tokenize(source);
  const spans = elementSpans(tokens, tokenPairs(tokens));
  let edit: Edit;
  if ('insert' in change) {
    const root = spans[0];
    const position = root.bodyEnd ?? root.end;
    edit = { start: position, end: position, value: root.bodyEnd === undefined ? ` [\n${change.insert}\n]` : `\n${change.insert}\n` };
  } else {
    let marker = '__codument_config_span';
    while (source.includes(marker)) marker += '_';
    const annotated = parseRoot(applyEdits(source, spans.map((span, index) => ({ start: span.markerAt, end: span.markerAt, value: ` ${marker}=${index} ` }))));
    const item = annotated.body?.[change.remove];
    if (!element(item) || item.kind !== 'DataElement') throw new Error('Config removal must select a direct data child.');
    const index = item.metadata[marker];
    const span = typeof index === 'number' ? spans[index] : undefined;
    if (!span) throw new Error('Config child source span was not resolved.');
    edit = { start: span.start, end: span.end + 1, value: '' };
  }
  const result = applyEdits(source, [edit]);
  if (!equal(parseRoot(result), proposed)) throw new Error('Config patch did not reproduce the proposed semantic tree.');
  return result;
}

/** Insert a Decision without reserializing the existing forest. The canonical
 * parser verifies the complete proposed tree after the one bounded insertion. */
export function appendDecisionSource(source: string, expected: readonly XnlNode[], proposed: readonly XnlNode[], childSource: string, parentId?: string): string {
  const parse = (value: string) => {
    const parsed = parseXnl(value, { textBlockStyle: true });
    if (parsed.warnings?.length) throw new Error('Decision source is ambiguous.');
    return parsed.nodes;
  };
  if (!equal(parse(source), expected)) throw new Error('Decision source changed before insertion.');
  let result: string;
  if (parentId === undefined) result = source + (source.endsWith('\n') || !source ? '' : '\n') + childSource + '\n';
  else {
    const tokens = tokenize(source);
    const spans = elementSpans(tokens, tokenPairs(tokens));
    let marker = '__codument_decision_span';
    while (source.includes(marker)) marker += '_';
    const annotated = parse(applyEdits(source, spans.map((span, index) => ({ start: span.markerAt, end: span.markerAt, value: ` ${marker}=${index} ` }))));
    const matches: DataElementNode[] = [];
    const visit = (value: XnlNode): void => {
      if (!element(value) || value.kind !== 'DataElement') return;
      if (value.tag === 'decision' && wordToString(value.id) === parentId) matches.push(value);
      for (const child of value.body ?? []) visit(child);
    };
    annotated.forEach(visit);
    if (matches.length !== 1) throw new Error('Decision parent must have one unambiguous source location.');
    const index = matches[0].metadata[marker];
    const span = typeof index === 'number' ? spans[index] : undefined;
    if (!span) throw new Error('Decision parent source span was not resolved.');
    const position = span.bodyEnd ?? span.end;
    const value = span.bodyEnd === undefined ? ` [\n${childSource}\n]` : `\n${childSource}\n`;
    result = applyEdits(source, [{ start: position, end: position, value }]);
  }
  if (!equal(parse(result), proposed)) throw new Error('Decision insertion did not reproduce the proposed semantic tree.');
  return result;
}

/** Patch only lifecycle-owned scalar attributes and #identity tokens. Everything
 * else, including comments, text delimiters, extensions and whitespace, retains
 * its original bytes. xnl-core remains the parser and semantic judge; the token
 * index only locates edits and never decides whether a document is valid. */
export function patchLifecycleSource(source: string, expected: DataElementNode, proposed: DataElementNode): string {
  const before = parseRoot(source);
  if (!equal(before, expected)) throw new Error('Lifecycle source changed before patching.');
  const tokens = tokenize(source);
  const pairs = tokenPairs(tokens);
  const spans = elementSpans(tokens, pairs);
  let marker = '__codument_source_span';
  while (source.includes(marker)) marker += '_';
  const annotated = applyEdits(source, spans.map((span, index) => ({ start: span.markerAt, end: span.markerAt, value: ` ${marker}=${index} ` })));
  const marked = parseRoot(annotated);
  const edits: Edit[] = [];

  function compare(original: unknown, next: unknown, located: unknown): void {
    if (equal(original, next)) return;
    if (element(original) && element(next) && element(located)) {
      if (original.tag !== next.tag || original.kind !== next.kind || !equal(original.metadata, next.metadata)) unsupported();
      const spanId = located.metadata[marker];
      if (typeof spanId !== 'number' || !spans[spanId]) throw new Error('Lifecycle source span was not resolved.');
      const span = spans[spanId];
      if (!equal(original.id, next.id)) {
        const id = wordToString(next.id);
        if (!id) unsupported();
        if (span.id) edits.push({ ...span.id, value: id });
        else edits.push({ start: span.markerAt, end: span.markerAt, value: ` #${id}` });
      }
      const added: string[] = [];
      for (const key of new Set([...Object.keys(original.attributes ?? {}), ...Object.keys(next.attributes ?? {})])) {
        const previous = original.attributes?.[key];
        const value = next.attributes?.[key];
        if (equal(previous, value)) continue;
        if (value === undefined || !scalar(value) || (previous !== undefined && !scalar(previous))) unsupported();
        const field = span.attributes?.fields.get(key);
        const literal = JSON.stringify(value);
        if (field) edits.push({ ...field, value: literal });
        else added.push(`${JSON.stringify(key)} = ${literal}`);
      }
      if (added.length) {
        const position = span.attributes?.end ?? span.attributesAt;
        const value = span.attributes ? ` ${added.join(' ')} ` : `{ ${added.join(' ')} } `;
        edits.push({ start: position, end: position, value });
      }
      for (const key of new Set([...Object.keys(original), ...Object.keys(next)])) {
        if (['kind', 'tag', 'id', 'metadata', 'attributes'].includes(key)) continue;
        compare(property(original, key), property(next, key), property(located, key));
      }
      return;
    }
    if (Array.isArray(original) && Array.isArray(next) && Array.isArray(located)) {
      if (original.length !== next.length || original.length !== located.length) unsupported();
      original.forEach((value, index) => compare(value, next[index], located[index]));
      return;
    }
    if (object(original) && object(next) && object(located)) {
      if (!equal(Object.keys(original).sort(), Object.keys(next).sort())) unsupported();
      for (const key of Object.keys(original)) compare(original[key], next[key], located[key]);
      return;
    }
    unsupported();
  }

  compare(before, proposed, marked);
  const result = applyEdits(source, edits);
  if (!equal(parseRoot(result), proposed)) throw new Error('Lifecycle patch did not reproduce the proposed semantic tree.');
  return result;
}

function parseRoot(source: string): DataElementNode {
  const parsed = parseXnl(source, { textBlockStyle: true });
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !element(parsed.nodes[0]) || parsed.nodes[0].kind !== 'DataElement') {
    throw new Error('Lifecycle patch requires one unambiguous data root.');
  }
  return parsed.nodes[0];
}

function unsupported(): never {
  throw new Error('Lifecycle source patch cannot prove this structural change safe; retain source for review.');
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function element(value: unknown): value is ElementNode {
  return object(value) && (value.kind === 'DataElement' || value.kind === 'TextElement');
}
function property(value: object, key: string): unknown { return (value as Record<string, unknown>)[key]; }
function scalar(value: XnlNode): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}
function equal(a: unknown, b: unknown): boolean {
  const normalize = (_key: string, value: unknown) => object(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value;
  return JSON.stringify(a, normalize) === JSON.stringify(b, normalize);
}

function applyEdits(source: string, edits: readonly Edit[]): string {
  const ordered = edits.map((edit, index) => ({ ...edit, index }))
    .sort((a, b) => b.start - a.start || b.index - a.index);
  let boundary = source.length;
  for (const edit of ordered) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > boundary) throw new Error('Overlapping lifecycle source edits.');
    source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
    boundary = edit.start;
  }
  return source;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < source.length) {
    if (/\s/.test(source[offset])) { offset++; continue; }
    if (source.startsWith('<!--', offset)) {
      const close = source.indexOf('-->', offset + 4);
      if (close < 0) unsupported();
      offset = close + 3;
      continue;
    }
    const start = offset;
    const quote = source[offset];
    if (quote === '"' || quote === "'") {
      offset++;
      while (offset < source.length) {
        if (source[offset] === '\\') { offset += 2; continue; }
        if (source[offset++] === quote) break;
      }
      tokens.push({ start, end: offset, value: source.slice(start, offset), kind: 'string' });
      continue;
    }
    if (quote === '?') {
      const marker = /^\?([A-Za-z0-9_-]*)>/.exec(source.slice(offset));
      if (!marker) unsupported();
      const closer = `</?${marker[1]}>`;
      const end = source.indexOf(closer, offset + marker[0].length);
      if (end < 0) unsupported();
      offset = end + closer.length;
      tokens.push({ start, end: offset, value: source.slice(start, offset), kind: 'text' });
      continue;
    }
    if ('<>#{}[]=()'.includes(quote)) {
      offset++;
      tokens.push({ start, end: offset, value: quote, kind: 'punct' });
      continue;
    }
    while (offset < source.length && !/\s/.test(source[offset]) && !'<>#{}[]=()?\'"'.includes(source[offset])) offset++;
    if (offset === start) unsupported();
    tokens.push({ start, end: offset, value: source.slice(start, offset), kind: 'atom' });
  }
  return tokens;
}

function tokenPairs(tokens: readonly Token[]): Map<number, number> {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  const openers: Record<string, string> = { '}': '{', ']': '[', ')': '(', '>': '<' };
  tokens.forEach((token, index) => {
    if (token.kind === 'punct' && ['{', '[', '(', '<'].includes(token.value)) stack.push(index);
    else if (token.kind === 'text' || (token.kind === 'punct' && openers[token.value])) {
      const start = stack.pop();
      const expected = token.kind === 'text' ? '<' : openers[token.value];
      if (start === undefined || tokens[start].value !== expected) unsupported();
      pairs.set(start, index);
    }
  });
  if (stack.length) unsupported();
  return pairs;
}

function elementSpans(tokens: readonly Token[], pairs: ReadonlyMap<number, number>): ElementSpan[] {
  const spans: ElementSpan[] = [];
  const valueEnd = (start: number) => pairs.has(start) ? pairs.get(start)! + 1 : start + 1;
  function fields(start: number, end: number): Map<string, { start: number; end: number }> {
    const result = new Map<string, { start: number; end: number }>();
    for (let cursor = start; cursor < end;) {
      if (!tokens[cursor] || tokens[cursor + 1]?.value !== '=') unsupported();
      const key = tokens[cursor].value;
      const keyNode = parseRoot(`<Key { ${key} = 0 }>`);
      const decodedKey = Object.keys(keyNode.attributes ?? {})[0];
      const afterValue = valueEnd(cursor + 2);
      if (!decodedKey || afterValue > end || result.has(decodedKey)) unsupported();
      result.set(decodedKey, { start: tokens[cursor + 2].start, end: tokens[afterValue - 1].end });
      cursor = afterValue;
    }
    return result;
  }

  tokens.forEach((token, index) => {
    if (token.kind !== 'punct' || token.value !== '<') return;
    let cursor = index + 2;
    let markerAt = tokens[index + 1].end;
    let id: ElementSpan['id'];
    if (tokens[cursor]?.value === '#') {
      id = { start: tokens[cursor + 1].start, end: tokens[cursor + 1].end };
      markerAt = id.end;
      cursor += 2;
    }
    while (tokens[cursor]?.kind === 'atom' || tokens[cursor]?.kind === 'string') {
      if (tokens[cursor + 1]?.value !== '=') unsupported();
      cursor = valueEnd(cursor + 2);
    }
    const attributesAt = tokens[cursor].start;
    let attributes: ElementSpan['attributes'];
    let bodyEnd: number | undefined;
    while (cursor < pairs.get(index)!) {
      if (tokens[cursor].value === '{') {
        const end = pairs.get(cursor);
        if (end === undefined) unsupported();
        attributes = { end: tokens[end].start, fields: fields(cursor + 1, end) };
      }
      if (tokens[cursor].value === '[') bodyEnd = tokens[pairs.get(cursor)!].start;
      const next = valueEnd(cursor);
      if (next <= cursor) unsupported();
      cursor = next;
    }
    spans.push({ start: token.start, markerAt, id, attributesAt, attributes, bodyEnd, end: tokens[pairs.get(index)!].start });
  });
  return spans;
}
