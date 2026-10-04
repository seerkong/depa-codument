import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';

const batch=fs.realpathSync(process.argv[2]!);
assert.match(batch,/^\/(private\/)?tmp\/depa-codument-e2e-batch-[^/]+$/);
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const state=read(path.join(batch,'suite-status.json'));
assert.equal(state.status,'completed','Do not score a live or interrupted suite as completed');
assert.equal(state.round,58); assert.equal(state.rows.length,5);
const runtime=await import(path.join(state.project,'e2e/runtime.ts'));
const reporting=await import(path.join(state.project,'e2e/report.ts'));
assert.equal(runtime.sha(state.candidate),state.candidateSha256);
assert.equal(runtime.treeHash(path.join(state.project,'e2e')),state.harnessSha256);
const history=read(path.join(import.meta.dir,'paired-e2e-round55.json'));
const installation=read(path.join(path.dirname(path.dirname(state.project)),'global-install-round58.json'));
assert.equal(runtime.sha(installation.binary),state.candidateSha256);
assert.equal(runtime.sha('/Users/kongweixian/.local/bin/codument'),installation.protectedBefore.oldBinBytes);
assert.equal(fs.readlinkSync('/Users/kongweixian/.local/bin/codument'),installation.protectedBefore.oldBinLink);
assert.equal(runtime.treeHash('/Users/kongweixian/infra-dev/depa-codument/codument'),installation.protectedBefore.workspace);
for(const directory of ['.agents/skills','.claude/skills','.eidolon/skills'])assert.equal(runtime.treeHash(path.join('/Users/kongweixian',directory,'depa-codument')),installation.appSha256);
const contexts:unknown[]=[],closedEndpoints:string[]=[],closedUiOrigins:string[]=[];
async function requireClosed(endpoint:string) {
  assert.match(endpoint,/^http:\/\/127\.0\.0\.1:\d+(?:\/health)?$/);
  let reachable=false;
  try { await fetch(endpoint,{signal:AbortSignal.timeout(1000)}); reachable=true; } catch { /* endpoint released */ }
  assert.equal(reachable,false,`Owned endpoint retained: ${endpoint}`);
}
for(const row of state.rows) {
  assert.notEqual(row.state,'running'); assert.ok(row.root);
  const root=row.root;
  assert.equal(fs.existsSync(path.join(root,'home/.codex/auth.json')),false,'Authentication remains');
  const provenance=read(path.join(root,'provenance.json'));
  assert.equal(provenance.sha256,state.candidateSha256);
  assert.equal(provenance.harnessSha256,state.harnessSha256);
  const models=runtime.AGENT.auditModels({root,workspace:path.join(root,'workspace'),home:path.join(root,'home'),env:{}}).contexts;
  assert.ok(models.length); assert.ok(models.every((context:any)=>context.model==='gpt-5.6-terra'&&context.effort==='medium'));
  contexts.push(...models);
  const skill=read(path.join(root,'installation.json'));
  assert.equal(runtime.treeHash(skill.skill),skill.hash);
  assert.equal(skill.hash,installation.appSha256);
  const policy=read(path.join(root,'workflow-policy.json'));
  assert.deepEqual(policy,history.workflowPolicy,'Public workflow policy drift');
  for(const [name,digest] of Object.entries(read(path.join(root,'requirements.json')))) {
    assert.equal(runtime.sha(path.join(root,'workspace',name)),digest,'Delivered requirements drift');
    assert.equal(runtime.sha(path.join(state.project,'e2e/cases',row.caseId,name)),digest);
  }
  assert.equal(runtime.treeHash(path.join(state.project,'e2e/cases',row.caseId)),history.requirementHashes[row.caseId],'History requirement bytes differ');
  for(const name of fs.readdirSync(root).filter(name=>/^ui-controller-\d+\.json$/.test(name))) {
    const origin=read(path.join(root,name)).origin;
    if(origin) { await requireClosed(origin+'/health'); closedUiOrigins.push(origin); }
  }
  for(const name of fs.readdirSync(path.join(root,'home/tmp')).filter(name=>name.endsWith('-connection.json'))) {
    const endpoint=read(path.join(root,'home/tmp',name)).endpoint;
    if(endpoint) { await requireClosed(endpoint); closedEndpoints.push(endpoint); }
  }
}
const report=reporting.summarize(state.rows.map((row:any)=>row.root));
const sum=(rows:any[])=>({
  sampleSize:rows.length,firstPass:rows.filter(row=>row.firstPass===true).length,
  finalPassed:rows.filter(row=>row.status==='passed').length,
  infrastructure:rows.filter(row=>row.status==='infrastructure-failed').length,
  elapsedMs:rows.reduce((total,row)=>total+(row.elapsedMs??0),0),
  usage:rows.every(row=>row.usage) ? rows.reduce((total,row)=>({input:total.input+row.usage.input,cached:total.cached+row.usage.cached,output:total.output+row.usage.output}),{input:0,cached:0,output:0}) : null,
});
const rows=report.runs.map((row:any)=> {
  const result=read(path.join(row.root,'result.json'));
  const uiReceipts=row.gateCoverage.uiReceipts.map((name:string)=>({name,...read(path.join(row.root,name))}));
  return {...row,attempts:result.attempts?.map((attempt:any)=>({
    attempt:attempt.attempt,status:attempt.status,elapsedMs:attempt.elapsedMs,
    error:attempt.error??null,
  }))??null,error:result.error??null,failureClass:result.failureClass??null,uiReceipts};
});
// Round55 recorded both supervisor wall time and runner elapsed time. Compare
// runner clocks here; calibration/reverification never enter the five-case sum.
const historicalRows=history.formal.rows.map((row:any)=>({...row,elapsedMs:row.runnerElapsedMs??row.elapsedMs}));
const output={round:58,observedAt:new Date().toISOString(),status:'completed',batch,state,installation,
  report,rows,summary:sum(rows),history:{round55Current:sum(historicalRows.filter((row:any)=>row.product==='current')),round55Legacy:sum(historicalRows.filter((row:any)=>row.product==='legacy'))},
  contexts,closedEndpoints,closedUiOrigins,protectedUnchanged:true,
  warning:'One fresh sample per case; this is descriptive history, not causal A/B. Product/Skill and harness changed. Same original requirements, public policy and maximum three outer attempts. First pass may include internal fresh verification and repair. GapLoop/AttractorCheck/HumanConfirm are disabled by the unchanged benchmark policy. Usage covers observed parent/child response deltas, including failures, not an account bill; calibration costs are separate.'};
runtime.writeJson(path.join(batch,'observation.json'),output);
console.log(JSON.stringify({file:path.join(batch,'observation.json'),summary:output.summary,history:output.history,
  cases:rows.map((row:any)=>({caseId:row.caseId,status:row.status,firstPass:row.firstPass,attempts:row.attempts?.length,elapsedMs:row.elapsedMs,error:row.error})),
  modelContexts:contexts.length,closedEndpoints:closedEndpoints.length,closedUiOrigins:closedUiOrigins.length,protectedUnchanged:true}));
