import type { CodumentResourceKind } from './resources';
import type { DomainValidationSnapshot } from './validation';
import type { KnowledgeFamily, KnowledgeMode } from './knowledge';
export type MigrationGuideTopic = 'resource' | 'workspace' | 'decision' | 'track';

/** Bootstrap observations are independent of successful SkillApp admission. */
export interface MigrationSource {
  readonly path: string;
  readonly source: string;
}
export interface ResourceMigrationInspection {
  readonly path: string;
  readonly format?: 'xnl' | 'xml' | 'markdown';
  readonly kinds: readonly string[];
  readonly apiVersions: readonly string[];
  readonly fingerprint: string;
  readonly diagnostics: readonly string[];
  readonly rootCount?: number;
}
export interface ResourceMigrationPlan extends ResourceMigrationInspection {
  readonly status: 'planned' | 'noop' | 'review-required';
  readonly migrationId?: string;
  readonly targetPath?: string;
  readonly targetKind?: CodumentResourceKind;
  readonly targetEnvelopeVersion: 'halfcode.resource-envelope/v1';
  readonly targetSpecVersion: 1;
  readonly planDigest: string;
  /** Private execution material, not the default CLI projection. A plan is not
   * semantic admission: the full affected closure must pass before commit. */
  readonly proposal?: { readonly source: string | null };
}

export interface MigrationSourceSnapshot extends MigrationSource { readonly sourceRevision: string }
export interface PreparedResourceMigration {
  readonly validationRoot: string;
  readonly backupPath: string;
  readonly reviewDiagnostics?: readonly string[];
  readonly admissionRoot?: string;
  assertCurrent(): Promise<void>;
  commit(): Promise<void>;
  abort(): Promise<void>;
}
export interface ResourceMigrationSourcePort {
  resolve(path: string): {relative: string; absolute: string};
  read(path: string): Promise<MigrationSourceSnapshot>;
  prepare(snapshot: MigrationSourceSnapshot, plan: ResourceMigrationPlan, options?: {readonly transient?: boolean}): Promise<PreparedResourceMigration>;
}
export interface CodumentResourceMigrator {
  displayPath(path: string): string;
  inspect(path: string): Promise<ResourceMigrationInspection>;
  plan(path: string): Promise<ResourceMigrationPlan>;
  apply(plan: ResourceMigrationPlan): Promise<ResourceMigrationApplyResult>;
  upgrade(path: string): Promise<ResourceMigrationApplyResult>;
  verify(path: string): Promise<{path: string; valid: boolean; diagnostics: readonly string[]}>;
}
export interface ResourceMigrationRuntime {
  readonly files: ResourceMigrationSourcePort;
  /** Must validate the complete affected semantic/reference closure. Structural
   * parsing alone cannot authorize a migration write. */
  readonly validate: (validationRoot: string, plan: ResourceMigrationPlan, admissionRoot?: string) => Promise<readonly {severity: 'error' | 'warning'; message: string}[]>;
}
export interface MigrationAdmissionDefinition {
  readonly manifest: string;
  readonly files: readonly {path: string; sourcePath: string}[];
}
export interface MigrationValidationSnapshot {
  readonly source?: string;
  readonly domain?: DomainValidationSnapshot;
  readonly decisions?: ReadonlyMap<string, string>;
  readonly knowledge?: {family: KnowledgeFamily; mode: KnowledgeMode; sources: ReadonlyMap<string, string>};
}
export interface ResourceMigrationApplyResult {
  readonly path: string;
  readonly targetPath?: string;
  readonly status: 'applied' | 'removed' | 'noop' | 'review-required';
  readonly planDigest: string;
  readonly targetKind?: CodumentResourceKind;
  readonly detectedKind?: string;
  readonly detectedFormat?: ResourceMigrationInspection['format'];
  readonly targetEnvelopeVersion: 'halfcode.resource-envelope/v1';
  readonly targetSpecVersion: 1;
  readonly backupPath?: string;
  readonly diagnostics: readonly string[];
}
