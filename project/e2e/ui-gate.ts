import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeJson, loadRun, execute, sandbox, assertTemporary, type Run } from './runtime';
import { applicationEnvironment } from './application-state';

export function validateUiReceipt(receipt: any, expected: {caseId:string;attempt:number;sourceFingerprint:string;dataDirectory?:string}): void {
  for (const key of ['caseId','attempt','sourceFingerprint'] as const) assert.equal(receipt[key],expected[key],`Browser evidence ${key} mismatch`);
  if (expected.dataDirectory) assert.equal(receipt.dataDirectory,expected.dataDirectory,'Browser runtime state directory mismatch');
  assert.equal(receipt.status,'passed',`Browser acceptance failed: ${JSON.stringify(receipt.findings)}`);
  assert.equal(receipt.browser,'ego-browser');
  assert.ok(Number.isInteger(receipt.spaceId) && receipt.spaceId > 0);
  assert.ok(Array.isArray(receipt.findings) && receipt.findings.length===0,'PASS cannot retain unresolved findings');
  assert.ok(Array.isArray(receipt.actions) && receipt.actions.length >= 5,'Require actual UI interaction observations, not a bare HTML response');
  const covered = new Set<string>();
  for (const action of receipt.actions) {
    assert.ok(['click','fill','select','dialog','observe'].includes(action.operation));
    assert.match(action.url,/^http:\/\/127\.0\.0\.1:\d+(\/|$)/);
    assert.ok(typeof action.target==='string' && action.target.length>0);
    assert.ok(typeof action.observed==='string' && action.observed.length>0);
    assert.ok(typeof action.expected==='string' && action.expected.length>0);
    assert.ok(action.observed.includes(action.expected),'Visible browser assertion failed');
    covered.add(action.coverage);
  }
  for (const coverage of ['authentication','business-create','business-update','business-query','literal-input']) assert.ok(covered.has(coverage),`Missing browser coverage: ${coverage}`);
}

/** Browser authority belongs to the outer controller, never the generated app or its agent. */
export async function awaitUiGate(run: Run, caseId: string, attempt: number, sourceFingerprint: string) {
  const env = applicationEnvironment(run,`ui-${attempt}`);
  const expected = {caseId,attempt,sourceFingerprint,dataDirectory:env.E2E_DATA_DIR!};
  writeJson(path.join(run.root,`ui-request-${attempt}.json`),{...expected,status:'awaiting-ui',workspace:run.workspace,serverCommand:JSON.parse(fs.readFileSync(path.join(run.workspace,'e2e-server.json'),'utf8')).command,controllerCommand:['bun','e2e/run.ts','ui-server',run.root,'--bin='+run.bin],lifecycle:'Controller starts the isolated server, operates a real browser, records evidence, then terminates its exact serverControllerPid.'});
  console.log(JSON.stringify({phase:'awaiting-ui',root:run.root,...expected}));
  const receiptFile = path.join(run.root,`ui-receipt-${attempt}.json`);
  const deadline = Date.now()+900_000;
  while (!fs.existsSync(receiptFile)) {
    if (Date.now() >= deadline) throw new Error('Independent browser controller did not provide evidence within 15 minutes');
    await Bun.sleep(1000);
  }
  const receipt = JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  validateUiReceipt(receipt,expected);
  return receipt;
}

export async function serveUi(root: string, candidate: string) {
  root = assertTemporary(root);
  const provenance = JSON.parse(fs.readFileSync(path.join(root,'provenance.json'),'utf8'));
  const run = loadRun(root,candidate,provenance.caseId);
  const config = JSON.parse(fs.readFileSync(path.join(run.workspace,'e2e-server.json'),'utf8'));
  assert.ok(Array.isArray(config.command) && config.command.length && config.command.every((v:unknown)=>typeof v==='string'));
  const listener = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response('allocation')});
  const port = listener.port!; listener.stop(true);
  const name = `ui-server-${Date.now()}`;
  const pending = fs.readdirSync(root).flatMap(file=>{const match=/^ui-request-(\d+)\.json$/.exec(file);return match && !fs.existsSync(path.join(root,`ui-receipt-${match[1]}.json`)) ? [Number(match[1])] : [];}).sort((a,b)=>b-a)[0];
  const request = pending === undefined ? undefined : JSON.parse(fs.readFileSync(path.join(root,`ui-request-${pending}.json`),'utf8'));
  const env = applicationEnvironment(run,request?.dataDirectory ? `ui-${pending}` : name);
  if (request?.dataDirectory) assert.equal(env.E2E_DATA_DIR,request.dataDirectory,'Pending browser state identity mismatch');
  const receipt = {origin:`http://127.0.0.1:${port}`,root,serverControllerPid:process.pid,dataDirectory:env.E2E_DATA_DIR};
  writeJson(path.join(root,name+'.json'),receipt);
  console.log(JSON.stringify(receipt));
  return execute({argv:sandbox(run,config.command),cwd:run.workspace,env:{...env,PORT:String(port)},log:path.join(root,`logs/${name}.log`),timeoutMs:900_000});
}
