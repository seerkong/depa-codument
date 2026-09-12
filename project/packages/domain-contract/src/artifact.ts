export interface ArtifactSyncRequest {
  readonly source: string;
  readonly target: string;
  readonly dryRun?: boolean;
  readonly force?: boolean;
}
export interface ArtifactSyncSnapshot {
  readonly source: string;
  readonly target: string;
  readonly sources: ReadonlyMap<string, string>;
  readonly targets: ReadonlyMap<string, string>;
  readonly sourceRevision: string;
}
export interface ArtifactChange { readonly path: string; readonly status: 'create' | 'update' | 'unchanged' }
export interface ArtifactSyncResult {
  readonly status: 'dry-run' | 'conflict' | 'synced';
  readonly source: string;
  readonly target: string;
  readonly changes: readonly ArtifactChange[];
  readonly maintenanceWarnings?: readonly string[];
}
/** Bytes and recovery handles stay with the publishing effect; hashes are a
 * read projection for planning, not authority to overwrite an arbitrary path. */
export interface ArtifactSyncPort {
  observe(input: Pick<ArtifactSyncRequest, 'source' | 'target'>): Promise<ArtifactSyncSnapshot>;
  publish(snapshot: ArtifactSyncSnapshot): Promise<{readonly maintenanceWarnings?: readonly string[]}>;
}
