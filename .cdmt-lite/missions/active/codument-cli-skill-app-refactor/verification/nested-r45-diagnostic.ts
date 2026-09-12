// Supplemental read-only-source diagnostic, NOT a fourth E2E attempt or PASS receipt.
// The frozen run failed because descriptors used argv, not the runner's command key.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { loadRun, sandbox } from '/private/tmp/depa-codument-verification-AUuuts/depa-codument/project/e2e/runtime';
import { sourceFingerprint } from '/private/tmp/depa-codument-verification-AUuuts/depa-codument/project/e2e/integrity';
import { applicationEnvironment } from '/private/tmp/depa-codument-verification-AUuuts/depa-codument/project/e2e/application-state';

const root='/private/tmp/depa-codument-e2e-XiBVUg';
const run=loadRun(root,'/private/tmp/depa-codument-verification-AUuuts/depa-codument-candidate-r3','nested-mission-agent');
const before=sourceFingerprint(run);
const processes: {pid?:number;fd:number}[]=[];
const checks:string[]=[];
async function start(name:string, extra:NodeJS.ProcessEnv={}) {
  const cwd=path.join(run.workspace,name);
  const descriptor=JSON.parse(fs.readFileSync(path.join(cwd,'e2e-server.json'),'utf8'));
  assert.ok(!descriptor.command && Array.isArray(descriptor.argv));
  assert.ok(descriptor.argv.every((x:unknown)=>typeof x==='string'));
  const probe=Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response('')});
  const port=probe.port!;probe.stop(true);
  const fd=fs.openSync(path.join(root,`logs/diagnostic-${name}-server.log`),'wx',0o600);
  const argv=sandbox(run,descriptor.argv);
  const child=spawn(argv[0]!,argv.slice(1),{cwd,env:{...applicationEnvironment(run,`diagnostic-${name}`),...extra,PORT:String(port)},detached:true,stdio:['ignore',fd,fd]});
  processes.push({pid:child.pid,fd});
  let launchError:Error|undefined;child.on('error',error=>{launchError=error;});
  const url=`http://127.0.0.1:${port}`;
  async function request(method:string,route:string,body?:unknown){
    const response=await fetch(url+route,{method,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(3000)});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
    return {status:response.status,data};
  }
  let ready=false;
  for(let i=0;i<100;i++){
    if(launchError)throw launchError;if(child.exitCode!==null)throw new Error(`${name} exited`);
    try{ready=(await request('GET','/health')).status===200;}catch{/* startup */}
    if(ready)break;await Bun.sleep(100);
  }
  assert.ok(ready,`${name} health`);return{url,request};
}
let error:string|undefined;
try{
  const inventory=await start('inventory-repo');const main=await start('main-repo',{INVENTORY_URL:inventory.url});
  const sku=randomUUID(),id=randomUUID(),price=100+Math.floor(Math.random()*9999);
  assert.equal((await inventory.request('POST','/stock',{sku,quantity:5})).status,201);
  const order=await main.request('POST','/orders',{id,items:[{sku,quantity:2,priceCents:price}]});
  assert.equal(order.status,201);assert.equal(order.data.totalCents,price*2);
  assert.equal((await inventory.request('GET',`/stock/${sku}`)).data.reserved,2);checks.push('live cross-repository reservation');
  assert.equal((await main.request('POST','/orders',{id:randomUUID(),items:[{sku,quantity:4,priceCents:price}]})).status,409);checks.push('insufficient stock rejected');
  for(let i=0;i<2;i++)assert.equal((await main.request('POST',`/orders/${id}/pay`,{})).status,200);
  const paid=(await inventory.request('GET',`/stock/${sku}`)).data;assert.equal(paid.quantity,3);assert.equal(paid.reserved,0);checks.push('duplicate payment deducts once');
  assert.equal((await main.request('POST',`/orders/${id}/cancel`,{})).status,409);
  const cancelled=randomUUID();assert.equal((await main.request('POST','/orders',{id:cancelled,items:[{sku,quantity:1,priceCents:price}]})).status,201);
  assert.equal((await main.request('POST',`/orders/${cancelled}/cancel`,{})).status,200);
  const final=(await inventory.request('GET',`/stock/${sku}`)).data;assert.equal(final.quantity,3);assert.equal(final.reserved,0);checks.push('pending cancellation releases; paid cancellation rejected');
}catch(cause){error=String(cause);}
finally{for(const process of processes){if(process.pid)try{globalThis.process.kill(-process.pid,'SIGKILL');}catch{/* exited */}fs.closeSync(process.fd);}}
const after=sourceFingerprint(run);
const receipt={kind:'supplemental-descriptor-adaptation-diagnostic',changes:'read argv only in controller; no descriptor/source edits',formalResultUnchanged:true,notAcceptancePass:true,checks,error:error??null,sourceUnchanged:before===after,sourceFingerprint:after};
fs.writeFileSync(path.join(root,'descriptor-diagnostic.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify(receipt,null,2));
if(error||before!==after)process.exitCode=1;
