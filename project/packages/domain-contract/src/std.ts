export interface StdLintFinding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly message: string;
}
export interface StdDocumentationSnapshot {
  readonly root: string;
  /** Portable paths relative to the selected documentation root. */
  readonly sources: ReadonlyMap<string, string>;
}
export interface StdDocumentationPort {
  observe(directory?: string): Promise<StdDocumentationSnapshot>;
}
export interface StdLintResult {
  readonly root: string;
  readonly findings: readonly StdLintFinding[];
}
