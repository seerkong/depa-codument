import { wordToString, type ElementNode } from 'xnl-core';
import { orderedElementChildren } from './registry';

/** Read-only structural traversal shared by domain semantic validators. */
export function children(node: ElementNode): ElementNode[] { return node.kind === 'DataElement' ? orderedElementChildren(node) : []; }
export function first(node: ElementNode, tag: string): ElementNode | undefined { return children(node).find((child) => child.tag === tag); }
export function descendants(node: ElementNode): ElementNode[] { return children(node).flatMap((child) => [child, ...descendants(child)]); }
export function id(node: ElementNode): string | undefined { return wordToString(node.id) ?? attr(node, 'id'); }
export function present(node: ElementNode, field: string): boolean { return node.attributes?.[field] !== undefined; }
export function attr(node: ElementNode, field: string): string | undefined {
  const value = node.attributes?.[field];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
}
