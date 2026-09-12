import type { DataElementNode, XnlNode } from 'xnl-core';

export type XnlMergeConflictType = 'same-field' | 'delete-modify' | 'add-add';
export type XnlMergeResolution = 'human' | 'ours' | 'theirs' | 'base';
export type XnlMergePolicy = Record<XnlMergeConflictType, XnlMergeResolution>;

export interface XnlMergeConflict {
  id: string;
  type: XnlMergeConflictType;
  base?: XnlNode;
  ours?: XnlNode;
  theirs?: XnlNode;
}

export interface XnlMergeResult {
  merged: Map<string, XnlNode>;
  conflicts: XnlMergeConflict[];
}

export type RegistryNodePathSegment =
  | { kind: 'root' | 'body' | 'array'; index: number }
  | { kind: 'extend' | 'attributes' | 'metadata' | 'object'; key: string };

export interface XnlRegistryAncestor {
  readonly tag: string;
  readonly id?: string;
  readonly node: DataElementNode;
}
export interface XnlRegistryOwner {
  readonly file: string;
  readonly topLevelIndex: number;
}
export interface RegistryTraversalContext {
  readonly file: string;
  readonly owner: XnlRegistryOwner;
  readonly ancestors: readonly XnlRegistryAncestor[];
  readonly path: readonly RegistryNodePathSegment[];
}
export interface XnlRegistryNodeRef extends RegistryTraversalContext {
  readonly id: string;
  readonly node: DataElementNode;
  readonly parent?: Pick<XnlRegistryAncestor, 'tag' | 'id'>;
  readonly uri?: string;
}
export interface RegistryIndexSpec {
  readonly registryName: string;
}
/** Domain selectors are execution bindings, not serialized registry config. */
export interface RegistryIndexBindings {
  readonly shouldIndex?: (node: DataElementNode, context: RegistryTraversalContext) => boolean;
  readonly readId?: (node: DataElementNode) => string | undefined;
  readonly uriFor?: (file: string, id: string, node: DataElementNode) => string;
}
export interface RegistryIndexIssue {
  readonly kind: 'syntax' | 'duplicate-slot' | 'duplicate-id' | 'missing-id';
  readonly file: string;
  readonly line?: number;
  readonly message: string;
  readonly id?: string;
  readonly otherFile?: string;
  readonly nodeTag?: string;
  readonly path?: readonly RegistryNodePathSegment[];
}
export interface XnlRegistryIndex {
  /** Exact original content including invalid/unindexable documents. */
  readonly sources: ReadonlyMap<string, string>;
  /** Parseable forests. xnl-core omits source comments; exact text remains in
   * sources. A writable proposal needs a separate source-fidelity check. */
  readonly files: ReadonlyMap<string, readonly XnlNode[]>;
  /** First entry in deterministic order; usable as authority only when ready. */
  readonly index: ReadonlyMap<string, XnlRegistryNodeRef>;
  readonly issues: readonly RegistryIndexIssue[];
  readonly ready: boolean;
}
