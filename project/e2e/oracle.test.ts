import { test, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { verifyBlog, verifyEcommerce } from './extended-http';
import { summarize } from './report';
import { writeJson } from './runtime';
import { resourceRoot, assertNestedSelection, trackValidationSelection, validateArchivedKnowledge, assertPromotedKnowledge, assertPromotedBehaviors, exhaustedGapReason } from './resource-oracle';
import { checkRequirements, assertFreshThread, lockRun, sourceFingerprint, isFirstPass, isExecutedTestCommand } from './integrity';
import { applicationEnvironment } from './application-state';
import { sessionUsage } from './usage';
import { createRun, sandbox, execute, setup } from './runtime';
import { verifyWorkflow, requireDeliveredImplementation, requireNoExhaustedWorkflow } from './workload';
import { validateUiReceipt } from './ui-gate';

test('empty successful HTTP stubs cannot pass either business oracle', async () => {
  const stub = async () => ({ status: 200, data: {} });
  await expect(verifyBlog(stub)).rejects.toThrow();
  await expect(verifyEcommerce(stub)).rejects.toThrow();
  expect(()=>validateUiReceipt({status:'passed',html:'<html></html>'},{caseId:'todo',attempt:0,sourceFingerprint:'sha'})).toThrow();
});

test('resume cannot redefine requirements; phases must be distinct and runner ownership exclusive', () => {
  const run = createRun('/usr/bin/true','unit');
  const source = path.join(run.root,'case'); fs.mkdirSync(source);
  for (const name of ['request.md','acceptance.md']) {
    fs.writeFileSync(path.join(source,name),'original');
    fs.writeFileSync(path.join(run.workspace,name),'original');
  }
  checkRequirements(run,source);
  for (const name of ['request.md','acceptance.md']) {
    fs.writeFileSync(path.join(run.workspace,name),'weakened');
    expect(()=>checkRequirements(run,source)).toThrow();
    fs.writeFileSync(path.join(run.workspace,name),'original');
  }
  expect(()=>assertFreshThread(undefined,[])).toThrow();
  expect(()=>assertFreshThread('same',['same'])).toThrow();
  assertFreshThread('fresh',['other']);
  const unlock = lockRun(run);
  expect(()=>lockRun(run)).toThrow();
  unlock();
  expect(isFirstPass([{attempt:1,status:'passed'}])).toBe(false);
  expect(isFirstPass([{attempt:0,status:'failed'},{attempt:1,status:'passed'}])).toBe(false);
  fs.writeFileSync(path.join(run.workspace,'.gitignore'),'dist/\n');
  fs.mkdirSync(path.join(run.workspace,'dist'));
  fs.writeFileSync(path.join(run.workspace,'dist/entry.js'),'old');
  const before = sourceFingerprint(run);
  fs.writeFileSync(path.join(run.workspace,'dist/entry.js'),'drift');
  expect(sourceFingerprint(run)).not.toBe(before);
});

test('per-response usage includes interrupted and child sessions without cumulative double counting', () => {
  const run = createRun('/usr/bin/true','unit');
  const sessions = path.join(run.home,'.codex/sessions'); fs.mkdirSync(sessions);
  const event = (id: string,n: number) => JSON.stringify({type:'token_usage_record',payload:{response_id:id,usage:{input_tokens:n,cached_input_tokens:2,output_tokens:1},thread_token_usage:{input_tokens:99999}}});
  fs.writeFileSync(path.join(sessions,'parent.jsonl'),event('one',10)+'\n'+event('two',20));
  fs.writeFileSync(path.join(sessions,'child.jsonl'),event('one',10)+'\n'+event('child',30));
  const result = sessionUsage(run.root);
  expect(result.usage).toEqual({input:60,cached:6,output:3});
  expect(result.sessionCount).toBe(2);
  expect(result.responseCount).toBe(3);
  writeJson(path.join(run.root,'result.json'),{caseId:'todo',status:'passed',resumed:true,firstPass:false});
  const report = summarize([run.root]);
  expect(report.denominator).toBe(1);
  expect(report.firstPassRate).toBe(0);
  expect(report.correctedPassRate).toBe(1);
  writeJson(path.join(run.root,'classification.json'),{status:'passed'});
  expect(()=>summarize([run.root])).toThrow();
});

test('observed Codex 0.150.1 usage schema remains readable (identifiers redacted)', () => {
  const run = createRun('/usr/bin/true','unit');
  const sessions = path.join(run.home,'.codex/sessions'); fs.mkdirSync(sessions);
  fs.copyFileSync(path.join(import.meta.dir,'fixtures/codex-usage-sanitized.jsonl'),path.join(sessions,'sample.jsonl'));
  expect(sessionUsage(run.root).usage).toEqual({input:14676,cached:11008,output:233});
});

test('setup and validation candidate processes cannot write outside run or read personal home', async () => {
  const run = createRun('/usr/bin/true','unit');
  const protectedFile = path.join(run.root,'protected'); fs.writeFileSync(protectedFile,'unchanged');
  for (const [i,mode] of (['setup',false,true] as const).entries()) {
    const result = await execute({argv:sandbox(run,['/usr/bin/touch',protectedFile],mode),cwd:run.workspace,env:run.env,log:path.join(run.root,`logs/denied-${i}.log`)});
    expect(result.code).not.toBe(0);
    expect(fs.readFileSync(protectedFile,'utf8')).toBe('unchanged');
  }
  const result = await execute({argv:sandbox(run,['/bin/ls',path.join((await import('node:os')).homedir(),'.codex')],true),cwd:run.workspace,env:run.env,log:path.join(run.root,'logs/denied-read.log')});
  expect(result.code).not.toBe(0);
  run.bin=path.join(run.root,'bin/write-attempt');
  fs.writeFileSync(run.bin,`#!/bin/sh\nprintf changed > ${JSON.stringify(protectedFile)}\nexit $?\n`,{mode:0o755});
  await expect(setup(run)).rejects.toThrow('Setup init failed');
  await expect(verifyWorkflow(run,'plan',0)).rejects.toThrow();
  expect(fs.readFileSync(protectedFile,'utf8')).toBe('unchanged');
}, 30_000); // Several real macOS process launches; the 5s unit default flakes under the full suite.
test('text mentioning completed and links cannot substitute for actual root state', () => {
  const source='<Track #test envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 { status="new" description="status = completed" } (<TaskSpace #space (<SubNodes []>)>)>';
  expect(resourceRoot(source,'track').attributes?.status).toBe('new');
  expect(()=>assertNestedSelection([],[])).toThrow();
});
test('archive validation selects its exact lifecycle path without confusing directory and identity', () => {
  const source='<Track #example envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 { status="completed" } (<TaskSpace #space (<SubNodes []>)>)>';
  expect(trackValidationSelection('codument/tracks/active/example',source).selector).toBe('example');
  const selected = trackValidationSelection('codument/tracks/archived/2026-09/2026-09-12-example',source);
  expect(selected.id).toBe('example');
  expect(selected.archived).toBe(true);
  expect(selected.selector).toBe('archived/2026-09/2026-09-12-example');
  expect(()=>trackValidationSelection('codument/tracks/active/other',source)).toThrow();
  expect(()=>trackValidationSelection('codument/backup/example',source)).toThrow();
  expect(()=>validateArchivedKnowledge(new Map(),'modeling')).toThrow();
  expect(()=>validateArchivedKnowledge(new Map([['domain/example.xnl','not XNL']]),'modeling')).toThrow();
});
test('archive promotion cannot be satisfied by unrelated or stale canonical facts', () => {
  const envelope='envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
  const knowledge=`<EngineeringRegistry #owner ${envelope} {} [<overview #global.overview.example.main {kind="overview"} (<desc ?>Example</?><mental-model ?>Actual structure</?>)>]>`;
  const deltas=new Map([['global/overview/example.xnl',knowledge]]);
  expect(()=>assertPromotedKnowledge(deltas,new Map(),'engineering')).toThrow();
  expect(()=>assertPromotedKnowledge(deltas,new Map([['global/overview/other.xnl',knowledge.replaceAll('example','other')]]),'engineering')).toThrow();
  expect(()=>assertPromotedKnowledge(deltas,new Map([['global/overview/example.xnl',knowledge.replace('Actual structure','Stale structure')]]),'engineering')).toThrow();
  assertPromotedKnowledge(deltas,deltas,'engineering');
  const requirement='<Requirement #R1 (<Statement ?>Required behavior.</?>)>';
  const patch=`<BehaviorPatch #patch ${envelope} {capability="example"} (<Mutations [<Upsert {selector="behavior://example/requirements/R1"} (${requirement})>]>)>`;
  const patches=new Map([['example.xnl',patch]]);
  const behavior=`<Behavior #example ${envelope} (<Requirements [${requirement}]>)>`;
  expect(()=>assertPromotedBehaviors(patches,new Map([['other.xnl',behavior.replace('#example','#other')]]))).toThrow();
  expect(()=>assertPromotedBehaviors(patches,new Map([['example.xnl',behavior.replace('Required behavior.','Stale behavior.')]]))).toThrow();
  assertPromotedBehaviors(patches,new Map([['example.xnl',behavior]]));
});

test('multiple valid sequential archives are unsupported by the snapshot oracle, not called bad business data', async () => {
  const run=createRun('/usr/bin/true','unit');
  run.bin=path.join(run.root,'bin/list-fixture');
  fs.writeFileSync(run.bin,'#!/bin/sh\necho "[]"\n',{mode:0o755});
  for (const id of ['first','second']) {
    const directory=path.join(run.workspace,'codument/tracks/archived',`2026-09-12-${id}`);
    fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'track.xnl'),`<Track #${id} envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {status="completed"} (<TaskSpace #space (<SubNodes []>)>)>`);
  }
  await expect(verifyWorkflow(run,'implementation',0)).rejects.toThrow('Harness unsupported: multiple archived deliveries');
});

