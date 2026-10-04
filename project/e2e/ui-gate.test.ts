process.env.E2E_EGO_SPACE_ID = '1';
import { expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRun, sandbox } from './runtime';
import { sourceFingerprint } from './integrity';
import { awaitUiGate, BrowserInfrastructureFailure, createUiReverification, requestUiGate, serveUi, submitUiReceipt, validateUiReceipt } from './ui-gate';

const actions = (origin: string) => [
  ['click', 'authentication'], ['fill', 'business-create'], ['dialog', 'business-update'], ['select', 'business-query'], ['observe', 'literal-input'],
].map(([operation, coverage]) => ({ operation, coverage, url: origin, target: `${coverage}-control`, expected: 'visible', observed: 'visible result' }));

test('controller infrastructure failure stops acceptance without granting PASS or classifying product findings', () => {
  const expected = {caseId:'todo',attempt:0,sourceFingerprint:'sha',dataDirectory:'/private/tmp/ui',leaseId:'lease'};
  const receipt = {...expected,browser:'ego-browser',session:'1',status:'infrastructure-failed',reason:'Browser Bridge unavailable'};
  expect(() => validateUiReceipt(receipt, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,attempt:1}, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,reason:''}, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,status:'passed',findings:[],actions:[]}, expected)).toThrow(BrowserInfrastructureFailure);
  const productFailure = {...receipt,status:'failed',findings:['Edit did not persist']};
  expect(() => validateUiReceipt(productFailure, expected)).toThrow('Browser acceptance failed');
  expect(() => validateUiReceipt(productFailure, expected)).not.toThrow(BrowserInfrastructureFailure);
});

test('Ego browser evidence is accepted when it carries a named session and full typed actions', () => {
  const expected = {caseId:'todo',attempt:0,sourceFingerprint:'sha',dataDirectory:'/private/tmp/ui',leaseId:'lease'};
  const origin = 'http://127.0.0.1:1';
  const receipt = {...expected,browser:'ego-browser',session:'1',status:'passed',findings:[],actions:actions(origin)};
  expect(() => validateUiReceipt(receipt, expected)).not.toThrow();
  // The named session is required: a browser identity with no handle is rejected.
  expect(() => validateUiReceipt({...receipt,session:''}, expected)).toThrow(BrowserInfrastructureFailure);
  // Requirement references are mandatory; business coverage is agent-judged.
  const partial = {...receipt,actions:actions(origin)?.map(action=>({...action,coverage:''}))};
  expect(() => validateUiReceipt(partial, expected)).toThrow(BrowserInfrastructureFailure);
});

test('runner request has no lease or receipt authority and controller refuses no request', async () => {
  const run = createRun(process.execPath, 'todo');
  try {
    await expect(serveUi(run.root, process.execPath)).rejects.toThrow('No pending UI controller request');
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:['bun','run','start']}));
    const request = requestUiGate(run, 'todo', 0, 'sha');
    const state = JSON.parse(fs.readFileSync(path.join(run.root, 'ui-controller-0.json'), 'utf8'));
    expect(state.status).toBe('requested');
    expect(state.leaseId).toBeUndefined();
    expect(fs.existsSync(path.join(run.root, 'ui-receipt-0.json'))).toBe(false);
    expect(request.requestId).toBeString();
  } finally { fs.rmSync(run.root,{recursive:true,force:true}); }
});

test('controller starts a healthy exact server and accepts only a matching leased browser receipt', async () => {
  const run = createRun(process.execPath, 'todo');
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:[process.execPath, '-e', "require('node:http').createServer((q,s)=>s.end(q.url==='/health'?'ok':'app')).listen(process.env.PORT,'127.0.0.1')"]}));
    const fingerprint = sourceFingerprint(run);
    requestUiGate(run, 'todo', 0, fingerprint);
    const controller = serveUi(run.root, process.execPath);
    let state: any;
    for (let i = 0; i < 100; i++) {
      await Bun.sleep(50);
      state = JSON.parse(fs.readFileSync(path.join(run.root, 'ui-controller-0.json'), 'utf8'));
      if (state.status === 'server-ready') break;
    }
    expect(state.status).toBe('server-ready');
    const receipt = {caseId:'todo',attempt:0,sourceFingerprint:fingerprint,dataDirectory:state.dataDirectory,leaseId:state.leaseId,browser:'ego-browser',session:'1',status:'passed',findings:[],actions:actions(state.origin)};
    expect(() => submitUiReceipt(run.root, process.execPath, {...receipt,leaseId:'wrong'})).toThrow('lease mismatch');
    const submitted = submitUiReceipt(run.root, process.execPath, receipt);
    expect(submitted.status).toBe('passed');
    await expect(controller).resolves.toMatchObject({code:0});
    const terminal = JSON.parse(fs.readFileSync(path.join(run.root, 'ui-controller-0.json'), 'utf8'));
    expect(terminal.status).toBe('passed');
    expect(terminal.events.map((event: {status:string}) => event.status)).toEqual(['requested','leased','server-ready','passed']);
  } finally { fs.rmSync(run.root,{recursive:true,force:true}); }
});

