import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRun, sandbox, execute } from './runtime';
import { resolveEgo } from './ego-tools';
import { acceptancePrompt, admitAcceptance, classifyBrowserCommand, egoCalls, readBrowserTrace, readChannelTrace, type BrowserTraceEvent, type UiAcceptanceContext } from './ui-acceptance';
import {validateUiReceipt} from './ui-gate';
import type {BrowserResponse} from './browser-channel';
import {runAcceptanceProtocol} from './acceptance-protocol';
const origin = 'http://127.0.0.1:9';
const command = (script: string) => `ego-browser nodejs -e '${script}'`;
const ctx = (run: ReturnType<typeof createRun>): UiAcceptanceContext => ({ run, caseId:'todo', attempt:0, origin, leaseId:'lease', sourceFingerprint:'sha', dataDirectory:path.join(run.home,'tmp/state'), session:'1' });
const trace = (output: string): BrowserTraceEvent[] => [
  {tool:'ego-browser',command:command(`const t=await taskSpace(1); const p=t.page("p1"); await p.goto("${origin}"); console.log(await p.snapshot());`),exitCode:0,output:origin},
  {tool:'ego-browser',command:command('const t=await taskSpace(1); const p=t.page("p1"); await p.click("button"); console.log(await p.snapshot());'),exitCode:0,output},
];
test('literal shell wrappers admit actual Ego calls, not echo or fake method text', () => {
  expect(classifyBrowserCommand(`/bin/zsh -lc "${command('const t=await taskSpace(1);')}"`)).toBe('ego-browser');
  for(const c of ['echo ego-browser nodejs -e fake','ego-browser nodejs -e x; echo fake','opencli browser s state','$(echo ego-browser) nodejs -e x']) expect(classifyBrowserCommand(c)).toBeNull();
  expect(egoCalls(command('console.log("taskSpace(1); page.click(); page.snapshot()");'))).toMatchObject({space:undefined,interaction:false,observation:false});
});
test('trace admits completed shell-wrapped commands only', () => {
  const run=createRun(process.execPath,'unit');
  try {
    const file=path.join(run.root,'logs/trace.jsonl');
    fs.writeFileSync(file,JSON.stringify({type:'item.completed',item:{type:'command_execution',command:trace('visible')[0]!.command,exit_code:0,aggregated_output:origin}}));
    expect(readBrowserTrace(file)).toHaveLength(1);
  } finally {fs.rmSync(run.root,{recursive:true,force:true});}
});
test('admission validates evidence, not hardcoded generated business operations', () => {
  const run=createRun(process.execPath,'unit');
  try {
    const proposal={browser:'ego-browser',session:'1',status:'passed',findings:[],actions:[{operation:'click',coverage:'request paragraph 2',url:origin,target:'agent-discovered',expected:'visible',observed:'visible result'}]};
    expect(admitAcceptance(proposal,ctx(run),trace('visible result'))).toMatchObject({status:'passed'});
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],operation:'Business step name'}]},ctx(run),trace('visible result'))).toThrow('operation');
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],target:''}]},ctx(run),trace('visible result'))).toThrow('target');
    expect(()=>admitAcceptance(proposal,ctx(run),trace('unrelated'))).toThrow('observation');
    expect(()=>admitAcceptance(proposal,ctx(run),trace('visible result').map(e=>({...e,command:e.command.replace('taskSpace(1)','taskSpace(2)')})))).toThrow('navigation');
    const noAction=trace('visible result').map(e=>({...e,command:e.command.replace('await p.click("button");','')}));
    expect(()=>admitAcceptance(proposal,ctx(run),noAction)).toThrow('user interaction');
    expect(admitAcceptance({...proposal,status:'failed',findings:['visible result']},ctx(run),trace('visible result'))).toMatchObject({status:'failed'});
    expect(admitAcceptance({...proposal,status:'failed',findings:['The UI reports "visible result"; this needs investigation.']},ctx(run),trace('visible result'))).toMatchObject({status:'failed'});
    expect(()=>admitAcceptance({...proposal,status:'failed',findings:['It reports "visible result" and "invented".']},ctx(run),trace('visible result'))).toThrow('not quoted');
    const escaped='"status\\\\n    text \\\\"visible result\\\\"" — failure explanation';
    expect(admitAcceptance({...proposal,status:'failed',findings:[escaped]},ctx(run),trace('status\n    text "visible result"'))).toMatchObject({status:'failed'});
    expect(admitAcceptance({...proposal,status:'failed',findings:['Semantic explanation'],findingEvidence:[{finding:'Semantic explanation',observed:'visible result'}]},ctx(run),trace('visible result'))).toMatchObject({status:'failed'});
    expect(()=>admitAcceptance({...proposal,status:'failed',findings:['Semantic explanation'],findingEvidence:[{finding:'Semantic explanation',observed:'invented'}]},ctx(run),trace('visible result'))).toThrow('not quoted');
    expect(()=>admitAcceptance({...proposal,status:'failed',findings:['made-up']},ctx(run),trace('visible result'))).toThrow('not quoted');
    expect(()=>admitAcceptance({status:'infrastructure-failed',findings:[{reason:'actual CDP timeout'}]},ctx(run),[])).toThrow('actual CDP timeout');
  } finally {fs.rmSync(run.root,{recursive:true,force:true});}
});
test('fresh agent gets full browser skill, discovery freedom and readonly boundary', () => {
  const run=createRun(process.execPath,'unit');
  try {
    const prompt=acceptancePrompt(ctx(run),path.join(run.home,'tmp/proposal.json'));
    expect(prompt).toContain('SKILL.md completely'); expect(prompt).toContain('NOT the official receipt');
    expect(prompt).toContain('does NOT specify business operations'); expect(prompt).toContain('never create, claim, finish, or replace');
    expect(prompt).toContain('Capture and print high-level action receipts');
    expect(prompt).toContain('page.events()'); expect(prompt).toContain('supply the intended text explicitly');
    expect(prompt).toContain('Serialize browser commands');
    const profile=sandbox(run,['/bin/true'],'acceptance')[2]!;
    expect(profile).toContain(resolveEgo().installRoot); expect(profile).not.toContain('/Applications/Google Chrome.app');
    expect(profile.split('(deny file-read*')[0]).not.toContain(JSON.stringify(run.workspace));
  } finally {fs.rmSync(run.root,{recursive:true,force:true});}
});
test('channel admission credits owner observations, never command parameters or failed snapshots',async()=> {
  const run=createRun(process.execPath,'unit');
  try {
    const file=path.join(run.root,'logs/native.jsonl');
    const native=(id:string,op:string,args:unknown[],result:unknown,status='ok')=>({channel:'browser-channel-v1',space:1,request:{id,op,args},response:{id,sequence:Number(id),status,result}});
    fs.writeFileSync(file,[native('1','goto',[origin],{url:origin}),native('2','fill',['input','invented'],{value:{}}),native('3','snapshot',[],{snapshot:'actual outcome'}),native('4','snapshot',[],{snapshot:'fabricated'},'error')].map(v=>JSON.stringify(v)).join('\n'));
    const trace=readChannelTrace(file);
    expect(admitAcceptance({browser:'ego-browser',session:'1',status:'passed',findings:[],actions:[{operation:'observe',target:'actual page',coverage:'actual requirement',url:origin,expected:'outcome',observed:'actual outcome'}]},ctx(run),trace)).toMatchObject({status:'passed'});
    for(const observed of ['invented','fabricated']) expect(()=>admitAcceptance({browser:'ego-browser',session:'1',status:'passed',findings:[],actions:[{coverage:'actual requirement',url:origin,observed}]},ctx(run),trace)).toThrow('observation');
    const protectedWrite=await execute({argv:sandbox(run,['/bin/sh','-c',`printf fake >> ${JSON.stringify(file)}`],'acceptance'),cwd:run.workspace,env:run.env,log:path.join(run.root,'logs/denied.log')});
    expect(protectedWrite.code).not.toBe(0);expect(fs.readFileSync(file,'utf8')).not.toContain('fake');
    const prompt=acceptancePrompt(ctx(run),'proposal.json',undefined,{client:'client.ts',connection:'connection.json'});
    expect(prompt).toContain('persistent');expect(prompt).toContain('NO predefined business');expect(prompt).toContain('do not launch Ego directly');
    expect(prompt).toContain('operation must be one of: click, fill, select, dialog, observe');
    const bypass=await execute({argv:sandbox(run,[resolveEgo().executable,'nodejs','-e','console.log("forbidden remote Node")'],'acceptance'),cwd:run.workspace,env:run.env,log:path.join(run.root,'logs/bypass.log')});
    expect(bypass.code).not.toBe(0);
    const privateConfig=path.join(run.root,'bin/browser-private-test.json');fs.writeFileSync(privateConfig,'owner-only-test');
    const secretRead=await execute({argv:sandbox(run,['/bin/cat',privateConfig],'acceptance'),cwd:run.workspace,env:run.env,log:path.join(run.root,'logs/private-read.log')});
    expect(secretRead.code).not.toBe(0);expect(fs.readFileSync(path.join(run.root,'logs/private-read.log'),'utf8')).not.toContain('owner-only-test');
  }finally{fs.rmSync(run.root,{recursive:true,force:true});}
});
test('native references roundtrip through admission and controller with scope enforcement',async()=>{
  const run=createRun(process.execPath,'unit');
  try{
    const context=ctx(run);
    context.scenario={prepared:true,log:'protected-setup-log',sourceDigests:{},plan:{setup:[],requirements:[
      {id:'ui-1',channel:'ui',source:'request.md',quote:'User interface',reason:'explicit UI'},
      {id:'api-1',channel:'api',source:'acceptance.md',quote:'API operation',reason:'not a UI button'},
      {id:'docs-1',channel:'artifact',source:'request.md',quote:'Documentation',reason:'Independent delivery review'},
    ]}};
    const native=(id:string,op:string,args:unknown[],result:BrowserResponse['result']):BrowserTraceEvent=>({tool:'ego-browser',command:'',exitCode:0,output:result?.snapshot??result?.url??'',native:{space:1,request:{id,op,args},response:{id,sequence:1,status:'ok',result}}});
    const evidence=[native('nav','goto',[origin],{url:origin}),native('click','click',['AI-discovered'],{url:origin}),native('obs','snapshot',[{scope:'full_page'}],{url:origin,snapshot:'actual outcome'})];
    const proposal={browser:'ego-browser',session:'1',status:'passed',findings:[],actions:[{operation:'observe',coverage:'ui-1',url:origin,target:'real state',expected:'outcome',observationId:'obs'}]};
    const receipt=admitAcceptance(proposal,context,evidence);
    expect(()=>validateUiReceipt(receipt,context)).not.toThrow();expect(receipt).toMatchObject({scopePlan:context.scenario.plan});
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],coverage:'ui-1: unchanged business description'}]},context,evidence)).not.toThrow();
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],coverage:'ui-1 — unchanged business description'}]},context,evidence)).not.toThrow();
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],coverage:'api-1: API-only guarantee'}]},context,evidence)).toThrow('non-UI');
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],coverage:'api-1: API-only guarantee',requirementId:'ui-1'}]},context,evidence)).toThrow('contradicts frozen coverage');
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],coverage:'unchanged prose',requirementId:'ui-1'}]},context,evidence)).not.toThrow();
    let formatProposal:any={...proposal,actions:[{...proposal.actions[0],coverage:'unchanged prose'}]};
    let repairs=0;
    const formatted=await runAcceptanceProtocol({observe:()=>evidence,readProposal:()=>formatProposal,admit:(p,t)=>admitAcceptance(p,context,t),record:()=>{},repair:async()=>{
      repairs++;formatProposal={...formatProposal,actions:[{...formatProposal.actions[0],requirementId:'ui-1'}]};
    }});
    expect(repairs).toBe(1);expect((formatted.proposal as any).actions[0].coverage).toBe('unchanged prose');
    expect(()=>validateUiReceipt(admitAcceptance(formatted.proposal,context,evidence),context)).not.toThrow();
    const multipleContext={...context,scenario:{...context.scenario,plan:{...context.scenario.plan,requirements:[...context.scenario.plan.requirements,{...context.scenario.plan.requirements[0]!,id:'ui-2'}]}}};
    for (const action of [{...proposal.actions[0],coverage:'ui-1; ui-2 — same observed business claim'},{...proposal.actions[0],coverage:'Same observed business claim',requirementIds:['ui-1','ui-2']}]) {
      expect(()=>validateUiReceipt(admitAcceptance({...proposal,actions:[action]},multipleContext,evidence),multipleContext)).not.toThrow();
    }
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],coverage:'Same observed claim',requirementIds:['ui-1','api-1']}]},context,evidence)).toThrow('non-UI');
    for(const actions of [[],[...proposal.actions,{...proposal.actions[0],coverage:'docs-1'}]]) {
      try { admitAcceptance({...proposal,actions},context,evidence);throw Error('Invalid scope was admitted'); }
      catch(error) { expect(error).toMatchObject({failureClass:'scope-unresolved'}); }
    }
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],observationId:'click'}]},context,evidence)).toThrow('observationId');
    expect(()=>admitAcceptance({...proposal,actions:[{...proposal.actions[0],observed:'invented'}]},context,evidence)).toThrow('Referenced excerpt');
    const failed={...proposal,status:'failed',findings:['Missing control'],findingEvidence:[{finding:'Missing control',requirementId:'api-1',observationId:'obs',absence:true}]};
    expect(()=>admitAcceptance(failed,context,evidence)).toThrow('API-only');
    expect(()=>admitAcceptance({...failed,findingEvidence:[{...failed.findingEvidence[0],requirementId:'docs-1'}]},context,evidence)).toThrow('API-only');
    const business=admitAcceptance({...failed,findingEvidence:[{...failed.findingEvidence[0],requirementId:'ui-1'}]},context,evidence);
    expect(()=>validateUiReceipt(business,context)).toThrow('Browser acceptance failed');
    const viewport=evidence.map(e=>e.native?.request.id==='obs'?{...e,native:{...e.native,request:{...e.native.request,args:[{scope:'only_within_viewport'}]}}}:e);
    expect(()=>admitAcceptance({...failed,findingEvidence:[{...failed.findingEvidence[0],requirementId:'ui-1'}]},context,viewport)).toThrow('full_page');
    expect(()=>admitAcceptance({...failed,findingEvidence:[{...failed.findingEvidence[0],requirementId:'ui-1',observationId:'setup-response'}]},context,evidence)).toThrow('observationId');
  }finally{fs.rmSync(run.root,{recursive:true,force:true});}
});
test('missing FAIL references get one format repair and remain a controller business failure',async()=>{
  const run=createRun(process.execPath,'unit');
  try{
    const context=ctx(run);
    context.scenario={prepared:true,log:'owner-log',sourceDigests:{},plan:{setup:[],requirements:[{id:'ui',channel:'ui',source:'request.md',quote:'Required outcome',reason:'explicit UI'}]}};
    const native:BrowserTraceEvent={tool:'ego-browser',command:'',exitCode:0,output:'actual failed outcome',native:{space:1,request:{id:'obs',op:'snapshot',args:[{scope:'full_page'}]},response:{id:'obs',sequence:2,status:'ok',result:{url:origin,snapshot:'actual failed outcome'}}}};
    const observations=[trace('')[0]!,native];
    let proposal:any={browser:'ego-browser',session:'1',status:'failed',findings:['Actual required behavior did not occur']};
    let repairs=0;
    const result=await runAcceptanceProtocol({observe:()=>observations,readProposal:()=>proposal,admit:(p,t)=>admitAcceptance(p,context,t),record:()=>{},repair:async()=>{
      repairs++;proposal={...proposal,findingEvidence:[{finding:proposal.findings[0],requirementId:'ui',observationId:'obs'}]};
    }});
    expect(repairs).toBe(1);expect(result.proposal).toMatchObject({status:'failed',findings:['Actual required behavior did not occur']});
    const receipt=admitAcceptance(result.proposal,context,result.trace);
    expect(()=>validateUiReceipt(receipt,context)).toThrow('Browser acceptance failed');
  }finally{fs.rmSync(run.root,{recursive:true,force:true});}
});
