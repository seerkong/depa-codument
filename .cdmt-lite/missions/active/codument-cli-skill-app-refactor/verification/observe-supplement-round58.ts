import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';

const [batchArg, projectArg, probeArg, reviewArg] = process.argv.slice(2);
const batch=fs.realpathSync(batchArg!),project=fs.realpathSync(projectArg!);
assert.match(batch,/^\/(private\/)?tmp\/depa-codument-e2e-batch-[^/]+$/);
assert.match(project,/^\/(private\/)?tmp\/depa-codument-verification-[^/]+\/depa-codument\/project$/);
const roots=[probeArg!,reviewArg!].map(root=>fs.realpathSync(root));
for(const root of roots)assert.match(root,/^\/(private\/)?tmp\/depa-codument-e2e-[^/]+$/);
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const state=read(path.join(batch,'suite-status.json'));
assert.equal(state.status,'completed');
const runtime=await import(path.join(project,'e2e/runtime.ts'));
const integrity=await import(path.join(project,'e2e/integrity.ts'));
const reporting=await import(path.join(project,'e2e/report.ts'));
const harnessSha256=runtime.treeHash(path.join(project,'e2e'));
assert.equal(runtime.sha(path.join(project,'dist/depa-codument')),state.candidateSha256);
const closedEndpoints:string[]=[],closedOrigins:string[]=[],fixtures:unknown[]=[];
async function requireClosed(endpoint:string) {
  assert.match(endpoint,/^http:\/\/127\.0\.0\.1:\d+(?:\/health)?$/);
  let reachable=false;
  try {await fetch(endpoint,{signal:AbortSignal.timeout(1000)});reachable=true;}catch{/* released */}
  assert.equal(reachable,false,`Owned endpoint retained: ${endpoint}`);
}
for(const root of roots) {
  const provenance=read(path.join(root,'provenance.json'));
  assert.equal(provenance.sha256,state.candidateSha256);
  assert.equal(provenance.harnessSha256,harnessSha256);
  assert.equal(fs.existsSync(path.join(root,'home/.codex/auth.json')),false);
  const calibrations=fs.readdirSync(root).filter(name=>/^persistent-preflight-.*\.json$/.test(name));
  assert.ok(calibrations.length);
  for(const name of calibrations) {
    const fixture=read(path.join(root,name));
    assert.equal(fixture.status,'passed'); assert.equal(fixture.workerReleased,true);
    assert.equal(fixture.rounds.length,3);
    assert.ok(fixture.rounds.every((round:any)=>round.status==='passed'&&round.absentOptionRecovered&&round.emptyValuesObserved&&round.pointerInterceptionRecovered));
    await requireClosed(fixture.origin+'/health'); closedOrigins.push(fixture.origin);
    fixtures.push({root,name,...fixture});
  }
  for(const name of fs.readdirSync(path.join(root,'home/tmp')).filter(name=>name.endsWith('-connection.json'))) {
    const endpoint=read(path.join(root,'home/tmp',name)).endpoint;
    if(endpoint){await requireClosed(endpoint);closedEndpoints.push(endpoint);}
  }
  for(const name of fs.readdirSync(root).filter(name=>/^ui-controller-\d+\.json$/.test(name))) {
    const origin=read(path.join(root,name)).origin;
    if(origin){await requireClosed(origin+'/health');closedOrigins.push(origin);}
  }
}
const review=roots[1]!,result=read(path.join(review,'result.json'));
assert.equal(result.kind,'ui-reverification');
assert.ok(['passed','failed'].includes(result.status),'Unresolved infrastructure cannot complete this closure');
const provenance=read(path.join(review,'provenance.json'));
const original=state.rows.find((row:any)=>row.root===result.sourceRunRoot);
assert.ok(original); assert.equal(original.caseId,'todo'); assert.equal(original.state,'infrastructure-failed');
assert.deepEqual(read(path.join(original.root,'result.json')),original.result,'Historical result changed');
assert.equal(integrity.sourceFingerprint(runtime.loadRun(original.root,state.candidate,'todo')),provenance.historicalSourceFingerprint);
const models=runtime.AGENT.auditModels({root:review,workspace:provenance.sourceWorkspace,home:path.join(review,'home'),env:{}}).contexts;
assert.ok(models.length);assert.ok(models.every((context:any)=>context.model==='gpt-5.6-terra'&&context.effort==='medium'));
const report=reporting.summarize([review]);
const owner=read(path.join(review,'run-owner.json'));
const elapsedMs=fs.statSync(path.join(review,'result.json')).mtimeMs-Date.parse(owner.createdAt);
assert.ok(Number.isFinite(elapsedMs)&&elapsedMs>=0);
const output={round:58,status:'completed',harnessSha256,roots,fixtures,result,report,models,
  elapsedMs,timingBasis:'owned-root creation to terminal result mtime; includes native calibration and UI setup/review, separate from formal runner elapsed',
  closedEndpoints,closedOrigins,sourceUnchanged:true,historicalResultUnchanged:true,
  warning:'Supplemental read-only UI review, not a fresh full generation or a sixth formal trial; it cannot alter first/final pass rates, attempt budgets or historical costs.'};
runtime.writeJson(path.join(batch,'supplement-observation.json'),output);
console.log(JSON.stringify({file:path.join(batch,'supplement-observation.json'),status:result.status,review,elapsedMs,
  usage:report.runs[0].usage,modelContexts:models.length,fixtures:fixtures.length,closedEndpoints:closedEndpoints.length,sourceUnchanged:true,historicalResultUnchanged:true}));