test('unleased controller timeout is infrastructure without a business correction', async () => {
  const run = createRun(process.execPath, 'todo');
  const previous = process.env.E2E_UI_CONTROLLER;
  process.env.E2E_UI_CONTROLLER = 'external';
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:['bun','run','start']}));
    const clock = spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(300_001);
    try { await expect(awaitUiGate(run,'todo',0,'sha')).rejects.toThrow('did not lease and start'); }
    finally { clock.mockRestore(); }
  } finally {
    if (previous === undefined) delete process.env.E2E_UI_CONTROLLER;
    else process.env.E2E_UI_CONTROLLER = previous;
    fs.rmSync(run.root,{recursive:true,force:true});
  }
});

test('server-ready without a browser operator fails fast as infrastructure', async () => {
  const run = createRun(process.execPath, 'todo');
  const previous = process.env.E2E_UI_OPERATOR_ATTACH_MS;
  const previousController = process.env.E2E_UI_CONTROLLER;
  process.env.E2E_UI_OPERATOR_ATTACH_MS = '0';
  process.env.E2E_UI_CONTROLLER = 'external';
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:[process.execPath, '-e', "require('node:http').createServer((q,s)=>s.end(q.url==='/health'?'ok':'app')).listen(process.env.PORT,'127.0.0.1')"]}));
    const fingerprint = sourceFingerprint(run);
    const gate = awaitUiGate(run, 'todo', 0, fingerprint);
    const controller = serveUi(run.root, process.execPath);
    try {
      await expect(gate).rejects.toThrow('No browser operator attached after server-ready');
    } finally {
      await controller.catch(() => {});
    }
  } finally {
    if (previous === undefined) delete process.env.E2E_UI_OPERATOR_ATTACH_MS;
    else process.env.E2E_UI_OPERATOR_ATTACH_MS = previous;
    if (previousController === undefined) delete process.env.E2E_UI_CONTROLLER;
    else process.env.E2E_UI_CONTROLLER = previousController;
    fs.rmSync(run.root,{recursive:true,force:true});
  }
});

test('runner starts the controller and still fails closed without an operator', async () => {
  const run = createRun(process.execPath, 'todo');
  const previousAttach = process.env.E2E_UI_OPERATOR_ATTACH_MS;
  const previousController = process.env.E2E_UI_CONTROLLER;
  const previousOperator = process.env.E2E_UI_OPERATOR;
  delete process.env.E2E_UI_CONTROLLER;
  process.env.E2E_UI_OPERATOR = 'wait';
  process.env.E2E_UI_OPERATOR_ATTACH_MS = '0';
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:[process.execPath, '-e', "require('node:http').createServer((q,s)=>s.end(q.url==='/health'?'ok':'app')).listen(process.env.PORT,'127.0.0.1')"]}));
    await expect(awaitUiGate(run, 'todo', 0, sourceFingerprint(run))).rejects.toThrow('No browser operator attached after server-ready');
    const state = JSON.parse(fs.readFileSync(path.join(run.root, 'ui-controller-0.json'), 'utf8'));
    expect(state.events.find((event: {status:string}) => event.status === 'leased')?.actor).toBe('controller');
    expect(state.events.map((event: {status:string}) => event.status)).toContain('server-ready');
    expect(state.status).not.toBe('passed');
    expect(fs.existsSync(path.join(run.root, 'ui-receipt-0.json'))).toBe(false);
  } finally {
    if (previousAttach === undefined) delete process.env.E2E_UI_OPERATOR_ATTACH_MS;
    else process.env.E2E_UI_OPERATOR_ATTACH_MS = previousAttach;
    if (previousController === undefined) delete process.env.E2E_UI_CONTROLLER;
    else process.env.E2E_UI_CONTROLLER = previousController;
    if (previousOperator === undefined) delete process.env.E2E_UI_OPERATOR;
    else process.env.E2E_UI_OPERATOR = previousOperator;
    fs.rmSync(run.root,{recursive:true,force:true});
  }
}, 20_000);

