export interface DecisionFinding {
  severity: 'error' | 'warning';
  file: string;
  decision: string;
  message: string;
  layer?: 'syntax' | 'schema' | 'hierarchy';
}

export interface DecisionFrontierEntry {
  readonly id: string;
  readonly priority: string;
  readonly question?: string;
  readonly recommendation?: string;
  readonly depends_on: readonly string[];
  readonly parent?: string;
  readonly source: string;
}

export interface DecisionQuery {
  readonly operation: 'validate' | 'frontier';
  readonly target?: string;
}
export interface DecisionCreateInput { readonly file: string; readonly id: string; readonly parent?: string; }
export interface DomainSourceSnapshot {
  readonly file: string;
  readonly source: string | undefined;
  readonly sourceRevision: string;
}
export interface DomainSourceWritePort {
  read(file: string): Promise<DomainSourceSnapshot>;
  commit(source: DomainSourceSnapshot, proposed: string): Promise<{ readonly file: string; readonly maintenanceWarnings?: readonly string[] }>;
}
export type DecisionEditSnapshot = DomainSourceSnapshot;
export type DecisionWritePort = DomainSourceWritePort;
export interface DecisionSourceSnapshot {
  readonly display: string;
  readonly sources: ReadonlyMap<string, string>;
  readonly findings: readonly DecisionFinding[];
}
export interface DecisionSourcePort {
  read(target: string | undefined): Promise<DecisionSourceSnapshot>;
}
export interface DecisionQueryResult {
  readonly display: string;
  readonly findings: readonly DecisionFinding[];
  readonly frontier: readonly DecisionFrontierEntry[];
}

export const RESOLVED_DECISION_STATUS = Object.freeze(['accepted', 'resolved', 'deferred']);

export interface XnlDecisionOption {
  key?: string;
  title?: string;
  description?: string;
  tradeoff?: string;
  recommended: boolean;
}

export interface XnlDecisionRecord {
  id: string;
  status?: string;
  blocks?: unknown;
  durableCandidate: boolean;
  rawAnswer?: string;
  decisionText?: string;
  rationale?: string;
  evidence?: string;
  confidence?: string;
  reversibility?: string;
  options: XnlDecisionOption[];
  optionsWrapperPresent: boolean;
  optionsInDecisionBody: boolean;
  directOptionChildren: number;
  invalidOptionChildren: number;
  answerWrapperPresent: boolean;
  answerInDecisionBody: boolean;
  invalidAnswerChildren: number;
}
