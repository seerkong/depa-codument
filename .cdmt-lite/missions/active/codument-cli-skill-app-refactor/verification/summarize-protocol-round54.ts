import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {createHash} from 'node:crypto';

// Evidence projection only. No generated-app actions, expected results or repairs.
const project=fs.realpathSync(process.argv[2]!);
assert.match(project,/^\/(private\/)?tmp\/depa-codument-verification-[^/]+\/depa-codument\/project$/);
const runtime=await import(path.join(project,'e2e/runtime.ts'));
const integrity=await import(path.join(project,'e2e/integrity.ts'));
const workload=await import(path.join(project,'e2e/workload.ts'));
const reporting=await import(path.join(project,'e2e/report.ts'));
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const batches=process.argv.slice(3).map(root=>{
  assert.match(fs.realpathSync(root),/^\/(private\/)?tmp\/depa-codument-e2e-batch-[^/]+$/);
  const batch=read(path.join(root,'suite-status.json'));
  assert.equal(batch.status,'completed','Wait for all workers before final observation');
  return batch;
});
async function fingerprint(root:string):Promise<string>{
  const rows:string[]=[];
  function walk(file:string):void{
    const stat=fs.lstatSync(file),local=path.relative(root,file);
    if(stat.isSymbolicLink())rows.push(`${local}:${stat.mode}:link:${fs.readlinkSync(file)}`);
    else if(stat.isDirectory()){
      rows.push(`${local}:${stat.mode}:dir`);
      for(const name of fs.readdirSync(file).sort())walk(path.join(file,name));
    }else rows.push(`${local}:${stat.mode}:${runtime.sha(file)}`);
  }
  walk(root);
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}
const original='/Users/kongweixian/infra-dev/depa-codument';
assert.equal(runtime.treeHash(path.join(original,'project/e2e')),runtime.treeHash(path.join(project,'e2e')),'Final source differs from verified harness');
const snapshot=read(path.resolve(project,'../../snapshot.json'));
const protectedAfter={workspace:await fingerprint(path.join(original,'codument')),oldBin:await fingerprint('/Users/kongweixian/.local/bin/codument'),oldBinBytes:runtime.sha('/Users/kongweixian/.local/bin/codument')};
assert.deepEqual(protectedAfter,snapshot.protectedBefore,'Protected original drift');
const roots=batches.flatMap(b=>b.rows.map((row:any)=>row.root));
const closedEndpoints:string[]=[];
const rows=[];
for(const root of roots){
  runtime.assertTemporary(root);
  const provenance=read(path.join(root,'provenance.json'));
  const run=runtime.loadRun(root,path.join(root,'bin/depa-codument'),provenance.caseId);
  workload.auditModels(run); // Metadata in the NEW verification root only.
  const request=read(path.join(root,'ui-request-0.json'));
  assert.equal(fs.existsSync(path.join(run.home,'.codex/auth.json')),false,'Authentication not removed');
  assert.equal(integrity.sourceFingerprint(run),request.sourceFingerprint,'Historical source changed');
  const historical=read(path.join(provenance.sourceRunRoot,'result.json'));
  assert.equal(historical.status,'infrastructure-failed','Historical verdict changed');
  assert.equal(runtime.sha(path.join(provenance.sourceRunRoot,'bin/depa-codument')),provenance.sha256);
  const logs=path.join(root,'logs');
  const events=fs.readdirSync(logs).filter(n=>n.endsWith('-browser-channel.jsonl')).flatMap(n=>fs.readFileSync(path.join(logs,n),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)));
  const businessEvents=events.filter((e:any)=>e.request && e.origin===read(path.join(root,'ui-controller-0.json')).origin);
  const result=read(path.join(root,'result.json'));
  const receiptFile=path.join(root,'ui-receipt-0.json');
  const receipt=fs.existsSync(receiptFile)?read(receiptFile):null;
  const planFile=path.join(root,'ui-scenario-0.json');
  const scenario=fs.existsSync(planFile)?read(planFile):null;
  const counts:Record<string,number>={};
  for(const r of scenario?.plan.requirements??[])counts[r.channel]=(counts[r.channel]??0)+1;
  for(const n of fs.readdirSync(path.join(run.home,'tmp')).filter(n=>n.endsWith('-connection.json'))){
    const endpoint=read(path.join(run.home,'tmp',n)).endpoint;
    if(!endpoint)continue;
    let reachable=false;
    try{await fetch(endpoint,{signal:AbortSignal.timeout(1000)});reachable=true;}catch{/* refused connection */}
    assert.equal(reachable,false,`Leaked endpoint: ${endpoint}`);
    closedEndpoints.push(endpoint);
  }
  rows.push({root,caseId:provenance.caseId,sourceRunRoot:provenance.sourceRunRoot,harnessSha256:provenance.harnessSha256,status:result.status,failureClass:result.failureClass??null,error:result.error??null,sourceUnchanged:true,historicalStatus:historical.status,candidateSha256:provenance.sha256,scopeCounts:counts,setupSealed:scenario?.prepared??false,actions:receipt?.actions?.length??0,browserRequests:businessEvents.length,recoverableErrors:businessEvents.filter((e:any)=>e.response?.failure?.recoverable).length,uncertainEffects:businessEvents.filter((e:any)=>e.response?.failure?.mayHaveLateEffects).length,protocolRepairRounds:fs.existsSync(path.join(root,'ui-protocol-0-receipt.json'))?1:0,modelContexts:read(path.join(root,'model-audit.json')).contexts});
}
const report={round:54,createdAt:new Date().toISOString(),scope:'existing generated apps, UI-only read-only verification; not full E2E success rates',project,harnessSha256:runtime.treeHash(path.join(project,'e2e')),batches,rows,protectedAfter,protectedUnchanged:true,closedEndpoints,report:reporting.summarize(roots)};
runtime.writeJson(path.join(import.meta.dir,'terra-protocol-round54.json'),report);
console.log(JSON.stringify({rows:rows.map(({caseId,status,failureClass,actions,browserRequests})=>({caseId,status,failureClass,actions,browserRequests})),protectedUnchanged:true,closedEndpoints:closedEndpoints.length}));
