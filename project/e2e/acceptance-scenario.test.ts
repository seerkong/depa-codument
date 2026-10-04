import {expect,test} from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {createRun,execute,sandbox} from './runtime';
import {dispatchScenario,scenarioState,startScenario,resolveSetupUrl,validateAcceptancePlan,type AcceptancePlan} from './acceptance-scenario';
const origin='http://127.0.0.1:9';
const sources={'request.md':'Provide a functional user interface.','acceptance.md':'POST /api/fixtures is local test/admin setup. GET /api/fixtures/:id reads a fixture.'};
const plan:AcceptancePlan={requirements:[
  {id:'ui',channel:'ui',source:'request.md',quote:sources['request.md'],reason:'Explicit UI scope'},
  {id:'api',channel:'api',source:'acceptance.md',quote:sources['acceptance.md'],reason:'Admin fixture API, not a required UI button'},
],setup:[{id:'seed',requirementId:'api',method:'POST',pathTemplate:'/api/fixtures',source:'acceptance.md',quote:sources['acceptance.md'],reason:'Arrange runtime preconditions only'}]};
const fixture=()=>({origin,sources,record:(_v:unknown)=>{},http:async(_u:string,_i:RequestInit)=>({status:201,body:'{"id":"random-fixture"}'})});
test('scope/capabilities are derived from original source, not a business oracle',()=>{
  expect(()=>validateAcceptancePlan(plan,sources)).not.toThrow();
  for(const invalid of [
    {...plan,requirements:[{...plan.requirements[0],quote:'invented'}]},
    {...plan,setup:[{...plan.setup[0],pathTemplate:'/undeclared'}]},
    {...plan,setup:[{...plan.setup[0],method:'TRACE'}]},
    {...plan,setup:[{...plan.setup[0],requirementId:'foreign'}]},
  ])expect(()=>validateAcceptancePlan(invalid,sources)).toThrow();
});
test('route admission rejects origin escape, encoded traversal and unmatched paths',()=>{
  expect(resolveSetupUrl(origin,'/api/fixtures/:id','/api/fixtures/abc-1')).toBe(origin+'/api/fixtures/abc-1');
  for(const requested of ['//outside.invalid/api/fixtures/a','https://outside.invalid','/api/fixtures/../secret','/api/fixtures/%2fsecret','/api/fixtures/a?redirect=x','/different/a'])expect(()=>resolveSetupUrl(origin,'/api/fixtures/:id',requested)).toThrow();
});
test('serialized preparation deduplicates writes, seals capability and never reports UI PASS',async()=>{
  const state=scenarioState();let calls=0;const records:unknown[]=[];
  const runtime={...fixture(),record:(v:unknown)=>records.push(v),http:async()=>{calls++;await Bun.sleep(5);return {status:201,body:'seeded'};}};
  expect(await dispatchScenario(runtime,state,{id:'p',op:'plan',plan})).toMatchObject({status:'ok'});
  const command={id:'s',op:'prepare',setupId:'seed',path:'/api/fixtures',body:{name:'AI-chosen'}};
  const responses=await Promise.all([dispatchScenario(runtime,state,command),dispatchScenario(runtime,state,command)]);
  expect(calls).toBe(1);expect(responses[0]).toEqual(responses[1]);expect(responses[0]).toMatchObject({kind:'preparation-only'});
  expect(await dispatchScenario(runtime,state,{...command,path:'/different'})).toMatchObject({status:'error'});
  expect(await dispatchScenario(runtime,state,{id:'rewrite',op:'plan',plan})).toMatchObject({status:'error'});
  expect(await dispatchScenario(runtime,state,{id:'done',op:'seal'})).toMatchObject({prepared:true});
  expect(await dispatchScenario(runtime,state,{...command,id:'after'})).toMatchObject({status:'error'});expect(calls).toBe(1);expect(records.length).toBe(5);
});
test('non-2xx cannot seal and unknown setup transport effects prohibit replay',async()=>{
  for(const throwing of [false,true]){
    const state=scenarioState();let calls=0;
    const runtime={...fixture(),http:async()=>{calls++;if(throwing)throw Error('deadline');return {status:409,body:'not prepared'};}};
    await dispatchScenario(runtime,state,{id:'p',op:'plan',plan});
    await dispatchScenario(runtime,state,{id:'s',op:'prepare',setupId:'seed',path:'/api/fixtures'});
    expect(await dispatchScenario(runtime,state,{id:'done',op:'seal'})).toMatchObject({status:'error'});
    if(throwing){await dispatchScenario(runtime,state,{id:'retry',op:'prepare',setupId:'seed',path:'/api/fixtures'});expect(calls).toBe(1);}
  }
});
test('real preparation owner writes isolated state only and releases its HTTP capability',async()=>{
  const run=createRun(process.execPath,'scenario-unit');
  for(const [name,body] of Object.entries(sources))fs.writeFileSync(path.join(run.workspace,name),body);
  const marker=path.join(run.home,'tmp','fixture.json');
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:async(req)=>{fs.writeFileSync(marker,await req.text());return Response.json({id:'fixture'},{status:201});}});
  const owner=startScenario(run,`http://127.0.0.1:${server.port}`,'unit');
  const connection=JSON.parse(fs.readFileSync(owner.connection,'utf8'));
  const command=async(value:unknown)=>{const r=await fetch(connection.endpoint+'/command',{method:'POST',headers:{authorization:`Bearer ${connection.token}`},body:JSON.stringify(value)});return r.json();};
  try{
    expect((await fetch(connection.endpoint+'/command',{method:'POST'})).status).toBe(403);
    expect(await command({id:'p',op:'plan',plan})).toMatchObject({status:'ok'});
    const requestFile=path.join(run.home,'tmp','quoted-request.json');
    fs.writeFileSync(requestFile,JSON.stringify({id:'quoted',op:'prepare',setupId:'seed',path:'/api/fixtures',body:{name:'apostrophe \' and `backtick`; no shell execution'}}));
    const invocation=await execute({argv:sandbox(run,[process.execPath,owner.client,owner.connection,'@'+requestFile],'acceptance'),cwd:run.workspace,env:run.env,log:path.join(run.root,'logs/quoted.json')});
    expect(invocation.code).toBe(0);expect(JSON.parse(fs.readFileSync(marker,'utf8')).name).toContain('`backtick`');
    expect(await command({id:'w',op:'prepare',setupId:'seed',path:'/api/fixtures',body:{name:'test-data'}})).toMatchObject({kind:'preparation-only'});
    expect(JSON.parse(fs.readFileSync(marker,'utf8'))).toEqual({name:'test-data'});
    expect(await command({id:'done',op:'seal'})).toMatchObject({prepared:true});
    expect(owner.receipt().prepared).toBe(true);
    expect(fs.readFileSync(path.join(run.workspace,'request.md'),'utf8')).toBe(sources['request.md']);
    owner.close();
    await expect(fetch(connection.endpoint+'/command')).rejects.toThrow();
  }finally{owner.close();server.stop(true);fs.rmSync(run.root,{recursive:true,force:true});}
});
test('artifact scope is retained separately and is not a browser requirement',()=>{
  const artifactPlan={...plan,requirements:[...plan.requirements,{id:'delivery-docs',channel:'artifact',source:'request.md',quote:sources['request.md'],reason:'Checked by independent delivery review'}]};
  expect(()=>validateAcceptancePlan(artifactPlan,sources)).not.toThrow();
});
test('source admission identifies the exact entry and allows a corrected plan before freeze',async()=>{
  const state=scenarioState();
  const invalid={...plan,requirements:[...plan.requirements,{id:'quoted-entry',channel:'ui',source:'request.md',quote:'Provide functional user interface.',reason:'same meaning, not exact source'}]};
  expect(await dispatchScenario(fixture(),state,{id:'invalid-plan',op:'plan',plan:invalid})).toMatchObject({status:'error',error:expect.stringContaining('Requirement quoted-entry')});
  expect(state.plan).toBeUndefined();
  expect(await dispatchScenario(fixture(),state,{id:'corrected-plan',op:'plan',plan})).toMatchObject({status:'ok'});
  expect(state.plan).toEqual(plan);
});
