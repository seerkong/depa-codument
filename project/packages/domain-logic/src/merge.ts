import { applyMutations, diffNodes, parsePath } from 'xnl-core';
import type { PathItem, XnlMutation, XnlNode, XnlPath } from 'xnl-core';
import { isDataElement, readStableNodeId } from './registry';

import type { XnlMergeConflict, XnlMergePolicy, XnlMergeResult } from 'depa-codument-domain-contract/registry';
export const DEFAULT_XNL_MERGE_POLICY: Readonly<XnlMergePolicy> = Object.freeze({
  'same-field': 'human', 'delete-modify': 'human', 'add-add': 'human',
});

export function indexXnlNodesById(nodes: XnlNode[]): Map<string, XnlNode> {
  const indexed = new Map<string, XnlNode>();
  for (const node of nodes) {
    if (!isDataElement(node)) throw new Error('Merge input must contain selected identity-owned data elements.');
    const id = readStableNodeId(node);
    if (!id) throw new Error('Merge input has a node without stable identity.');
    const existing = indexed.get(id);
    if (existing) {
      throw new Error(`Duplicate XNL node id '${id}' in merge input`);
    }
    indexed.set(id, node);
  }
  return indexed;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function equal(a: XnlNode | undefined, b: XnlNode | undefined): boolean {
  return semanticJson(a) === semanticJson(b);
}

function mutationsBetween(from: XnlNode, to: XnlNode): XnlMutation[] {
  return diffNodes(JSON.parse(semanticJson(from)!), JSON.parse(semanticJson(to)!), [], { metadataIdMode: 'identity' });
}

function semanticJson(value: XnlNode | undefined): string | undefined {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort()
      .filter(key => !(item.kind === 'TextElement' && key === 'textMarker'))
      .map(key => [key, item[key]]));
  });
}

function pathItems(value: string | XnlPath): PathItem[] {
  return Array.isArray(value) ? value : parsePath(value);
}

function pathsOverlap(a: PathItem[], b: PathItem[]): boolean {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index].type !== b[index].type || a[index].value !== b[index].value) {
      return false;
    }
  }
  return true;
}

function disjoint(ours: XnlMutation[], theirs: XnlMutation[]): boolean {
  return ours.every((ourMutation) =>
    theirs.every((theirMutation) =>
      !pathsOverlap(pathItems(ourMutation.path), pathItems(theirMutation.path))));
}

function commute(base: XnlNode, ours: XnlMutation[], theirs: XnlMutation[]): XnlNode | undefined {
  if (!disjoint(ours, theirs)) return undefined;
  try {
    const forward = applyMutations(clone(base), [...ours, ...theirs], { metadataIdMode: 'identity' });
    const reverse = applyMutations(clone(base), [...theirs, ...ours], { metadataIdMode: 'identity' });
    // Disjoint index paths alone do not prove safety: array deletion/insertion
    // can shift another edit. Require both orders to converge semantically.
    return equal(forward, reverse) ? forward : undefined;
  } catch {
    return undefined;
  }
}

function resolve(
  conflict: XnlMergeConflict,
  policy: XnlMergePolicy,
  merged: Map<string, XnlNode>,
  conflicts: XnlMergeConflict[],
): void {
  const selected = policy[conflict.type] ?? 'human';
  if (selected === 'human') {
    conflicts.push(conflict);
    return;
  }
  const node = conflict[selected];
  if (node !== undefined) merged.set(conflict.id, node);
}

export function mergeXnlNodes(
  baseNodes: XnlNode[],
  ourNodes: XnlNode[],
  theirNodes: XnlNode[],
  policy: XnlMergePolicy = DEFAULT_XNL_MERGE_POLICY,
): XnlMergeResult {
  for (const resolution of Object.values(policy)) {
    if (!['human', 'ours', 'theirs', 'base'].includes(resolution)) throw new Error('Unknown XNL merge resolution.');
  }
  const base = indexXnlNodesById(baseNodes);
  const ours = indexXnlNodesById(ourNodes);
  const theirs = indexXnlNodesById(theirNodes);
  const merged = new Map<string, XnlNode>();
  const conflicts: XnlMergeConflict[] = [];
  const ids = new Set([...base.keys(), ...ours.keys(), ...theirs.keys()]);

  for (const id of ids) {
    const b = base.get(id);
    const o = ours.get(id);
    const t = theirs.get(id);

    if (b && o && t) {
      const oursChanged = !equal(b, o);
      const theirsChanged = !equal(b, t);
      if (!oursChanged && !theirsChanged) merged.set(id, o);
      else if (oursChanged && !theirsChanged) merged.set(id, o);
      else if (!oursChanged && theirsChanged) merged.set(id, t);
      else if (equal(o, t)) merged.set(id, o);
      else {
        const ourMutations = mutationsBetween(b, o);
        const theirMutations = mutationsBetween(b, t);
        const combined = commute(b, ourMutations, theirMutations);
        if (combined !== undefined) {
          merged.set(id, combined);
        } else {
          resolve({ id, type: 'same-field', base: b, ours: o, theirs: t }, policy, merged, conflicts);
        }
      }
      continue;
    }

    if (!b) {
      if (o && !t) merged.set(id, o);
      else if (!o && t) merged.set(id, t);
      else if (o && t) {
        if (equal(o, t)) merged.set(id, o);
        else resolve({ id, type: 'add-add', ours: o, theirs: t }, policy, merged, conflicts);
      }
      continue;
    }

    if (!o && !t) continue;
    if (!o && t) {
      if (!equal(b, t)) {
        resolve({ id, type: 'delete-modify', base: b, theirs: t }, policy, merged, conflicts);
      }
      continue;
    }
    if (!t && o) {
      if (!equal(b, o)) {
        resolve({ id, type: 'delete-modify', base: b, ours: o }, policy, merged, conflicts);
      }
    }
  }

  return { merged: new Map([...merged].map(([id, node]) => [id, clone(node)])), conflicts: clone(conflicts) };
}
