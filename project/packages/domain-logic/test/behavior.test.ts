import { describe, expect, it } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { proposeBehaviorMutation, validateBehaviorTree } from '../src';

const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const source = `<Behavior #cli.lifecycle ${envelope} {unknown={nested=[1 true "keep"]}} (<Requirements [
  <Requirement #R1 {status="active"} (<Statement ?>Keep lifecycle semantics.</?> <Suites [<Suite #S1 (<Cases [<Case #C1 (<Given ?>old state</?> <When ?>operation</?> <Then ?>new state</?>)>]>)>]> <KnowledgeHint {target="docs-profile" href="vfs://./docs/" strength="hint"}>)>
  <Requirement #R2 (<Statement ?>Keep extensions.</?>)>
]>)>`;
const patch = `<BehaviorPatch #track.example.behavior_patch.cli ${envelope} {capability="cli.lifecycle"} (<Mutations [
  <Upsert {selector="behavior://cli.lifecycle/requirements/R1"} (<Requirement #R1 (<Statement ?>Updated.</?>)>)>
  <Delete {selector="behavior://cli.lifecycle/requirements/R2"}>
  <Move {selector="behavior://cli.lifecycle/requirements/R3" to="behavior://cli.lifecycle/requirements/R4"}>
]>)>`;
function tree(content: string) { return parseXnl(content, { textBlockStyle: true }).nodes[0] as DataElementNode; }
function rules(content: string) { return validateBehaviorTree(tree(content), 'owned/behavior.xnl').map((finding) => finding.rule); }

describe('Behavior semantic checks and native proposals', () => {
  it('retains nonempty Requirement/Suite/Case trees, KnowledgeHints and unknown portable properties', () => {
    expect(rules(source)).toEqual([]);
    expect(rules(patch)).toEqual([]);
    const before = tree(source);
    const original = structuredClone(before);
    validateBehaviorTree(before, 'behavior.xnl');
    expect(before).toEqual(original);
  });

  it('rejects missing/duplicate Requirement identities, absent Statements and invalid hints', () => {
    expect(rules(source.replace('#R2', '#R1'))).toContain('behavior.requirement.duplicate-id');
    expect(rules(source.replace('#R2', ''))).toContain('behavior.requirement.id');
    expect(rules(source.replace('Keep extensions.', ''))).toContain('behavior.requirement.statement');
    expect(rules(source.replace('target="docs-profile" href="vfs://./docs/" strength="hint"', 'target="authority" href="/docs/" strength="required"'))).toEqual(expect.arrayContaining(['behavior.knowledge-hint.target', 'behavior.knowledge-hint.href', 'behavior.knowledge-hint.strength']));
    expect(rules(`<Behavior #empty ${envelope}>`)).toContain('behavior.requirement.missing');
  });

  it('requires explicit patch operations, selectors and a single Upsert payload', () => {
    expect(rules(patch.replace('capability="cli.lifecycle"', ''))).toContain('behavior.patch.capability');
    expect(rules(patch.replace('<Delete ', '<Unknown '))).toContain('behavior.patch.operation');
    expect(rules(patch.replace('selector="behavior://cli.lifecycle/requirements/R2"', 'selector="/local/path"'))).toContain('behavior.patch.selector');
    expect(rules(patch.replace('(<Requirement #R1 (<Statement ?>Updated.</?>)>)', ''))).toContain('behavior.patch.upsert-target');
    expect(rules(`<BehaviorPatch #empty ${envelope} {capability="cli.lifecycle"} (<Mutations []>)>`)).toContain('behavior.patch.mutations');
  });

  it('uses native checked mutations while keeping complete unknown trees and independent inputs', () => {
    const before = tree(source);
    const expected = tree(source.replace('Keep lifecycle semantics.', 'Updated lifecycle contract.'));
    const original = structuredClone(before);
    const proposed = proposeBehaviorMutation(before, expected);
    expect(proposed.mutations.length).toBeGreaterThan(0);
    expect(proposed.root).toEqual(expected);
    expect(proposed.root.attributes!.unknown).toEqual(before.attributes!.unknown);
    expect(before).toEqual(original);
    proposed.root.attributes!.unknown = 'changed output only';
    expect(before).toEqual(original);
    expect(expected.attributes!.unknown).not.toBe('changed output only');
  });

  it('keeps no-op proposals empty and refuses identity changes or invalid desired contracts', () => {
    const before = tree(source);
    expect(proposeBehaviorMutation(before, structuredClone(before)).mutations).toEqual([]);
    expect(() => proposeBehaviorMutation(before, tree(source.replace('#cli.lifecycle', '#other')))).toThrow('matching stable');
    expect(() => proposeBehaviorMutation(before, tree(source.replace('Keep extensions.', '')))).toThrow('behavior.requirement.statement');
  });
});
