import * as fs from 'node:fs';
import * as path from 'node:path';
import {spawn} from 'node:child_process';

const project=fs.realpathSync(process.argv[2]!);
const current=fs.realpathSync(process.argv[3]!);
const legacy=fs.realpathSync(process.argv[4]!);
for(const candidate of [project,current,legacy]) if(!/^\/(private\/)?tmp\/depa-codument-verification-[^/]+\//.test(candidate)) throw Error('Frozen isolated inputs required');
const runtime=await import(path.join(project,'e2e/runtime.ts'));
if(runtime.AGENT.id!=='codex'||runtime.MODEL!=='gpt-5.6-terra'||runtime.EFFORT!=='medium')throw Error('Declared Terra/medium required');
if(!process.env.E2E_EGO_SPACE_ID)throw Error('Owner-assigned TaskSpace required');
const cases=['todo','stream-pipeline-ai-agent','blog','ecommerce','nested-mission-agent'];
const products=process.argv[5]==='legacy-only' ? ['legacy'] as const : ['current','legacy'] as const;
if(process.argv[5] && process.argv[5]!=='legacy-only')throw Error('Unknown paired test scope');
const root=fs.realpathSync(fs.mkdtempSync('/tmp/depa-codument-e2e-batch-'));
const startedAt=new Date().toISOString();
const harnessSha256=runtime.treeHash(path.join(project,'e2e'));
const requirementHashes=Object.fromEntries(cases.map(id=>[id,runtime.treeHash(path.join(project,'e2e/cases',id))]));
const candidates={current:{bin:current,sha256:runtime.sha(current)},legacy:{bin:legacy,sha256:runtime.sha(legacy)}};
const protectedPaths=[
  '/Users/kongweixian/infra-dev/depa-codument/codument',
  '/Users/kongweixian/.local/bin/codument',
  '/Users/kongweixian/.local/bin/depa-codument',
  '/Users/kongweixian/.agents/skills/depa-codument',
  '/Users/kongweixian/.claude/skills/depa-codument',
  '/Users/kongweixian/.eidolon/skills/depa-codument',
];
function observeProtected() {
  return Object.fromEntries(protectedPaths.map(file=>{
    if(!fs.existsSync(file))return [file,null];
    const target=fs.realpathSync(file),stat=fs.statSync(target);
    return [file,{target,mode:stat.mode,sha256:stat.isDirectory()?runtime.treeHash(target):runtime.sha(target)}];
  }));
}
const protectedBefore=observeProtected();
const rows:any[]=[];
let interrupted=false;
const save=(status:string)=>runtime.writeJson(path.join(root,'suite-status.json'),{round:55,status,pid:process.pid,startedAt,updatedAt:new Date().toISOString(),project,harnessSha256,requirementHashes,candidates,protectedBefore,model:runtime.MODEL,effort:runtime.EFFORT,spaceId:process.env.E2E_EGO_SPACE_ID,products,rows});
save('running');console.log(JSON.stringify({phase:'paired-e2e',root,pid:process.pid}));
for(const product of products) for(const caseId of cases){
  if(interrupted)break;
  if(runtime.treeHash(path.join(project,'e2e'))!==harnessSha256||runtime.sha(candidates[product].bin)!==candidates[product].sha256)throw Error('Frozen input drift');
  const row:any={product,caseId,state:'running',startedAt:new Date().toISOString(),log:path.join(root,`${product}-${caseId}.log`)};rows.push(row);
  const fd=fs.openSync(row.log,'wx',0o600);
  const entry=product==='legacy' ? path.resolve(project,'../e2e/run.ts') : path.join(project,'e2e/run.ts');
  const child=spawn(process.execPath,[entry,'run',caseId,`--bin=${candidates[product].bin}`],{cwd:path.dirname(project),env:{...process.env,E2E_AGENT:'codex',E2E_PRODUCT_PROFILE:product},detached:true,stdio:['ignore','pipe',fd]});
  row.pid=child.pid;save('running');let pending='';
  const interrupt=()=>{interrupted=true;save('interrupted');try{process.kill(-child.pid!,'SIGTERM');}catch{/* already ended */}};
  process.once('SIGTERM',interrupt);process.once('SIGINT',interrupt);
  child.stdout!.on('data',bytes=>{fs.writeSync(fd,bytes);pending+=bytes.toString();let end:number;
    while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);
      try{const event=JSON.parse(line);if(event.phase==='real-case'){row.root=event.root;save('running');console.log(JSON.stringify({phase:'paired-case',product,caseId,root:row.root}));}}catch{/* formatted result */}
    }
  });
  row.exitCode=await new Promise<number|null>((resolve,reject)=>{child.once('close',resolve);child.once('error',reject);}).finally(()=>{fs.closeSync(fd);process.off('SIGTERM',interrupt);process.off('SIGINT',interrupt);});
  row.finishedAt=new Date().toISOString();row.wallMs=Date.parse(row.finishedAt)-Date.parse(row.startedAt);
  if(row.root&&fs.existsSync(path.join(row.root,'result.json')))row.result=JSON.parse(fs.readFileSync(path.join(row.root,'result.json'),'utf8'));
  row.state=row.result?.status??'infrastructure-failed';save('running');console.log(JSON.stringify({phase:'paired-terminal',product,caseId,root:row.root,status:row.state,elapsedMs:row.wallMs}));
  if(row.root&&fs.existsSync(path.join(row.root,'home/.codex/auth.json'))) {
    runtime.removeAuthentication(runtime.loadRun(row.root,candidates[product].bin,caseId));
    row.authCleanupRecovered=true;
    if(fs.existsSync(path.join(row.root,'home/.codex/auth.json')))throw Error('Temporary auth was not removed');
  }
  // Quota/provider failure is shared infrastructure, not evidence that later
  // products failed. Stop rather than burning the remaining scheduled cases.
  if(row.root) {
    const names=fs.readdirSync(path.join(row.root,'logs')).filter((name:string)=>/^(plan|implementation|review|ui-scenario|ui-acceptance|ui-protocol)-\d+\.jsonl$/.test(name));
    const errors=names.flatMap((name:string)=>fs.readFileSync(path.join(row.root,'logs',name),'utf8').split('\n').flatMap((line:string)=>{
      try{const event=JSON.parse(line);return ['error','turn.failed'].includes(event.type)?[JSON.stringify(event)]:[];}catch{return [];}
    }));
    if(errors.some((message:string)=>/usage.limit|quota.exceeded|insufficient.quota|limit.reached/i.test(message)))interrupted=true;
  }
}
const {summarize}=await import(path.join(project,'e2e/report.ts'));
const {compareProducts}=await import(path.join(project,'e2e/comparison.ts'));
const report=summarize(rows.flatMap(row=>row.root?[row.root]:[]));
runtime.writeJson(path.join(root,'report.json'),report);
const measurement=compareProducts(report.runs.map((row:any)=>({...row,runnerElapsedMs:row.elapsedMs,elapsedMs:rows.find(trial=>trial.root===row.root)?.wallMs??null,product:row.product??'unknown'})));
const protectedAfter=observeProtected();
const contexts=rows.flatMap(row=>row.root ? runtime.AGENT.auditModels({root:row.root,workspace:path.join(row.root,'workspace'),home:path.join(row.root,'home'),env:{}}).contexts : []);
runtime.writeJson(path.join(root,'comparison.json'),{...measurement,protectedBefore,protectedAfter,protectedUnchanged:JSON.stringify(protectedBefore)===JSON.stringify(protectedAfter),contexts,actualModelsMatch:contexts.length>0&&contexts.every((context:any)=>context.model==='gpt-5.6-terra'&&context.effort==='medium'),timingScope:'driver wall from case spawn to exit; phase elapsed from actual receipts; includes failed stages',harnessSha256,requirementHashes,candidates});
save(interrupted?'interrupted':'completed');console.log(JSON.stringify({phase:'paired-completed',root,status:interrupted?'interrupted':'completed'}));
