import { AcceptanceProtocolError } from './acceptance-scenario';

export interface ProtocolRuntime<T> {
  observe(): T;
  readProposal(): unknown;
  admit(proposal: unknown, observations: T): unknown;
  repair(input: { proposal: unknown; diagnostic: string; observations: T }): Promise<void>;
  record(value: unknown): void;
}
/** Freeze semantic judgement; only representation/evidence fields may change. */
export function semanticIdentity(value: any): string {
  if (!value || !['passed', 'failed'].includes(value.status) || !Array.isArray(value.findings)) {
    throw new AcceptanceProtocolError('No completed business judgement to repair');
  }
  const actions = Array.isArray(value.actions)
    ? value.actions.map((action: any) => ({
      coverage: action.coverage, url: action.url, target: action.target, expected: action.expected,
    }))
    : undefined;
  return JSON.stringify({ status: value.status, findings: value.findings, actions });
}
/** One protocol correction, no business re-execution or new verdict. */
export async function runAcceptanceProtocol<T>(runtime: ProtocolRuntime<T>): Promise<{ proposal: unknown; trace: T }> {
  const trace = runtime.observe();
  const proposal = runtime.readProposal();
  try {
    runtime.admit(proposal, trace);
    return { proposal, trace };
  }
  catch (error) {
    if (!(error instanceof AcceptanceProtocolError) || error.failureClass !== 'protocol-cost') throw error;
    const identity = semanticIdentity(proposal);
    runtime.record({ phase: 'protocol-repair', round: 1, diagnostic: error.message });
    await runtime.repair({ proposal, diagnostic: error.message, observations: trace });
    const repaired = runtime.readProposal();
    if (semanticIdentity(repaired) !== identity) {
      throw new AcceptanceProtocolError('Protocol repair changed business judgement, coverage or expectations');
    }
    const originalActions=(proposal as any)?.actions ?? [];
    for (let i=0;i<originalActions.length;i++) {
      if (originalActions[i].requirementId !== undefined && originalActions[i].requirementId !== (repaired as any)?.actions?.[i]?.requirementId) {
        throw new AcceptanceProtocolError('Protocol repair changed an existing canonical requirement reference');
      }
      if (originalActions[i].requirementIds !== undefined && JSON.stringify(originalActions[i].requirementIds) !== JSON.stringify((repaired as any)?.actions?.[i]?.requirementIds)) {
        throw new AcceptanceProtocolError('Protocol repair changed existing canonical requirement references');
      }
    }
    runtime.admit(repaired, trace);
    runtime.record({ phase: 'protocol-repair-completed', round: 1 });
    return { proposal: repaired, trace };
  }
}
