import { expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRun } from './runtime';
import { sourceFingerprint } from './integrity';
import { awaitUiGate, BrowserInfrastructureFailure, createUiReverification, requestUiGate, serveUi, submitUiReceipt, validateUiReceipt } from './ui-gate';

const actions = (origin: string) => [
  ['click', 'authentication'], ['fill', 'business-create'], ['dialog', 'business-update'], ['select', 'business-query'], ['observe', 'literal-input'],
].map(([operation, coverage]) => ({ operation, coverage, url: origin, target: `${coverage}-control`, expected: 'visible', observed: 'visible result' }));

test('controller infrastructure failure stops acceptance without granting PASS or classifying product findings', () => {
  const expected = {caseId:'todo',attempt:0,sourceFingerprint:'sha',dataDirectory:'/private/tmp/ui',leaseId:'lease'};
  const receipt = {...expected,browser:'ego-browser',spaceId:1,status:'infrastructure-failed',reason:'CDP Runtime.evaluate timeout'};
  expect(() => validateUiReceipt(receipt, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,attempt:1}, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,reason:''}, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,status:'passed',findings:[],actions:[]}, expected)).toThrow(BrowserInfrastructureFailure);
  const productFailure = {...receipt,status:'failed',findings:['Edit did not persist']};
  expect(() => validateUiReceipt(productFailure, expected)).toThrow('Browser acceptance failed');
  expect(() => validateUiReceipt(productFailure, expected)).not.toThrow(BrowserInfrastructureFailure);
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
    const receipt = {caseId:'todo',attempt:0,sourceFingerprint:fingerprint,dataDirectory:state.dataDirectory,leaseId:state.leaseId,browser:'ego-browser',spaceId:1,status:'passed',findings:[],actions:actions(state.origin)};
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
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:['bun','run','start']}));
    const clock = spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(300_001);
    try { await expect(awaitUiGate(run,'todo',0,'sha')).rejects.toThrow('did not lease and start'); }
    finally { clock.mockRestore(); }
  } finally { fs.rmSync(run.root,{recursive:true,force:true}); }
});

test('historical Todo re-verification creates an additive read-only controller root', () => {
  const historical = createRun(process.execPath, 'todo');
  let reverifyRoot: string | undefined;
  try {
    fs.writeFileSync(path.join(historical.workspace, 'e2e-server.json'), JSON.stringify({command:['bun','run','start']}));
    const fingerprint = sourceFingerprint(historical);
    requestUiGate(historical, 'todo', 1, fingerprint);
    fs.writeFileSync(path.join(historical.root, 'result.json'), JSON.stringify({status:'infrastructure-failed',caseId:'todo'}));
    const reverify = createUiReverification(historical.root, process.execPath);
    reverifyRoot = reverify.root;
    expect(reverify.root).not.toBe(historical.root);
    expect(reverify.workspace).toBe(historical.workspace);
    expect(reverify.readonlyWorkspace).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(historical.root, 'result.json'), 'utf8')).status).toBe('infrastructure-failed');
    const source = JSON.parse(fs.readFileSync(path.join(reverify.root, 'ui-reverification-source.json'), 'utf8'));
    expect(source.sourceRunRoot).toBe(historical.root);
    expect(source.sourceFingerprint).toBe(fingerprint);
  } finally {
    if (reverifyRoot) fs.rmSync(reverifyRoot,{recursive:true,force:true});
    fs.rmSync(historical.root,{recursive:true,force:true});
  }
});