test('mutable business facts are outside source, while source drift and trivial reviewer commands fail', () => {
  const run=createRun('/usr/bin/true','unit');
  const before=sourceFingerprint(run);
  const http=applicationEnvironment(run,'http-0'), ui=applicationEnvironment(run,'ui-0');
  expect(http.DATA_FILE).not.toBe(ui.DATA_FILE);
  expect(applicationEnvironment(run,'agent-implementation-0').DATA_FILE).not.toBe(applicationEnvironment(run,'agent-review-0').DATA_FILE);
  expect(()=>validateUiReceipt({caseId:'todo',attempt:0,sourceFingerprint:'sha',dataDirectory:'/wrong'},{caseId:'todo',attempt:0,sourceFingerprint:'sha',dataDirectory:ui.E2E_DATA_DIR})).toThrow('runtime state directory mismatch');
  fs.writeFileSync(http.DATA_FILE!,'{"orders":[]}');
  expect(sourceFingerprint(run)).toBe(before);
  expect(()=>applicationEnvironment(run,'../escape')).toThrow();
  fs.writeFileSync(path.join(run.workspace,'app.ts'),'changed by server');
  expect(sourceFingerprint(run)).not.toBe(before);
  for (const command of ['curl --version',"rg 'fetch\\(' src","echo 'bun test'","rg 'bun test' package.json"]) expect(isExecutedTestCommand(command)).toBe(false);
  for (const command of ['bun test','npm test','node --test',"/bin/zsh -lc 'cd app && bun run test'",'/tmp/venv/bin/python -m pytest -q']) expect(isExecutedTestCommand(command)).toBe(true);
});

