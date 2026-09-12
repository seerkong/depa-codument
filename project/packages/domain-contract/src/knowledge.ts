import type { PortableSpec } from 'halfcode-cli-lite-skill-app-contract/resource';
import type { DataElementNode } from 'xnl-core';
import type { XnlRegistryIndex } from './registry';
import type { XnlMergePolicy } from './registry';

export const KNOWLEDGE_RESOURCE_KINDS = ['ModelingRegistry', 'EngineeringRegistry'] as const;
export type KnowledgeResourceKind = typeof KNOWLEDGE_RESOURCE_KINDS[number];
/** Schema selectors are versions, not a vocabulary of DEPA fact grades. */
export const MODELING_SCHEMAS = ['data-topology/v1', 'codument-legacy/v1'] as const;
export type ModelingSchema = typeof MODELING_SCHEMAS[number];
export interface KnowledgeResourceMember {
  readonly id: string;
  readonly tag: string;
  readonly parentId?: string;
  readonly ancestorIds: readonly string[];
  readonly references: readonly string[];
  /** Path within the enclosing Resource record's spec; that record owns source provenance. */
  readonly path: readonly (string | number)[];
  readonly node: PortableSpec;
}
export interface KnowledgeResourceProjection {
  readonly members: readonly KnowledgeResourceMember[];
}
export type KnowledgeFamily = 'modeling' | 'engineering';
export type KnowledgeMode = 'registry' | 'deltas';
export interface KnowledgeFinding {
  readonly file: string;
  readonly line?: number;
  readonly layer: 'syntax' | 'schema' | 'hierarchy';
  readonly severity: 'error' | 'warning';
  readonly rule?: string;
  readonly message: string;
  readonly fix_hint?: string;
}
export interface KnowledgeSourceIndex {
  readonly family: KnowledgeFamily;
  readonly mode: KnowledgeMode;
  readonly registry: XnlRegistryIndex;
  readonly owners: ReadonlyMap<string, DataElementNode>;
  readonly findings: readonly KnowledgeFinding[];
  readonly ready: boolean;
}
export interface KnowledgeThresholds { readonly maxLines: number; readonly maxNodes: number }
export interface KnowledgeSettings {
  readonly enabled: boolean;
  readonly thresholds: KnowledgeThresholds;
  readonly mergePolicy: XnlMergePolicy;
}
export interface KnowledgeReadRequest {
  readonly family: KnowledgeFamily;
  readonly operation: 'validate' | 'lint';
  readonly directory?: string;
  readonly deltas?: string;
  readonly maxLines?: number;
  readonly maxNodes?: number;
}
export interface KnowledgeSourcePort {
  readConfig(family: KnowledgeFamily): Promise<string | undefined>;
  observe(input: Pick<KnowledgeReadRequest, 'family' | 'directory' | 'deltas'>): Promise<{
    readonly directory: string;
    readonly sources: ReadonlyMap<string, string>;
    readonly contextSources?: ReadonlyMap<string, string>;
  }>;
}
export interface KnowledgeLintFinding {
  readonly file: string;
  readonly lines: number;
  readonly nodeCount: number;
  readonly reasons: readonly string[];
}
export type KnowledgeReadResult =
  | { readonly kind: 'skipped'; readonly family: KnowledgeFamily }
  | { readonly kind: 'validated'; readonly family: KnowledgeFamily; readonly directory: string; readonly findings: readonly KnowledgeFinding[] }
  | { readonly kind: 'linted'; readonly family: KnowledgeFamily; readonly directory: string; readonly findings: readonly KnowledgeLintFinding[] };

/** Supported draft templates, not the complete vocabulary of registry schemas. */
export const KNOWLEDGE_SCAFFOLD_KINDS = Object.freeze({
  modeling: Object.freeze(['entity', 'object', 'state-machine', 'enum', 'module'] as const),
  engineering: Object.freeze(['rule', 'howto', 'reference', 'code-map', 'overview'] as const),
});

export type KnowledgeScaffoldRequest = {
  readonly kind: string; readonly name: string; readonly plane: string; readonly track?: string;
} & (
  | { readonly family: 'modeling'; readonly context: string; readonly fields?: readonly string[]; readonly states?: readonly string[] }
  | { readonly family: 'engineering'; readonly category: string; readonly topic: string }
);
export interface KnowledgeScaffoldSnapshot {
  readonly request: KnowledgeScaffoldRequest;
  readonly directory: string;
  /** Relative to directory, never an arbitrary write target. */
  readonly file: string;
  readonly sources: ReadonlyMap<string, string>;
  readonly sourceRevision: string;
}
export interface KnowledgeScaffoldPort {
  observe(input: KnowledgeScaffoldRequest): Promise<KnowledgeScaffoldSnapshot>;
  publish(snapshot: KnowledgeScaffoldSnapshot, source: string): Promise<{readonly file: string; readonly maintenanceWarnings?: readonly string[]}>;
}
export interface KnowledgeScaffoldReceipt {
  readonly family: KnowledgeFamily; readonly kind: string; readonly name: string; readonly file: string;
  readonly maintenanceWarnings?: readonly string[];
}