test('default path admits an injected acceptance trace and does not call a model', async () => {
  const run = createRun(process.execPath, 'todo');
  const previousController = process.env.E2E_UI_CONTROLLER;
  const previousOperator = process.env.E2E_UI_OPERATOR;
  delete process.env.E2E_UI_CONTROLLER;
  delete process.env.E2E_UI_OPERATOR;
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:[process.execPath, '-e', "require('node:http').createServer((q,s)=>s.end(q.url==='/health'?'ok':'app')).listen(process.env.PORT,'127.0.0.1')"]}));
    const fingerprint = sourceFingerprint(run);
    const receipt = await awaitUiGate(run, 'todo', 0, fingerprint, undefined, async (ctx) => ({
      proposal: { browser: 'ego-browser', session: ctx.session, status: 'passed', findings: [], actions: actions(ctx.origin) },
      trace: [
        { tool: 'ego-browser', command: `ego-browser nodejs -e 'const t=await taskSpace(${ctx.session}); const p=t.page("p1"); await p.goto("${ctx.origin}"); console.log(await p.url()); console.log(await p.snapshot());'`, exitCode: 0, output: ctx.origin },
        { tool: 'ego-browser', command: `ego-browser nodejs -e 'const t=await taskSpace(${ctx.session}); const p=t.page("p1"); await p.click("button"); console.log(await p.snapshot());'`, exitCode: 0, output: 'clicked' },
        { tool: 'ego-browser', command: `ego-browser nodejs -e 'const t=await taskSpace(${ctx.session}); console.log(await t.page("p1").snapshot());'`, exitCode: 0, output: 'visible result' },
      ],
    }));
    expect(receipt.status).toBe('passed');
    expect(receipt.leaseId).toBeString();
    const state = JSON.parse(fs.readFileSync(path.join(run.root, 'ui-controller-0.json'), 'utf8'));
    expect(state.status).toBe('passed');
    expect(fs.existsSync(path.join(run.root, 'ui-operator-0.json'))).toBe(true);
  } finally {
    if (previousController === undefined) delete process.env.E2E_UI_CONTROLLER;
    else process.env.E2E_UI_CONTROLLER = previousController;
    if (previousOperator === undefined) delete process.env.E2E_UI_OPERATOR;
    else process.env.E2E_UI_OPERATOR = previousOperator;
    fs.rmSync(run.root,{recursive:true,force:true});
  }
}, 20_000);

test('injected PASS without a browser trace is infrastructure and does not pass', async () => {
  const run = createRun(process.execPath, 'todo');
  const previousController = process.env.E2E_UI_CONTROLLER;
  const previousOperator = process.env.E2E_UI_OPERATOR;
  delete process.env.E2E_UI_CONTROLLER;
  delete process.env.E2E_UI_OPERATOR;
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:[process.execPath, '-e', "require('node:http').createServer((q,s)=>s.end(q.url==='/health'?'ok':'app')).listen(process.env.PORT,'127.0.0.1')"]}));
    const fingerprint = sourceFingerprint(run);
    await expect(awaitUiGate(run, 'todo', 0, fingerprint, undefined, async () => ({
      proposal: { browser: 'ego-browser', session: '1', status: 'passed', findings: [], actions: actions('http://127.0.0.1:1') },
      trace: [],
    }))).rejects.toThrow(BrowserInfrastructureFailure);
    const state = JSON.parse(fs.readFileSync(path.join(run.root, 'ui-controller-0.json'), 'utf8'));
    expect(state.status).not.toBe('passed');
    const receipt = JSON.parse(fs.readFileSync(path.join(run.root, 'ui-receipt-0.json'), 'utf8'));
    expect(receipt.status).toBe('infrastructure-failed');
  } finally {
    if (previousController === undefined) delete process.env.E2E_UI_CONTROLLER;
    else process.env.E2E_UI_CONTROLLER = previousController;
    if (previousOperator === undefined) delete process.env.E2E_UI_OPERATOR;
    else process.env.E2E_UI_OPERATOR = previousOperator;
    fs.rmSync(run.root,{recursive:true,force:true});
  }
}, 20_000);