test('rates exclude infrastructure explicitly and never turn unknown usage into zero', () => {
  const make = (result: unknown) => {
    const root = fs.realpathSync(fs.mkdtempSync('/tmp/depa-codument-e2e-'));
    fs.mkdirSync(path.join(root,'logs'));
    writeJson(path.join(root,'run-owner.json'),{test:true});
    writeJson(path.join(root,'result.json'), result);
    return root;
  };
  const result = summarize([
    make({caseId:'todo', status:'passed',firstPass:true}),
    make({caseId:'todo', status:'passed',firstPass:false}),
    make({caseId:'todo', status:'failed',firstPass:false}),
    make({caseId:'todo', status:'infrastructure-failed'}),
  ]);
  expect(result.denominator).toBe(3);
  expect(result.excludedInfrastructureOrIncomplete).toBe(1);
  expect(result.firstPassRate).toBe(1/3);
  expect(result.correctedPassRate).toBe(2/3);
  expect(result.runs.every(r=>r.usage===null && r.moneyCost===null)).toBe(true);
});

test('configured workflow blocks terminate delivery and remain failures in business-rate accounting', () => {
  expect(()=>requireDeliveredImplementation({status:'blocked',reason:'GapLoop max_rounds exhausted; on_exhausted=block'})).toThrow('GapLoop max_rounds exhausted');
  expect(()=>requireDeliveredImplementation({status:'delivered'})).toThrow();
  requireDeliveredImplementation({status:'delivered',reason:'All delivery gates passed'});
  const run=createRun('/usr/bin/true','unit');
  writeJson(path.join(run.root,'result.json'),{caseId:'ecommerce',status:'infrastructure-failed',firstPass:false});
  writeJson(path.join(run.root,'terminal-policy.json'),{kind:'configured-workflow-block',reason:'Controller stopped an invalid outer retry'});
  const report=summarize([run.root]);
  expect(report.runs[0]!.rawStatus).toBe('infrastructure-failed');
  expect(report.runs[0]!.status).toBe('blocked');
  expect(report.denominator).toBe(1);
  expect(report.firstPassRate).toBe(0);
  expect(report.correctedPassRate).toBe(0);
  const track=path.join(run.workspace,'codument/tracks/active/example');
  fs.mkdirSync(path.join(track,'reports'),{recursive:true});
  fs.writeFileSync(path.join(track,'track.xnl'),'<Track #example envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {status="in_progress" gap_round=5} (<Hook {on="phase:after"} (<GapLoop {max_rounds=5 on_exhausted="block"}> )>)>');
  const reportFile=path.join(track,'reports/gap-track-5.md');
  fs.writeFileSync(reportFile,'## Verdict\n\n`FIX_APPLIED` — last round repaired code.');
  requireDeliveredImplementation({status:'delivered',reason:'Model incorrectly claims success'});
  expect(()=>requireNoExhaustedWorkflow(run)).toThrow('No automatic outer retry');
  fs.writeFileSync(reportFile,'## Verdict\n\n`NO_GAP` — terminal review passed.');
  requireNoExhaustedWorkflow(run);
  fs.writeFileSync(reportFile,'Unstructured prose mentioning NO_GAP is not a terminal verdict.');
  expect(()=>requireNoExhaustedWorkflow(run)).toThrow('missing/ambiguous');
  const scopeSource='<Track #example envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {status="in_progress" gap_round=5} (<Hooks [<Hook #one (<GapLoop {max_rounds=5 on_exhausted="block"}>)><Hook #two (<GapLoop {max_rounds=5 on_exhausted="block"}>)>]>)>';
  expect(exhaustedGapReason(scopeSource,'track',['## Verdict\nNO_GAP','## Verdict\nNO_GAP'])).toBeUndefined();
  expect(exhaustedGapReason(scopeSource,'track',['## Verdict\nNO_GAP','## Verdict\nFIX_APPLIED'])).toContain('Harness unsupported:');
  const probe=createRun('/usr/bin/true','model-probe');
  writeJson(path.join(probe.root,'result.json'),{status:'passed',firstPass:true});
  expect(summarize([probe.root]).denominator).toBe(0);
});
