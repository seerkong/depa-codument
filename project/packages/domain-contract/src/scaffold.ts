export type ScaffoldRequest =
  { readonly kind: 'Track' | 'Mission'; readonly id: string; readonly stage: 'pending' | 'active' };
export interface ScaffoldLocation {
  readonly request: ScaffoldRequest;
  readonly stage: 'pending' | 'active';
  readonly directory: string;
  readonly sourceRevision: string;
  readonly gitHead?: string;
}
export interface ScaffoldSourcePort {
  observe(request: ScaffoldRequest): Promise<ScaffoldLocation>;
  /** New-directory publication only. Never replaces an existing resource. */
  publish(location: ScaffoldLocation, files: Readonly<Record<string, string>>): Promise<{ readonly maintenanceWarnings?: readonly string[] }>;
}
export interface ScaffoldReceipt {
  /** Historical patch create receipts identify the owning Track. */
  readonly kind: 'Track' | 'Mission';
  readonly id: string;
  readonly stage: 'pending' | 'active';
  readonly directory: string;
  readonly specVersion: 1;
  readonly files: readonly string[];
  readonly maintenanceWarnings?: readonly string[];
}
