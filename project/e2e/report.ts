import * as fs from 'node:fs';
import * as path from 'node:path';
import { assertTemporary, files } from './runtime';
import { type Usage } from './agent-runtime';
import { sessionUsage } from './usage';

export function summarize(roots: string[]) {
  const rows = roots.map(root => {
    assertTemporary(root);
    const file = path.join(root, 'result.json');
    const result = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : { status: 'incomplete' };
    const readOptional = (name: string) => {
      const file = path.join(root,name);
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : null;
    };
    const provenance = readOptional('provenance.json');
    const workflowPolicy = readOptional('workflow-policy.json');
    const terminalPolicy = readOptional('terminal-policy.json');
    const rawStatus = result.status;
    if (terminalPolicy) {
      if (terminalPolicy.kind !== 'configured-workflow-block' || typeof terminalPolicy.reason !== 'string' || !terminalPolicy.reason.trim()) throw new Error('Invalid workflow-block receipt');
      result.status = 'blocked'; result.firstPass = false;
    }
    const names = fs.readdirSync(root);
    const harness = { initialSha256:provenance?.harnessSha256 ?? null, resumes:names.filter(n=>n.startsWith('resume-provenance-')).map(readOptional) };
    const gateCoverage = { immutableRequirements:fs.existsSync(path.join(root,'requirements.json')), observedModels:fs.existsSync(path.join(root,'model-audit.json')), uiReceipts:names.filter(n=>/^ui-receipt-\d+\.json$/.test(n)), baseline:provenance?.harnessSha256 ? 'recorded' : 'legacy-baseline (do not infer current gates)' };
    const classification = path.join(root,'classification.json');
    if (fs.existsSync(classification)) {
      const correction = JSON.parse(fs.readFileSync(classification,'utf8'));
      if (correction.status !== 'harness-invalid' || typeof correction.reason !== 'string' || !correction.reason.trim()) throw new Error('Classification can only invalidate a trial with an auditable reason, never promote it');
      result.status = correction.status;
    }
    // The per-turn receipt is the runtime-agnostic evidence projection (the raw
    // event log path differs between codex and eidolon); aggregate it directly.
    const receipts = files(root).filter(f => /\/(plan|implementation|review)-\d+-receipt\.json$/.test(f)).sort()
      .map(receiptPath => JSON.parse(fs.readFileSync(receiptPath,'utf8')));
    const measured = receipts.map(r => r.usage).filter((v): v is Usage => v !== null);
    const usage = measured.length ? measured.reduce((sum,u) => ({ input:sum.input+u.input, cached:sum.cached+u.cached, output:sum.output+u.output }), { input:0,cached:0,output:0 }) : null;
    const allSessions = sessionUsage(root);
    const usageEstimated = receipts.some(r => r.usageEstimated === true);
    const outputTokensUnavailable = receipts.some(r => r.outputTokensUnavailable === true);
    return { root, kind: result.kind ?? provenance?.kind ?? 'business-trial', sourceRunRoot: result.sourceRunRoot ?? provenance?.sourceRunRoot ?? null, caseId: result.caseId ?? provenance?.caseId, status: result.status, rawStatus, terminalPolicy, resumed: result.resumed === true, firstPass: result.firstPass ?? null, elapsedMs: result.elapsedMs ?? null, harness,workflowPolicy,gateCoverage,usage: allSessions.usage ?? usage, sessionAccounting: allSessions, topLevelUsage: usage, topLevelUsageComplete: receipts.length > 0 && measured.length === receipts.length, usageEstimated, outputTokensUnavailable, moneyCost: null };
  });
  const businessCases = new Set(['todo','blog','ecommerce','stream-pipeline-ai-agent','nested-mission-agent']);
  const business = rows.filter(r => r.kind === 'business-trial' && businessCases.has(r.caseId) && !['infrastructure-failed','harness-invalid','incomplete'].includes(r.status));
  const uiReverifications = rows.filter(r => r.kind === 'ui-reverification');
  const byCase = [...new Set(rows.map(r=>r.caseId).filter(Boolean))].map(caseId => {
    const cases = rows.filter(r=>r.caseId===caseId);
    const eligible = business.filter(r=>r.caseId===caseId);
    const measured = cases.filter(r=>r.usage!==null);
    return {caseId,runs:cases.length,denominator:eligible.length,
      firstPassRate:eligible.length ? eligible.filter(r=>r.firstPass).length/eligible.length : null,
      correctedPassRate:eligible.length ? eligible.filter(r=>r.status==='passed').length/eligible.length : null,
      knownUsage:measured.length ? measured.reduce((sum,r)=>({input:sum.input+r.usage!.input,cached:sum.cached+r.usage!.cached,output:sum.output+r.usage!.output}),{input:0,cached:0,output:0}) : null,
      knownUsageIsEstimated:measured.some(r=>r.usageEstimated),
      outputTokensUnavailable:measured.some(r=>r.outputTokensUnavailable),
      unknownUsageRuns:cases.length-measured.length,includesExcludedTrialCosts:true};
  });
  const anyEstimated = rows.some(r => r.usageEstimated === true);
  const anyOutputUnavailable = rows.some(r => r.outputTokensUnavailable === true);
  return { runs: rows, denominator: business.length, excludedInfrastructureOrIncomplete: rows.filter(r => r.kind === 'business-trial').length-business.length,
    uiReverifications: uiReverifications.map(r => ({ root:r.root, sourceRunRoot:r.sourceRunRoot, caseId:r.caseId, status:r.status, gateCoverage:r.gateCoverage })),
    byCase,
    firstPassRate: business.length ? business.filter(r => r.firstPass).length/business.length : null,
    correctedPassRate: business.length ? business.filter(r => r.status==='passed').length/business.length : null,
    usageIsEstimated: anyEstimated, outputTokensUnavailable: anyOutputUnavailable,
    warning: 'Small-sample observed rates, not population guarantees. Null is unknown, never zero. Different or unrecorded workflow policies are not equal-strength cost comparisons.' +
      (anyEstimated ? ' Provider-reported token counters are estimated (is_estimated), never presented as measured usage or an account bill. ' : '') +
      (anyOutputUnavailable ? ' This provider reports no completion-token counter; output tokens are unavailable and cannot be compared to a measured zero. ' : '') +
      'No API-price estimate is presented as a ChatGPT account bill.' };
}