test('acceptance findings quoted from the trace stay a business correction', async () => {
  const run = createRun(process.execPath, 'todo');
  const previousController = process.env.E2E_UI_CONTROLLER;
  const previousOperator = process.env.E2E_UI_OPERATOR;
  delete process.env.E2E_UI_CONTROLLER;
  delete process.env.E2E_UI_OPERATOR;
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:[process.execPath, '-e', "require('node:http').createServer((q,s)=>s.end(q.url==='/health'?'ok':'app')).listen(process.env.PORT,'127.0.0.1')"]}));
    const fingerprint = sourceFingerprint(run);
    try {
      await awaitUiGate(run, 'todo', 0, fingerprint, undefined, async (ctx) => ({
        proposal: { browser: 'ego-browser', session: ctx.session, status: 'failed', findings: ['Edit did not persist'] },
        trace: [
          { tool: 'ego-browser', command: `ego-browser nodejs -e 'const t=await taskSpace(${ctx.session}); const p=t.page("p1"); await p.goto("${ctx.origin}"); console.log(await p.url()); console.log(await p.snapshot());'`, exitCode: 0, output: ctx.origin },
          { tool: 'ego-browser', command: `ego-browser nodejs -e 'const t=await taskSpace(${ctx.session}); console.log(await t.page("p1").snapshot());'`, exitCode: 0, output: 'Edit did not persist' },
        ],
      }));
      throw new Error('expected a business acceptance failure');
    } catch (error) {
      expect(error).not.toBeInstanceOf(BrowserInfrastructureFailure);
      expect(String(error)).toContain('Browser acceptance failed');
    }
    const state = JSON.parse(fs.readFileSync(path.join(run.root, 'ui-controller-0.json'), 'utf8'));
    expect(state.status).toBe('browser-acceptance-failed');
  } finally {
    if (previousController === undefined) delete process.env.E2E_UI_CONTROLLER;
    else process.env.E2E_UI_CONTROLLER = previousController;
    if (previousOperator === undefined) delete process.env.E2E_UI_OPERATOR;
    else process.env.E2E_UI_OPERATOR = previousOperator;
    fs.rmSync(run.root,{recursive:true,force:true});
  }
}, 20_000);

test.each(['todo', 'blog', 'ecommerce'])('historical %s re-verification creates an additive read-only controller root', (caseId) => {
  const historical = createRun(process.execPath, caseId);
  let reverifyRoot: string | undefined;
  try {
    fs.writeFileSync(path.join(historical.workspace, 'e2e-server.json'), JSON.stringify({command:['bun','run','start']}));
    const fingerprint = sourceFingerprint(historical);
    requestUiGate(historical, caseId, 1, fingerprint);
    fs.writeFileSync(path.join(historical.root, 'result.json'), JSON.stringify({status:'infrastructure-failed',caseId}));
    const reverify = createUiReverification(historical.root, process.execPath);
    reverifyRoot = reverify.root;
    expect(reverify.root).not.toBe(historical.root);
    expect(reverify.workspace).toBe(historical.workspace);
    expect(reverify.readonlyWorkspace).toBe(true);
    const checked = Bun.spawnSync(sandbox(reverify, [process.execPath, '-e', `const fs=require("node:fs"); if(!fs.statSync(${JSON.stringify(historical.root)}).isDirectory())throw Error("no parent metadata"); fs.readFileSync(${JSON.stringify(path.join(historical.workspace,'e2e-server.json'))}); try { fs.readFileSync(${JSON.stringify(path.join(historical.root,'result.json'))}); process.exit(2); } catch { console.log("historical evidence denied"); }`], 'acceptance'), { cwd: historical.workspace, env: reverify.env });
    expect(checked.exitCode).toBe(0);
    expect(checked.stdout.toString()).toContain('historical evidence denied');
    expect(JSON.parse(fs.readFileSync(path.join(historical.root, 'result.json'), 'utf8')).status).toBe('infrastructure-failed');
    const source = JSON.parse(fs.readFileSync(path.join(reverify.root, 'ui-reverification-source.json'), 'utf8'));
    expect(source.sourceRunRoot).toBe(historical.root);
    expect(source.sourceFingerprint).toBe(fingerprint);
  } finally {
    if (reverifyRoot) fs.rmSync(reverifyRoot,{recursive:true,force:true});
    fs.rmSync(historical.root,{recursive:true,force:true});
  }
});
