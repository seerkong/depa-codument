import type { ResourceMigrationPlan } from './migration';

export interface WorkspaceMigrationFile {
  readonly path: string;
  readonly fingerprint: string;
  readonly mode: number;
  /** Binary attachments remain opaque and are preserved by the effect owner. */
  readonly source?: string;
}
export interface WorkspaceMigrationSnapshot {
  readonly sourceRevision: string;
  readonly files: readonly WorkspaceMigrationFile[];
}
export interface WorkspaceMigrationChange { readonly path: string; readonly source: string | null; readonly mode?: number }
export interface WorkspaceMigrationPlan {
  readonly status: 'planned' | 'noop' | 'review-required';
  readonly planDigest: string;
  readonly sourceFingerprint: string;
  readonly changes: readonly WorkspaceMigrationChange[];
  readonly resources: readonly ResourceMigrationPlan[];
  readonly diagnostics: readonly string[];
  readonly directories?: readonly string[];
  /** Only empty directory structure whose file retirement is explicit. */
  readonly removeDirectories?: readonly string[];
  readonly relocations?: readonly {from: string; to: string}[];
}
export interface WorkspaceMigrationDefinition {
  /** Exact code-owned old-reference to global-guidance projection. */
  readonly globalReferences?: Readonly<Record<string, string>>;
  readonly appFiles: readonly {path: string; source: string}[];
  readonly appDirectories: readonly string[];
  readonly legacyManagedFingerprints: Readonly<Record<string, readonly string[]>>;
}
export interface PreparedWorkspaceMigration {
  readonly validationRoot: string;
  readonly backupPath: string;
  assertCurrent(): Promise<void>;
  commit(): Promise<void>;
  abort(): Promise<void>;
}
export interface WorkspaceMigrationPort {
  observe(): Promise<WorkspaceMigrationSnapshot>;
  prepare(snapshot: WorkspaceMigrationSnapshot, plan: WorkspaceMigrationPlan): Promise<PreparedWorkspaceMigration>;
}
export interface WorkspaceMigrationRuntime {
  readonly files: WorkspaceMigrationPort;
  readonly plan: (snapshot: WorkspaceMigrationSnapshot) => WorkspaceMigrationPlan;
  readonly validate: (root: string, plan: WorkspaceMigrationPlan) => Promise<readonly {severity: 'error' | 'warning'; message: string}[]>;
}
export interface WorkspaceMigrationResult {
  readonly status: 'applied' | 'noop' | 'review-required';
  readonly planDigest: string;
  readonly backupPath?: string;
  readonly diagnostics: readonly string[];
}
export interface TrackUpgradeOptions {
  readonly mode?: 'wave' | 'sequential';
  readonly backupDirectory?: string;
  readonly noBackup?: boolean;
}
export interface CodumentTrackMigrator {
  upgrade(identifier: string, options?: TrackUpgradeOptions): Promise<WorkspaceMigrationResult & {
    path: string; targetPath?: string; mode: 'wave' | 'sequential'; semanticReviewRecommended?: boolean;
  }>;
}
