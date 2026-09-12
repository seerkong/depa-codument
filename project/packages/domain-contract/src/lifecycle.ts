import type { DataElementNode } from 'xnl-core';

export type LifecycleKind = 'track' | 'mission';
export type LifecycleStage = 'pending' | 'active' | 'archived';

/** One vocabulary shared by Kind schemas, source admission and transitions. */
export const LIFECYCLE_ROOT_STATES: Readonly<Record<LifecycleKind, readonly string[]>> = Object.freeze({
  track: Object.freeze(['new', 'in_progress', 'completed', 'cancelled']),
  mission: Object.freeze(['pending', 'active', 'completed', 'cancelled', 'superseded', 'archived']),
});
export const LIFECYCLE_TASK_STATES: Readonly<Record<LifecycleKind, readonly string[]>> = Object.freeze({
  track: Object.freeze(['NOT_STARTED', 'ACTIVE', 'DELEGATED', 'FORWARDED', 'DONE', 'REFUSED', 'ABANDONED']),
  mission: Object.freeze(['NOT_STARTED', 'ACTIVE', 'DONE', 'BLOCKED', 'ABANDONED', 'SUPERSEDED']),
});

/** The source AST is authority; task summaries are read-only projections. */
export interface LifecycleSnapshot {
  readonly kind: LifecycleKind;
  readonly id: string;
  readonly stage: LifecycleStage;
  readonly root: DataElementNode;
}

/** Pure proposal. Only the resource owner may commit it against its source. */
export interface LifecycleUpdate extends LifecycleSnapshot {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
}

export interface ReadyTrackTask {
  readonly id: string;
  readonly kind: 'Task' | 'TaskGroup';
  readonly name?: string;
  readonly status: string;
  readonly parent?: string;
  readonly criteria: { readonly checked: number; readonly total: number };
}

/** Receipt reuse/freshness belongs to the verification owner, not a task DTO. */
export interface VerificationReceipt {
  readonly version: number;
  readonly id: string;
  readonly track: string;
  readonly cwd: string;
  readonly command: readonly string[];
  readonly workspace_fingerprint: string;
  readonly exit_code: 0;
  readonly verified_at: string;
  readonly reused: boolean;
}

export interface VerificationRequest {
  readonly track: string;
  readonly command: readonly string[];
  readonly fresh?: boolean;
  readonly captureOutput?: boolean;
}

/** All effects are bound to one explicit workspace by the composing owner. */
export interface VerificationRuntime {
  readonly workspace: { fingerprint(track: string): Promise<string> };
  readonly receipts: {
    read(track: string, id: string): Promise<unknown>;
    write(receipt: VerificationReceipt): Promise<void>;
  };
  readonly execution: {
    run(command: readonly string[], captureOutput: boolean): Promise<{ readonly exitCode: number }>;
  };
  readonly digest: { sha256(content: string): string };
  readonly clock: { nowIso(): string };
}

export interface TrackLinkTarget {
  readonly trackId: string;
  /** Portable authority path in the selected workspace; no host-local path. */
  readonly authority: string;
  readonly projectRef?: string;
}

export interface MissionTrackBinding extends LifecycleUpdate {
  readonly target: TrackLinkTarget;
}
