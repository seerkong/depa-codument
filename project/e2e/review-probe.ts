import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRun, setup, installAuthentication, removeAuthentication, writeJson, MODEL, EFFORT } from './runtime';
import { preparePython } from './python-runtime';
import { agentTurn, auditModels, requireIndependentReview } from './workload';
import { sourceFingerprint, assertReviewerSourceUnchanged } from './integrity';

/** A new tiny fixture calibrates reviewer transport, never promotes an old business run. */
export async function reviewProbe(candidate: string, codex: string, auth: string): Promise<string> {
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
    writeJson(schema, {type: 'object', additionalProperties: false, properties: {verdict: {type: 'string', enum: ['PASS', 'FAIL']}, findings: {type: 'array', items: {type: 'string'}}, checks: {type: 'array', items: {type: 'string'}}}, required: ['verdict', 'findings', 'checks']});
    const before = sourceFingerprint(run);
    installAuthentication(run, auth);
    const receipt = await agentTurn(run, codex,
      `This is a narrow read-only reviewer calibration, using ${MODEL}/${EFFORT}. Do not spawn other agents or modify workflow state. Read request.md, sum_values.py and test_sum_values.py. Independently test the stated behavior; do not assume it passes. Create any Python environment only under the supplied TMPDIR and install pytest there; invoke it by its venv path with PYTHONDONTWRITEBYTECODE=1, PYTHONPATH="$PWD", and -p no:cacheprovider to keep the delivery read-only. Return the JSON verdict with actual evidence. Do not install anything globally.`,
      'review-0', 300_000, ['--output-schema', schema], 'read-only');
    assertReviewerSourceUnchanged(before, sourceFingerprint(run));
    const review = JSON.parse(fs.readFileSync(receipt.outputFile, 'utf8'));
    requireIndependentReview(review, receipt.executions);
    auditModels(run);
    writeJson(path.join(run.root, 'result.json'), {status: 'passed', caseId: 'review-probe', model: MODEL, effort: EFFORT, elapsedMs: Date.now() - start, root: run.root, receipt, review, businessAcceptance: false});
    return run.root;
  } catch (error) {
    writeJson(path.join(run.root, 'result.json'), {status: 'infrastructure-failed', caseId: 'review-probe', elapsedMs: Date.now() - start, root: run.root, error: String(error), businessAcceptance: false});
    throw error;
  } finally { removeAuthentication(run); }
}
