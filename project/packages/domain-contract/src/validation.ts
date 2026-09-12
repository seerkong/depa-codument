export interface DomainValidationFinding {
  readonly file: string;
  readonly severity: 'error' | 'warning';
  readonly rule: string;
  readonly message: string;
}

export interface HistoricalCompletionView {
  readonly basis: string;
  readonly currentVerification: 'not-reverified';
  readonly sourcePath: string;
  readonly sourceFingerprint: string;
}

/** Explicit observations, never a request to discover the current workspace. */
export interface LifecycleValidationContext {
  readonly file: string;
  readonly profileNames?: readonly string[];
  readonly strict?: boolean;
}

export interface DomainValidationRequest { readonly target?: string; readonly strict?: boolean }
export interface DomainValidationUnit {
  readonly kind: 'Track' | 'Mission' | 'Behavior';
  readonly id: string;
  readonly file: string;
  readonly directory: string;
  readonly source?: string;
  readonly missingFiles: readonly string[];
  readonly patches: ReadonlyMap<string, string>;
  /** Canonical and working forests are separate authority domains. */
  readonly decisionForests: readonly ReadonlyMap<string, string>[];
  readonly findings: readonly DomainValidationFinding[];
}
export interface DomainValidationSnapshot {
  readonly units: readonly DomainValidationUnit[];
  readonly profiles?: string;
  readonly findings: readonly DomainValidationFinding[];
}
export interface DomainValidationSourcePort { observe(target?: string): Promise<DomainValidationSnapshot> }
export interface DomainValidationResult {
  readonly findings: readonly DomainValidationFinding[];
  readonly units: readonly {
    readonly kind: DomainValidationUnit['kind']; readonly id: string; readonly file: string; readonly directory: string;
    readonly patchCount: number; readonly findings: readonly DomainValidationFinding[];
    readonly historicalCompletion?: HistoricalCompletionView;
  }[];
}
