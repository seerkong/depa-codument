import { describe, expect, it } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { indexXnlRegistry, readStableNodeId, requireReadyRegistry, serializeXnlForest } from '../src';

const spec = { registryName: 'decision' };
const bindings = { shouldIndex: (node: DataElementNode) => node.tag === 'decision' };
const markers = { textMarkerFactory: () => 'TESTMARKER' };

describe('source-preserving recursive registry index', () => {
  it('indexes forests and nested identities with stable owner, ancestry and structural paths', () => {
    const sources = new Map([
      ['z.xnl', '<decision #z>'],
      ['topic/forest.xnl', '<decision #parent [<context #context [<decision #child [<decision #leaf>]>]>]> <decision #second>'],
    ]);
    const registry = requireReadyRegistry(indexXnlRegistry(sources, spec, bindings));
    expect([...registry.sources.keys()]).toEqual(['topic/forest.xnl', 'z.xnl']);
    expect([...registry.index.keys()]).toEqual(['parent', 'child', 'leaf', 'second', 'z']);
    expect(registry.index.get('child')).toMatchObject({
      file: 'topic/forest.xnl', owner: { file: 'topic/forest.xnl', topLevelIndex: 0 }, parent: { tag: 'context', id: 'context' },
      path: [{ kind: 'root', index: 0 }, { kind: 'body', index: 0 }, { kind: 'body', index: 0 }],
    });
    expect(registry.index.get('leaf')!.ancestors.map((ancestor) => ancestor.id)).toEqual(['parent', 'context', 'child']);
    expect(registry.index.get('second')!.owner.topLevelIndex).toBe(1);
    sources.clear();
    expect(registry.sources.size).toBe(2);
  });

  it('preserves word, attribute and metadata identity contracts and selectors', () => {
    const registry = indexXnlRegistry(new Map([['ids.xnl', '<decision #word><decision { id = "attribute" }><decision id="metadata">']]), spec, bindings);
    expect(registry.ready).toBe(true);
    expect([...registry.index.keys()]).toEqual(['word', 'attribute', 'metadata']);
    expect(readStableNodeId(registry.index.get('word')!.node)).toBe('word');
    const selected = indexXnlRegistry(new Map([['ids.xnl', '<module #domain.core><note>']]), { registryName: 'modeling' }, { shouldIndex: (node) => node.tag === 'module', uriFor: (file, id) => `modeling://${file}#${id}` });
    expect(selected.index.get('domain.core')!.uri).toBe('modeling://ids.xnl#domain.core');
    expect(selected.ready).toBe(true);
  });

  it('keeps invalid sources and reports syntax/missing/duplicate identity without pretending readiness', () => {
    const sources = new Map([
      ['a.xnl', '<decision #same>'], ['b.xnl', '<decision #broken'],
      ['c.xnl', '<decision #same>'], ['d.xnl', '<decision>'],
    ]);
    const registry = indexXnlRegistry(sources, spec, bindings);
    expect(registry.ready).toBe(false);
    expect(registry.sources).toEqual(sources);
    expect(registry.files.has('b.xnl')).toBe(false);
    expect(registry.index.get('same')!.file).toBe('a.xnl');
    expect(registry.issues.map((issue) => issue.kind)).toEqual(['syntax', 'duplicate-id', 'missing-id']);
    expect(registry.issues[1]).toMatchObject({ file: 'c.xnl', otherFile: 'a.xnl', id: 'same' });
    expect(() => requireReadyRegistry(registry)).toThrow('Duplicate decision');
  });

  it('does not expose a lossy AST when duplicate singleton slots were collapsed by the parser', () => {
    const source = '<decision #root (<answer ?A>first</?A> <answer ?B>second</?B>)>';
    const registry = indexXnlRegistry(new Map([['duplicate.xnl', source]]), spec, bindings);
    expect(registry.ready).toBe(false);
    expect(registry.issues[0].kind).toBe('duplicate-slot');
    expect(registry.sources.get('duplicate.xnl')).toBe(source);
    expect(registry.files.size).toBe(0);
    expect(registry.index.size).toBe(0);
  });

  it('walks nodes in attribute/metadata objects and arrays without flattening owner boundaries', () => {
    const source = '<decision #parent hint={ nested=[<decision #in.metadata>] } { policy = { nodes = [<decision #in.attributes>] } } (<context [<decision #in.extension>]>)>';
    const registry = indexXnlRegistry(new Map([['nested.xnl', source]]), spec, bindings);
    expect(registry.ready).toBe(true);
    expect([...registry.index.keys()]).toEqual(['parent', 'in.extension', 'in.attributes', 'in.metadata']);
    expect(registry.index.get('in.attributes')!.path).toEqual([
      { kind: 'root', index: 0 }, { kind: 'attributes', key: 'policy' },
      { kind: 'object', key: 'nodes' }, { kind: 'array', index: 0 },
    ]);
    expect(registry.index.get('in.metadata')!.owner).toEqual({ file: 'nested.xnl', topLevelIndex: 0 });
  });

  it('roundtrips forest semantics and formats explicit comments while preserving original source separately', () => {
    const source = '<decision #parent { vendor_policy = { mode = "opaque" version = 3 } activation = { all = ["prerequisite=enabled"] } derived_from = ["prerequisite=enabled"] } (<question ?Q>Which representation?</?Q> <answer (<raw-answer ?R>Full XNL.</?R> <vendor-extension { preserve = true }>)>) [<decision #child { status = "resolved" depends_on = ["parent"] }>]> <decision #second>';
    const nodes = parseXnl(source, { textBlockStyle: true }).nodes;
    const serialized = serializeXnlForest(nodes, markers);
    expect(parseXnl(serialized, { textBlockStyle: true }).nodes).toEqual(nodes);
    expect(serializeXnlForest(parseXnl(serialized, { textBlockStyle: true }).nodes, markers)).toBe(serialized);
    expect(serialized).toContain('vendor_policy');
    expect(serialized).toContain('derived_from');
    expect(serialized).toContain('#child');
    const commentSource = '<!-- retained comment -->\n' + source;
    const registry = indexXnlRegistry(new Map([['comments.xnl', commentSource]]), spec, bindings);
    expect(registry.sources.get('comments.xnl')).toBe(commentSource);
    // The parser intentionally omits comments. Do not treat a successful parse
    // or an indexed AST as proof that rewriting the original file is lossless.
    expect(registry.files.get('comments.xnl')).toEqual(nodes);
    expect(serializeXnlForest([...nodes, { kind: 'Comment', value: 'explicit comment' }], markers)).toContain('<!-- explicit comment -->');
  });

  it('is deterministic with explicit marker bindings and rejects escaping paths', () => {
    const source = parseXnl('<decision #x (<answer ?>text</?>)>', { textBlockStyle: true }).nodes;
    expect(serializeXnlForest(source, markers)).toBe(serializeXnlForest(source, markers));
    for (const file of ['../x.xnl', '/x.xnl', 'C:/x.xnl', 'a\\x.xnl']) {
      expect(() => indexXnlRegistry(new Map([[file, '<decision #x>']]), spec, bindings)).toThrow('portable');
    }
  });
});
