import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRun, setup, installAuthentication, removeAuthentication, writeJson, MODEL, EFFORT, AGENT } from './runtime';
import { preparePython } from './python-runtime';
import { agentTurn, auditModels, requireIndependentReview, readReviewVerdict, reviewVerdictPath } from './workload';
import { sourceFingerprint, assertReviewerSourceUnchanged } from './integrity';

/** A new tiny fixture calibrates reviewer transport, never promotes an old business run. */
export async function reviewProbe(candidate: string, auth: string | undefined): Promise<string> {
  const run = createRun(candidate, 'review-probe');
  const start = Date.now();
  console.log(JSON.stringify({phase: 'review-probe', root: run.root}));
  try {
    await preparePython(run);
    await setup(run);
    fs.writeFileSync(path.join(run.workspace, 'request.md'), 'sum_values accepts a list of signed integers and returns their sum. An empty list returns zero. The delivery also includes .env.example with SAMPLE_MODE=offline as a non-secret configuration example. Review this tiny fixture by inspecting the implementation and actually executing pytest; do not modify source or Codument assets. This is reviewer calibration, not a business delivery.\n');
    fs.writeFileSync(path.join(run.workspace, '.env.example'), 'SAMPLE_MODE=offline\n');
    fs.writeFileSync(path.join(run.workspace, 'sum_values.py'), 'def sum_values(values):\n    return sum(values)\n');
    fs.writeFileSync(path.join(run.workspace, 'test_sum_values.py'), 'from sum_values import sum_values\n\ndef test_sum_values():\n    assert sum_values([]) == 0\n    assert sum_values([2, -5, 1]) == -2\n');
    const schema = path.join(run.root, 'review-schema.json');
    const schemaJson = {type: 'object', additionalProperties: false, properties: {verdict: {type: 'string', enum: ['PASS', 'FAIL']}, findings: {type: 'array', items: {type: 'string'}}, checks: {type: 'array', items: {type: 'string'}}}, required: ['verdict', 'findings', 'checks']};
    writeJson(schema, schemaJson);
    const contract = AGENT.schemaArgs(schema, JSON.stringify(schemaJson));
    const before = sourceFingerprint(run);
    const verdictFile = reviewVerdictPath(run, 'review-0');
    installAuthentication(run, auth);
    const receipt = await agentTurn(run,
      `This is a narrow read-only reviewer calibration, using ${MODEL}${EFFORT ? `/${EFFORT}` : ''}. Do not spawn other agents or modify workflow state. Read request.md, sum_values.py and test_sum_values.py. Independently test the stated behavior; do not assume it passes. Create any Python environment only under the supplied TMPDIR and install pytest there; invoke it by its venv path with PYTHONDONTWRITEBYTECODE=1, PYTHONPATH="$PWD", and -p no:cacheprovider to keep the delivery read-only. Do not install anything globally. ` +
      'The verdict and the two arrays are mutually exclusive by contract: verdict=PASS requires an empty findings array and at least one check, and verdict=FAIL requires at least one finding. Record positive observations as checks, and reserve findings strictly for defects that justify FAIL; a PASS verdict with any finding is rejected as malformed. ' +
      `Write that verdict as a JSON object to this exact file using a file write tool: ${verdictFile}\nDo not put the verdict in the chat message; chat may be ordinary prose. The file is the only review contract.\n` + contract.promptSuffix,
      'review-0', 600_000, contract.args, 'read-only');
    assertReviewerSourceUnchanged(before, sourceFingerprint(run));
    const review = readReviewVerdict(run, 'review-0', receipt.outputFile, schema);
    requireIndependentReview(review, receipt.executions);
    auditModels(run);
    writeJson(path.join(run.root, 'result.json'), {status: 'passed', caseId: 'review-probe', agent: AGENT.id, model: MODEL, effort: EFFORT, elapsedMs: Date.now() - start, root: run.root, receipt, review, businessAcceptance: false});
    return run.root;
  } catch (error) {
    writeJson(path.join(run.root, 'result.json'), {status: 'infrastructure-failed', caseId: 'review-probe', agent: AGENT.id, elapsedMs: Date.now() - start, root: run.root, error: String(error), businessAcceptance: false});
    throw error;
  } finally { removeAuthentication(run); }
}
