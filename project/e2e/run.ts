import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import { smoke } from './smoke';
import { probe, runCase } from './workload';
import { createRun, defaultAuth, installAuthentication, removeAuthentication, writeJson } from './runtime';
import { summarize } from './report';
import { awaitUiGate, BrowserAcceptanceFailure, createUiReverification, serveUi, submitUiReceipt } from './ui-gate';
import { reviewProbe } from './review-probe';

const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: { product:{type:'string'}, bin: { type: 'string' }, auth: { type: 'string' }, resume: {type:'string'}, receipt: {type:'string'}, help: {type:'boolean',short:'h'} } });
if(values.product) process.env.E2E_PRODUCT_PROFILE=values.product;
const USAGE = 'E2E: set E2E_AGENT=codex|eidolon to choose the agent runtime (default codex)\nE2E: smoke | ui-probe | probe | review-probe | run <case> --bin=<candidate> [--auth=<path>] [--resume=<run-root>]\nE2E: ui-server <run-root> --bin=<candidate>\nE2E: ui-receipt <run-root> --bin=<candidate> --receipt=<json>\nE2E: ui-reverify <historical-run-root> --bin=<candidate>\nE2E: report <run-root> ...';
if(values.help){ console.log(USAGE); process.exit(0); }
if(positionals[0]==='report'){ console.log(JSON.stringify(summarize(positionals.slice(1)),null,2)); process.exit(0); }
if (!values.bin) throw new Error('--bin=<absolute candidate> is required; no legacy/global fallback');
if (positionals[0] === 'smoke') console.log(JSON.stringify(await smoke(values.bin), null, 2));
else if (positionals[0] === 'ui-probe') {
  const run = createRun(values.bin, 'ui-probe');
  console.log(JSON.stringify({ phase: 'ego-preflight', root: run.root }));
  const { probePersistentBrowser } = await import('./ego-probe');
  await probePersistentBrowser(run);
  console.log(JSON.stringify({ status: 'passed', root: run.root }));
}
else if (positionals[0] === 'probe') console.log(await probe(values.bin, values.auth ?? defaultAuth()));
else if (positionals[0] === 'review-probe') console.log(await reviewProbe(values.bin, values.auth ?? defaultAuth()));
else if (positionals[0] === 'ui-server') { const result = await serveUi(positionals[1]!,values.bin); console.log(JSON.stringify(result)); process.exitCode=result.code; }
else if (positionals[0] === 'ui-receipt') {
  if (!values.receipt) throw new Error('--receipt=<JSON> is required');
  console.log(JSON.stringify(submitUiReceipt(positionals[1]!, values.bin, JSON.parse(values.receipt)), null, 2));
}
else if (positionals[0] === 'ui-reverify') {
  const run = createUiReverification(positionals[1]!, values.bin);
  const { probePersistentBrowser } = await import('./ego-probe');
  await probePersistentBrowser(run);
  installAuthentication(run, values.auth ?? defaultAuth());
  try {
    const receipt = await awaitUiGate(run, runCaseId(run.root), 0, historicalFingerprint(run.root), { sourceRunRoot: historicalSourceRunRoot(run.root), historicalStatus: 'infrastructure-failed' });
    const result = { status: 'passed', kind: 'ui-reverification', root: run.root, sourceRunRoot: historicalSourceRunRoot(run.root), receipt };
    writeJson(run.root + '/result.json', result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    writeJson(run.root + '/result.json', { status: error instanceof BrowserAcceptanceFailure ? 'failed' : 'infrastructure-failed', kind: 'ui-reverification', root: run.root, sourceRunRoot: historicalSourceRunRoot(run.root), error: String(error), failureClass:(error as {failureClass?:string}).failureClass ?? (error instanceof BrowserAcceptanceFailure ? 'business' : 'infrastructure') });
    throw error;
  } finally { removeAuthentication(run); }
}
else if (positionals[0] === 'run') {
  const result = await runCase(values.bin, values.auth ?? defaultAuth(), positionals[1] ?? 'todo', values.resume);
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'passed' ? 0 : 1;
} else throw new Error('Supported commands: smoke | ui-probe | probe | review-probe | run <case> | ui-server | ui-receipt | ui-reverify');

function runRootProvenance(root: string) { return root + '/provenance.json'; }
function runCaseId(root: string): string { return JSON.parse(fs.readFileSync(runRootProvenance(root), 'utf8')).caseId; }
function historicalFingerprint(root: string): string { return JSON.parse(fs.readFileSync(runRootProvenance(root), 'utf8')).historicalSourceFingerprint; }
function historicalSourceRunRoot(root: string): string { return JSON.parse(fs.readFileSync(runRootProvenance(root), 'utf8')).sourceRunRoot; }
