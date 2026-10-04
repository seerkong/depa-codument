import { AcceptanceProtocolError } from './acceptance-scenario';
import { UI_ACTION_OPERATIONS } from './ui-contract';

/** Provider output shape only. Native evidence and business judgement still need admission. */
export function uiProposalSchema(session: string): object {
  const text = { type: 'string' };
  const object = (properties: Record<string, unknown>) => ({
    type: 'object', additionalProperties: false, properties, required: Object.keys(properties),
  });
  return object({
    browser: { type: 'string', enum: ['ego-browser'] },
    session: { type: 'string', enum: [session] },
    status: { type: 'string', enum: ['passed', 'failed', 'infrastructure-failed'] },
    failureClass: { type: 'string', enum: ['', 'business', 'infrastructure', 'protocol-cost', 'scope-unresolved'] },
    reason: text,
    findings: { type: 'array', items: text },
    actions: { type: 'array', items: object({
      operation: { type: 'string', enum: UI_ACTION_OPERATIONS },
      coverage: text, requirementIds: { type: 'array', items: text },
      url: text, target: text, expected: text, observationId: text,
    }) },
    findingEvidence: { type: 'array', items: object({
      finding: text, requirementId: text, observationId: text, absence: { type: 'boolean' },
    }) },
  });
}

/** One selected advisory source, never a prose guess or a competing file authority. */
export function readUiProposal(
  runtime: { readText(file: string): string | undefined },
  input: { advisoryFile: string; structuredOutput?: string },
): unknown {
  const file = input.structuredOutput ?? input.advisoryFile;
  const source = runtime.readText(file);
  if (source === undefined) throw new AcceptanceProtocolError(`UI reviewer produced no advisory proposal (${file})`);
  let proposal: unknown;
  try { proposal = JSON.parse(source); }
  catch { throw new AcceptanceProtocolError(`UI advisory proposal is not a JSON object (${file})`); }
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new AcceptanceProtocolError(`UI advisory proposal is not a JSON object (${file})`);
  }
  return proposal;
}
