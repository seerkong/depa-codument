import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Reads terminal evidence only; never runs or repairs a delivered application.
const batch=fs.realpathSync(process.argv[2]!);
assert.match(batch,/^\/(private\/)?tmp\/depa-codument-e2e-batch-[^/]+$/);
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const optional=(file:string)=>fs.existsSync(file)?read(file):null;
const state=read(path.join(batch,'suite-status.json'));
assert.ok(['completed','interrupted'].includes(state.status),'Batch still running');
const runtime=await import(path.join(state.project,'e2e/runtime.ts'));
const comparison=read(path.join(batch,'comparison.json'));
const report=read(path.join(batch,'report.json'));
assert.equal(runtime.treeHash(path.join(state.project,'e2e')),state.harnessSha256);
assert.equal(comparison.protectedUnchanged,true,'Original/global protection drift');
assert.equal(comparison.actualModelsMatch,true,'Model identity mismatch');
for(const product of ['current','legacy']) {
  assert.equal(runtime.sha(state.candidates[product].bin),state.candidates[product].sha256);
}
const cases=['todo','stream-pipeline-ai-agent','blog','ecommerce','nested-mission-agent'];
const closedEndpoints:string[]=[];
const rows=[];
for(const product of ['current','legacy']) for(const caseId of cases) {
  const trial=state.rows.find((r:any)=>r.product===product&&r.caseId===caseId);
  if(!trial){rows.push({product,caseId,status:'not-run',root:null});continue;}
  assert.notEqual(trial.state,'running');
  if(!trial.root){rows.push({...trial,status:'infrastructure-failed'});continue;}
  const root=trial.root;
  runtime.assertTemporary(root);
  const result=optional(path.join(root,'result.json'));
  const projection=report.runs.find((r:any)=>r.root===root);
  const provenance=read(path.join(root,'provenance.json'));
  assert.equal(provenance.product,product);
  assert.equal(provenance.sha256,state.candidates[product].sha256);
  assert.equal(fs.existsSync(path.join(root,'home/.codex/auth.json')),false,'Temporary authentication retained');
  const receipts=fs.readdirSync(root).filter(n=>/^ui-receipt-\d+\.json$/.test(n)).map(n=>read(path.join(root,n)));
  const temporary=path.join(root,'home/tmp');
  for(const name of fs.existsSync(temporary)?fs.readdirSync(temporary).filter(n=>n.endsWith('-connection.json')):[]) {
    const endpoint=read(path.join(temporary,name)).endpoint;
    if(!endpoint)continue;
    let reachable=false;
    try{await fetch(endpoint,{signal:AbortSignal.timeout(1000)});reachable=true;}catch{/* refused connection */}
    assert.equal(reachable,false,`Browser worker endpoint retained: ${endpoint}`);
    closedEndpoints.push(endpoint);
  }
  rows.push({product,caseId,root,status:projection?.status??'incomplete',firstPass:projection?.firstPass??null,
    attempts:result?.attempts??optional(path.join(root,'progress.json'))?.attempts??null,
    wallMs:trial.wallMs,runnerElapsedMs:result?.elapsedMs??null,phases:projection?.phases??{},
    usage:projection?.usage??null,sessionAccounting:projection?.sessionAccounting??null,
    failureClass:result?.failureClass??null,error:result?.error??null,
    uiActions:receipts.map(r=>({status:r.status,actions:r.actions?.length??0,findings:r.findings??[]})),
    workflowPolicy:optional(path.join(root,'workflow-policy.json'))});
}
const products=['current','legacy'].map(product=>({product,planned:5,run:rows.filter(r=>r.product===product&&r.root).length,
  notRun:rows.filter(r=>r.product===product&&r.status==='not-run').map(r=>r.caseId)}));
const evidence={round:55,createdAt:new Date().toISOString(),batch,status:state.status,products,rows,
  closedEndpoints,protectedUnchanged:true,modelContexts:comparison.contexts,comparison,
  limitations:['One sample per case/product; current runs precede legacy.',
    'First pass means the first outer E2E attempt; internal product verification and repair may occur within it and their full cost is retained.',
    'Same requirements/model/harness/public policy, but genuine version-specific skills and workflow semantics differ.',
    'Observed token deltas include failed stages and child sessions; cached input is a subset of input, not extra usage or an account bill.',
    'Stage wall time includes internal verification and waits; child token attribution is not implied by parent phase receipts.',
    'A pre-existing release-version assertion prevents claiming the entire repository check or mission completed.']};
runtime.writeJson(path.join(import.meta.dir,'paired-e2e-round55.json'),evidence);
const duration=(ms:number|null|undefined)=>typeof ms==='number'?`${(ms/60000).toFixed(2)} min`:'unknown';
const count=(n:number|undefined)=>typeof n==='number'?n.toLocaleString('en-US'):'unknown';
const lines=['# Round55 新旧完整 E2E 对照','',`批次：\`${batch}\`；状态：${state.status}。`,
  '', '| 版本 | 用例 | 正式结果 | 首次通过 | 总耗时 | input / cached / output |',
  '|---|---|---|---|---|---|',...rows.map(r=>`| ${r.product} | ${r.caseId} | ${r.status} | ${r.firstPass??'unknown'} | ${duration(r.wallMs)} | ${count(r.usage?.input)} / ${count(r.usage?.cached)} / ${count(r.usage?.output)} |`),
  '', '## 汇总', '', '```json',JSON.stringify(comparison.groups,null,2),'```',
  '', '## 限制与证据', '', ...evidence.limitations.map(s=>`- ${s}`),
  `- ${closedEndpoints.length} 个 worker endpoint 已拒绝连接；临时认证已移除，原 workspace/global 指纹保持。`,
  '- 每个根目录保留原始结果、所有纠偏日志、安装来源、独立验收和模型会话；未运行项不是失败，也不是零成本。',
  '', ...rows.filter(r=>r.root).map(r=>`- ${r.product}/${r.caseId}: \`${r.root}\``),''];
fs.writeFileSync(path.join(import.meta.dir,'paired-e2e-round55.md'),lines.join('\n'));
console.log(JSON.stringify({status:state.status,products,closedEndpoints:closedEndpoints.length,rows:rows.map(({product,caseId,status,firstPass,wallMs})=>({product,caseId,status,firstPass,wallMs}))}));
