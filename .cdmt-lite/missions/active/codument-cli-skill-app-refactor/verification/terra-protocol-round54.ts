import * as fs from 'node:fs';
import * as path from 'node:path';
import {spawn} from 'node:child_process';

// Read-only supervision only, never a generated application's business oracle.
const project=fs.realpathSync(process.argv[2]!);
if(!/^\/(private\/)?tmp\/depa-codument-verification-[^/]+\/depa-codument\/project$/.test(project))throw Error('Isolated harness required');
const runtime=await import(path.join(project,'e2e/runtime.ts'));
if(runtime.AGENT.id!=='codex' || runtime.MODEL!=='gpt-5.6-terra' || runtime.EFFORT!=='medium')throw Error('Terra/medium required');
const root=fs.realpathSync(fs.mkdtempSync('/tmp/depa-codument-e2e-batch-'));
const availableCases=[
  {caseId:'todo',source:'/private/tmp/depa-codument-e2e-cq3qL4'},
  {caseId:'blog',source:'/private/tmp/depa-codument-e2e-DC1eur'},
  {caseId:'ecommerce',source:'/private/tmp/depa-codument-e2e-2L0ERN'},
];
const selected=process.argv[3]?.split(',')??availableCases.map(c=>c.caseId);
if(new Set(selected).size!==selected.length || selected.some(id=>!availableCases.some(c=>c.caseId===id)))throw Error('Unknown or duplicated read-only case');
const cases=availableCases.filter(c=>selected.includes(c.caseId));
const hashes=Object.fromEntries(cases.map(c=>[c.caseId,runtime.sha(path.join(c.source,'bin/depa-codument'))]));
const harnessSha256=runtime.treeHash(path.join(project,'e2e'));
const rows:any[]=[];
let interrupted=false;
const save=(status:string)=>runtime.writeJson(path.join(root,'suite-status.json'),{round:54,status,pid:process.pid,project,harnessSha256,model:runtime.MODEL,effort:runtime.EFFORT,rows,updatedAt:new Date().toISOString()});
save('running');console.log(JSON.stringify({phase:'readonly-batch',root,pid:process.pid}));
for(const c of cases){
  if(interrupted)break;
  if(runtime.treeHash(path.join(project,'e2e'))!==harnessSha256)throw Error('Frozen harness drift');
  const candidate=path.join(c.source,'bin/depa-codument');
  if(runtime.sha(candidate)!==hashes[c.caseId])throw Error('Frozen candidate drift');
  const row:any={...c,candidate,candidateSha256:hashes[c.caseId],state:'running',log:path.join(root,`${c.caseId}.log`)};rows.push(row);
  const fd=fs.openSync(row.log,'wx',0o600);
  const child=spawn(process.execPath,[path.join(project,'e2e/run.ts'),'ui-reverify',c.source,`--bin=${candidate}`],{cwd:project,env:{...process.env,E2E_AGENT:'codex'},detached:true,stdio:['ignore','pipe',fd]});
  row.pid=child.pid;save('running');let pending='';
  const interrupt=()=>{interrupted=true;save('interrupted');try{process.kill(-child.pid!,'SIGTERM');}catch{/* already ended */}};
  process.once('SIGTERM',interrupt);process.once('SIGINT',interrupt);
  child.stdout!.on('data',bytes=>{fs.writeSync(fd,bytes);pending+=bytes.toString();let end:number;
    while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);
      try{const event=JSON.parse(line);if(event.phase==='awaiting-ui'){row.root=event.root;save('running');console.log(JSON.stringify({phase:'readonly-case',caseId:c.caseId,root:row.root}));}}catch{/* formatted JSON */}
    }
  });
  row.exitCode=await new Promise<number|null>((resolve,reject)=>{child.once('close',resolve);child.once('error',reject);}).finally(()=>{fs.closeSync(fd);process.off('SIGTERM',interrupt);process.off('SIGINT',interrupt);});
  if(row.root && fs.existsSync(path.join(row.root,'result.json')))row.result=JSON.parse(fs.readFileSync(path.join(row.root,'result.json'),'utf8'));
  row.state=row.result?.status??'infrastructure-failed';save('running');console.log(JSON.stringify({phase:'readonly-terminal',caseId:c.caseId,root:row.root,status:row.state}));
}
const report=await import(path.join(project,'e2e/report.ts'));
runtime.writeJson(path.join(root,'report.json'),report.summarize(rows.flatMap(r=>r.root?[r.root]:[])));
save(interrupted?'interrupted':'completed');console.log(JSON.stringify({phase:'readonly-completed',root}));
