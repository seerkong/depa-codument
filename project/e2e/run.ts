import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import { smoke } from './smoke';
import { probe, runCase } from './workload';
import { defaultAuth, writeJson } from './runtime';
import { summarize } from './report';
import { awaitUiGate, createUiReverification, serveUi, submitUiReceipt } from './ui-gate';
import { reviewProbe } from './review-probe';

const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: { bin: { type: 'string' }, codex: { type: 'string' }, auth: { type: 'string' }, resume: {type:'string'}, receipt: {type:'string'}, help: {type:'boolean',short:'h'} } });
if(values.help){ console.log('E2E: smoke | probe | review-probe | run <case> --bin=<candidate> [--codex=<path>] [--auth=<path>] [--resume=<run-root>]\nE2E: ui-server <run-root> --bin=<candidate>\nE2E: ui-receipt <run-root> --bin=<candidate> --receipt=<json>\nE2E: ui-reverify <historical-run-root> --bin=<candidate>\nE2E: report <run-root> ...'); process.exit(0); }
if(positionals[0]==='report'){ console.log(JSON.stringify(summarize(positionals.slice(1)),null,2)); process.exit(0); }
if (!values.bin) throw new Error('--bin=<absolute candidate> is required; no legacy/global fallback');
if (positionals[0] === 'smoke') console.log(JSON.stringify(await smoke(values.bin), null, 2));
else if (positionals[0] === 'probe') console.log(await probe(values.bin, values.codex ?? 'codex', values.auth ?? defaultAuth()));
else if (positionals[0] === 'review-probe') console.log(await reviewProbe(values.bin, values.codex ?? 'codex', values.auth ?? defaultAuth()));
else if (positionals[0] === 'ui-server') { const result = await serveUi(positionals[1]!,values.bin); console.log(JSON.stringify(result)); process.exitCode=result.code; }
else if (positionals[0] === 'ui-receipt') {
  if (!values.receipt) throw new Error('--receipt=<JSON> is required');
  console.log(JSON.stringify(submitUiReceipt(positionals[1]!, values.bin, JSON.parse(values.receipt)), null, 2));
}
else if (positionals[0] === 'ui-reverify') {
  const run = createUiReverification(positionals[1]!, values.bin);
  try {
    const receipt = await awaitUiGate(run, runCaseId(run.root), 0, historicalFingerprint(run.root), { sourceRunRoot: historicalSourceRunRoot(run.root), historicalStatus: 'infrastructure-failed' });
    const result = { status: 'passed', kind: 'ui-reverification', root: run.root, sourceRunRoot: historicalSourceRunRoot(run.root), receipt };
    writeJson(run.root + '/result.json', result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    writeJson(run.root + '/result.json', { status: 'infrastructure-failed', kind: 'ui-reverification', root: run.root, sourceRunRoot: historicalSourceRunRoot(run.root), error: String(error) });
    throw error;
  }
}
else if (positionals[0] === 'run') {
  const result = await runCase(values.bin, values.codex ?? 'codex', values.auth ?? defaultAuth(), positionals[1] ?? 'todo', values.resume);
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'passed' ? 0 : 1;
} else throw new Error('Supported commands: smoke | probe | review-probe | run <case> | ui-server | ui-receipt | ui-reverify');

function runRootProvenance(root: string) { return root + '/provenance.json'; }
function runCaseId(root: string): string { return JSON.parse(fs.readFileSync(runRootProvenance(root), 'utf8')).caseId; }
function historicalFingerprint(root: string): string { return JSON.parse(fs.readFileSync(runRootProvenance(root), 'utf8')).historicalSourceFingerprint; }
function historicalSourceRunRoot(root: string): string { return JSON.parse(fs.readFileSync(runRootProvenance(root), 'utf8')).sourceRunRoot; }
