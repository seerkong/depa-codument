import type {
  LifecycleKind, LifecycleSnapshot, LifecycleUpdate, ReadyTrackTask, TrackLinkTarget,
  VerificationReceipt, VerificationRequest, VerificationRuntime,
} from './lifecycle';
import type { DataElementNode } from 'xnl-core';
import type { DecisionCreateInput, DecisionQuery, DecisionQueryResult, DecisionSourcePort, DecisionWritePort } from './decisions';
import type { WorkspaceBindingCommand, WorkspaceBindingResult, WorkspaceBindingRuntime } from './project-bindings';
import type { DomainQuery, DomainQueryResult, DomainQuerySourcePort } from './query';
import type { ScaffoldReceipt, ScaffoldRequest, ScaffoldSourcePort } from './scaffold';
import type { DomainValidationRequest, DomainValidationResult, DomainValidationSourcePort } from './validation';
import type { StdDocumentationPort, StdLintResult } from './std';
import type { KnowledgeReadRequest, KnowledgeReadResult, KnowledgeSourcePort, KnowledgeScaffoldRequest, KnowledgeScaffoldReceipt, KnowledgeScaffoldPort } from './knowledge';
import type { ArtifactSyncPort, ArtifactSyncRequest, ArtifactSyncResult } from './artifact';
import type {ArchiveRequest, ArchiveReceipt, ArchiveSourcePort, KnowledgeBaselinePort} from './archive';

/** Pure authoring bindings. Storage never owns a second parser or writer. */
export interface LifecycleSourceCodec {
  /** Structural identity admission for discovery. Semantic inspection applies
   * to the selected owner, not every unrelated unfinished scaffold. */
  identify?(source: string, kind: LifecycleKind): string;
  inspect(source: string, kind: LifecycleKind): { readonly id: string; readonly root: DataElementNode };
  patch(source: string, before: DataElementNode, after: DataElementNode): string;
}

export interface LifecycleCommitReceipt {
  readonly directory: string;
  /** Publication succeeded, but an owned lock/temp artifact needs attention. */
  readonly maintenanceWarnings?: readonly string[];
}

export interface LifecycleRef { readonly kind: LifecycleKind; readonly id: string }

export interface OwnedLifecycleSnapshot extends LifecycleSnapshot {
  /** Opaque optimistic-concurrency token owned by this repository instance. */
  readonly sourceRevision: string;
  readonly directory: string;
  readonly file: string;
}

export interface LifecycleRepositoryPort {
  load(ref: LifecycleRef, options: { readonly includeArchived: boolean }): Promise<OwnedLifecycleSnapshot>;
  /** Reject stale sources, ambiguous authorities and occupied move targets.
   * Commit resource/move/optional binding receipt together or restore the source.
   * A rejected commit must not turn the proposal into a published authority.
   * Filesystem adapters serialize cooperating writers and check source bytes;
   * arbitrary editors are not participants in that lock protocol. */
  commit(source: OwnedLifecycleSnapshot, update: LifecycleUpdate, binding?: TrackLinkTarget): Promise<LifecycleCommitReceipt>;
  resolveTrack(trackId: string, request: { readonly projectRef?: string; readonly projectKind: 'host' | 'external' }): Promise<TrackLinkTarget>;
}

export type DomainOperation = LifecycleRef & (
  { readonly type: 'resource-transition'; readonly status: string }
  | { readonly type: 'task-transition'; readonly taskId: string; readonly status: string }
  | { readonly type: 'task-complete'; readonly taskId: string; readonly command: readonly string[]; readonly fresh?: boolean; readonly captureOutput?: boolean }
  | { readonly type: 'gap-round'; readonly round: number }
  | { readonly type: 'bind-track'; readonly taskId: string; readonly trackId: string }
  | { readonly type: 'mission-archive' }
);

export interface DomainOperationRuntime {
  readonly archive?: {readonly sources: ArchiveSourcePort; readonly baseline: KnowledgeBaselinePort};
  readonly artifacts?: ArtifactSyncPort;
  readonly knowledgeScaffolds?: KnowledgeScaffoldPort;
  readonly knowledgeSources?: KnowledgeSourcePort;
  readonly stdDocumentation?: StdDocumentationPort;
  readonly validationSources?: DomainValidationSourcePort;
  readonly scaffolds?: ScaffoldSourcePort;
  readonly queries?: DomainQuerySourcePort;
  readonly decisions?: DecisionSourcePort;
  readonly decisionWrites?: DecisionWritePort;
  readonly projectBindings?: WorkspaceBindingRuntime;
  readonly repository: LifecycleRepositoryPort;
  readonly verification: VerificationRuntime;
  readonly clock: { nowIso(): string };
}

/** Legacy command receipt shape, produced by the same operation as Kind commands. */
export interface DomainOperationReceipt {
  readonly kind: LifecycleKind;
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly directory: string;
  readonly verification?: VerificationReceipt;
  readonly maintenanceWarnings?: readonly string[];
}

export interface DomainOwner {
  archive(input: ArchiveRequest): Promise<ArchiveReceipt>;
  syncArtifacts(input: ArtifactSyncRequest): Promise<ArtifactSyncResult>;
  scaffoldKnowledge(input: KnowledgeScaffoldRequest): Promise<KnowledgeScaffoldReceipt>;
  knowledge(input: KnowledgeReadRequest): Promise<KnowledgeReadResult>;
  lintStd(directory?: string): Promise<StdLintResult>;
  validate(input: DomainValidationRequest): Promise<DomainValidationResult>;
  scaffold(input: ScaffoldRequest): Promise<ScaffoldReceipt>;
  query(input: DomainQuery): Promise<DomainQueryResult>;
  project(input: WorkspaceBindingCommand): Promise<WorkspaceBindingResult>;
  decisions(input: DecisionQuery): Promise<DecisionQueryResult>;
  createDecision(input: DecisionCreateInput): Promise<{ readonly file: string; readonly id: string; readonly parent?: string; readonly specVersion: 1; readonly maintenanceWarnings?: readonly string[] }>;
  apply(input: DomainOperation): Promise<DomainOperationReceipt>;
  ready(track: string): Promise<{ track: string; ready: ReadyTrackTask[] }>;
  verify(input: VerificationRequest): Promise<VerificationReceipt>;
  /** Close admission, drain admitted work, then release explicitly owned ports. */
  close(): Promise<void>;
}
