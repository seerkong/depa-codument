import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root=fs.realpathSync(process.argv[2]!);
assert.match(root,/^\/(private\/)?tmp\/depa-codument-e2e-batch-[^/]+$/);
const state=JSON.parse(fs.readFileSync(path.join(root,'suite-status.json'),'utf8'));
let live=false;
try{process.kill(state.pid,0);live=true;}catch{/* dead controller */}
assert.equal(live,false,'Cannot classify a live driver');
const runtime=await import(path.join(state.project,'e2e/runtime.ts'));
const reporting=await import(path.join(state.project,'e2e/report.ts'));
const comparison=await import(path.join(state.project,'e2e/comparison.ts'));
const pilot=state.rows.find((r:any)=>r.product==='legacy');
assert.equal(pilot?.root,'/private/tmp/depa-codument-e2e-iFiRLX');
assert.equal(fs.existsSync(path.join(pilot.root,'home/.codex/auth.json')),false);
const classification={status:'harness-invalid',reason:'Harness imposed current halfcode.resource-envelope/v1 on a genuine codument.tech/v1alpha1 Track. The exact Track passed its own 0.5.4 strict validator and the corrected adapter without a model. Controller stopped; no completed coding or acceptance verdict. Preserve all pilot calls/costs; never treat this as legacy product failure or restart this root.'};
runtime.writeJson(path.join(pilot.root,'classification.json'),classification);
const report=reporting.summarize(state.rows.map((r:any)=>r.root));
const measurement=comparison.compareProducts(report.runs.map((r:any)=>({...r,elapsedMs:state.rows.find((trial:any)=>trial.root===r.root)?.wallMs??null})));
const protectedAfter=Object.fromEntries(Object.keys(state.protectedBefore).map(file=>{
  if(!fs.existsSync(file))return [file,null];
  const target=fs.realpathSync(file),stat=fs.statSync(target);
  return [file,{target,mode:stat.mode,sha256:stat.isDirectory()?runtime.treeHash(target):runtime.sha(target)}];
}));
assert.deepEqual(protectedAfter,state.protectedBefore);
const contexts=state.rows.flatMap((r:any)=>runtime.AGENT.auditModels({root:r.root,workspace:path.join(r.root,'workspace'),home:path.join(r.root,'home'),env:{}}).contexts);
assert.ok(contexts.length && contexts.every((c:any)=>c.model==='gpt-5.6-terra'&&c.effort==='medium'));
runtime.writeJson(path.join(root,'interruption-observation.json'),{status:'interrupted',observedAt:new Date().toISOString(),driverDead:true,
  priorStatusProjection:state.status,reason:classification.reason,pilot,report,measurement,contexts,protectedAfter,protectedUnchanged:true,
  resume:'New owned legacy-only batch after adapter and interruption regressions. Keep five current roots and the invalid pilot unchanged; record harness fingerprint difference. Strict final-byte equality would require explicitly approved extra current generation.'});
console.log(JSON.stringify({driverDead:true,pilot:classification.status,protectedUnchanged:true,groups:measurement.groups}));
