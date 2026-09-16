import type { HistoricalCompletionView } from './validation';
/** Explicit observation capabilities. Paths are display provenance, not write authority. */
export interface DomainQuerySource {
  readonly id: string;
  readonly file: string;
  readonly absolutePath: string;
  readonly source: string;
  readonly files?: readonly string[];
  readonly contents?: Readonly<Record<string, string>>;
}
export interface DomainQuerySourcePort {
  ensureWorkspace(): Promise<void>;
  tracks(options: { readonly id?: string; readonly detail?: boolean; readonly includeContent?: boolean }): Promise<readonly DomainQuerySource[]>;
}
export type DomainQuery =
  | { readonly operation: 'status' }
  | { readonly operation: 'list' }
  | { readonly operation: 'show'; readonly id: string; readonly type?: 'track' | 'decision'; readonly includeContent?: boolean };
export interface TrackQueryView {
  readonly id: string;
  readonly metadata: {
    readonly track_id: string; readonly track_name?: string; readonly goal?: string;
    readonly type: 'feature'; readonly status: string; readonly commit_mode?: string;
    readonly created_at: string; readonly updated_at: string; readonly description: string;
    readonly historicalCompletion?: HistoricalCompletionView;
  };
  readonly taskSummary?: {
    readonly total_phases: number; readonly total_tasks: number; readonly total_subtasks: 0; readonly total_estimated_days: 0;
    readonly completed: number; readonly in_progress: number; readonly todo: number; readonly blocked: number; readonly commit_mode?: string;
  };
  readonly files?: readonly string[];
  readonly contents?: Readonly<Record<string, string>>;
}
export type DomainQueryResult =
  | { readonly kind: 'status'; readonly value: ProjectStatusView }
  | { readonly kind: 'tracks'; readonly value: readonly TrackQueryView[] }
  | { readonly kind: 'track'; readonly value: TrackQueryView }
  | { readonly kind: 'decision'; readonly value: Readonly<Record<string, unknown>> };

export interface ProjectStatusView {
  readonly schema: 'codument.status/v1';
  readonly status: 'On Track' | 'Blocked' | 'No Tracks' | 'Complete';
  readonly tracks: readonly TrackQueryView[];
  readonly statistics: {
    readonly tracks: { readonly total: number; readonly completed: number; readonly inProgress: number; readonly new: number };
    readonly tasks: { readonly total: number; readonly completed: number; readonly inProgress: number; readonly todo: number; readonly blocked: number };
    readonly progress: number;
  };
  readonly current?: { readonly track: string; readonly phase?: string; readonly task?: string; readonly nextTask?: string };
}
