import { expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRun } from './runtime';
import { awaitUiGate, BrowserInfrastructureFailure, validateUiReceipt } from './ui-gate';

test('controller infrastructure failure stops acceptance without granting PASS or classifying product findings', () => {
  const expected = {caseId:'todo',attempt:0,sourceFingerprint:'sha',dataDirectory:'/private/tmp/ui'};
  const receipt = {...expected,browser:'ego-browser',status:'infrastructure-failed',reason:'CDP Runtime.evaluate timeout'};
  expect(() => validateUiReceipt(receipt, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,attempt:1}, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,reason:''}, expected)).toThrow(BrowserInfrastructureFailure);
  expect(() => validateUiReceipt({...receipt,status:'passed',actions:[]}, expected)).toThrow(BrowserInfrastructureFailure);
  const productFailure = {...receipt,spaceId:4,status:'failed',findings:['Edit did not persist']};
  expect(() => validateUiReceipt(productFailure, expected)).toThrow('Browser acceptance failed');
  expect(() => validateUiReceipt(productFailure, expected)).not.toThrow(BrowserInfrastructureFailure);
});

test('actual UI gate deadline and malformed controller JSON fail as infrastructure without model execution', async () => {
  const run = createRun(process.execPath, 'todo');
  try {
    fs.writeFileSync(path.join(run.workspace, 'e2e-server.json'), JSON.stringify({command:['bun','run','start']}));
    const clock = spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(900_001);
    try { await expect(awaitUiGate(run,'todo',0,'sha')).rejects.toThrow(BrowserInfrastructureFailure); }
    finally { clock.mockRestore(); }
    fs.writeFileSync(path.join(run.root, 'ui-receipt-1.json'), '{invalid');
    await expect(awaitUiGate(run,'todo',1,'sha')).rejects.toThrow(BrowserInfrastructureFailure);
  } finally { fs.rmSync(run.root,{recursive:true,force:true}); }
});
