import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRun, execute, sandbox } from './runtime';
import { assertReviewerSourceUnchanged, ReviewerInfrastructureFailure, sourceFingerprint } from './integrity';
import { agentTurn, isInfrastructureFailure } from './workload';
import { REVIEW_EXECUTION_GUIDANCE } from './execution-evidence';

test('reviewer pollution terminates as infrastructure while real business failures remain corrections', () => {
  assertReviewerSourceUnchanged('same', 'same');
  expect(() => assertReviewerSourceUnchanged('before', 'after')).toThrow(ReviewerInfrastructureFailure);
  expect(isInfrastructureFailure(new ReviewerInfrastructureFailure('source drift'))).toBe(true);
  expect(isInfrastructureFailure(new Error('Required original test missing'))).toBe(false);
});

test('review sandbox protects source, builds and dependencies while allowing isolated execution state', async () => {
  const run = createRun(process.execPath, 'unit');
  try {
    for (const name of ['src/main.py', 'build/lib/main.py', 'node_modules/pkg/index.js']) {
      const file = path.join(run.workspace, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'original');
    }
    const before = sourceFingerprint(run);
    const blocked = ['src/main.py', 'build/lib/main.py', 'node_modules/pkg/index.js', 'new.txt'].map(name => path.join(run.workspace, name));
    const allowed = ['tmp/result.json', 'cache/cache.txt', '.codex/session-test.json'].map(name => path.join(run.home, name));
    const script = `const fs=require('node:fs'); for(const file of ${JSON.stringify(blocked)}) { let denied=false; try { fs.writeFileSync(file,'changed'); } catch { denied=true; } if(!denied) throw Error('Unexpected source write: '+file); } for(const file of ${JSON.stringify(allowed)}) fs.writeFileSync(file,'allowed');`;
    const receipt = await execute({ argv: sandbox(run, [process.execPath, '-e', script], 'review'), cwd: run.workspace, env: run.env, log: path.join(run.root, 'logs/review-policy.log') });
    expect(receipt.code).toBe(0);
    expect(sourceFingerprint(run)).toBe(before);
    for (const file of allowed) expect(fs.readFileSync(file, 'utf8')).toBe('allowed');
  } finally { fs.rmSync(run.root, { recursive: true, force: true }); }
});

test('actual read-only agent turn writes its final output outside the delivery', async () => {
  const run = createRun(process.execPath, 'unit');
  try {
    const fake = path.join(run.root, 'bin/fake-codex');
    fs.writeFileSync(fake, `#!${process.execPath}\nconst fs=require('node:fs'); const args=process.argv.slice(2); fs.writeFileSync(args[args.indexOf('-o')+1],JSON.stringify({verdict:'PASS',findings:[],checks:['fixture']})); console.log(JSON.stringify({type:'thread.started',thread_id:'fresh-readonly-fixture'})); console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,cached_input_tokens:0,output_tokens:1}}));\n`, { mode: 0o755 });
    const before = sourceFingerprint(run);
    const receipt = await agentTurn(run, fake, 'Fixture only, no model invocation.', 'review-0', 10_000, [], 'read-only');
    expect(receipt.outputFile).toBe(path.join(run.home, 'tmp/.e2e-review-0-last.md'));
    expect(JSON.parse(fs.readFileSync(receipt.outputFile, 'utf8')).verdict).toBe('PASS');
    expect(sourceFingerprint(run)).toBe(before);
    expect(fs.existsSync(path.join(run.workspace, '.e2e-review-0-last.md'))).toBe(false);
    const invocation = JSON.parse(fs.readFileSync(path.join(run.root, 'review-0-invocation.json'), 'utf8'));
    expect(invocation.args.at(-1)).toBe(REVIEW_EXECUTION_GUIDANCE + 'Fixture only, no model invocation.');
  } finally { fs.rmSync(run.root, { recursive: true, force: true }); }
});
