import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';

// Replay native transport evidence only. Never rewrite a historical result or
// manufacture an official current lease; this is a harness contract regression.
const project=fs.realpathSync(process.argv[2]!);
assert.match(project,/^\/(private\/)?tmp\/depa-codument-verification-[^/]+\/depa-codument\/project$/);
const runtime=await import(path.join(project,'e2e/runtime.ts'));
const ui=await import(path.join(project,'e2e/ui-acceptance.ts'));
const gate=await import(path.join(project,'e2e/ui-gate.ts'));
const integrity=await import(path.join(project,'e2e/integrity.ts'));
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const rows=[];
for(const root of process.argv.slice(3)){
  runtime.assertTemporary(root);
  const provenance=read(path.join(root,'provenance.json'));
  assert.equal(provenance.kind,'ui-reverification');
  const run=runtime.loadRun(root,path.join(root,'bin/depa-codument'),provenance.caseId);
  const request=read(path.join(root,'ui-request-0.json'));
  const controller=read(path.join(root,'ui-controller-0.json'));
  const scenario=read(path.join(root,'ui-scenario-0.json'));
  assert.equal(integrity.sourceFingerprint(run),request.sourceFingerprint);
  const proposalFile=ui.proposalPath(run,0),nativeLog=path.join(root,'logs/ui-acceptance-0-browser-channel.jsonl');
  const proposalDigest=runtime.sha(proposalFile),nativeDigest=runtime.sha(nativeLog),resultDigest=runtime.sha(path.join(root,'result.json'));
  const context={run,caseId:provenance.caseId,attempt:0,origin:controller.origin,leaseId:controller.leaseId,sourceFingerprint:request.sourceFingerprint,dataDirectory:request.dataDirectory,session:'3',scenario};
  let projectedStatus='passed',error:null|string=null;
  try{
    const receipt=ui.admitAcceptance(read(proposalFile),context,ui.readChannelTrace(nativeLog));
    gate.validateUiReceipt(receipt,context);
  }catch(e){projectedStatus=e instanceof gate.BrowserAcceptanceFailure?'business-failed':'rejected';error=String(e);}
  assert.equal(runtime.sha(proposalFile),proposalDigest);
  assert.equal(runtime.sha(nativeLog),nativeDigest);
  assert.equal(runtime.sha(path.join(root,'result.json')),resultDigest);
  rows.push({root,caseId:provenance.caseId,historicalStatus:read(path.join(root,'result.json')).status,projectedStatus,error,proposalDigest,nativeDigest,resultDigest,immutable:true});
}
const report={kind:'read-only native-trace contract replay, NOT official trial/UI results',harnessSha256:runtime.treeHash(path.join(project,'e2e')),rows};
runtime.writeJson(path.join(import.meta.dir,'terra-protocol-round54-replay.json'),report);
console.log(JSON.stringify(report));
if(rows.some(r=>r.projectedStatus==='rejected'))process.exitCode=1;
