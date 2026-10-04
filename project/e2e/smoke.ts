import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';
import { createRun, execute, sandbox, setup, sha, writeJson, runProduct, runSkillRoot } from './runtime';

export async function smoke(candidate: string) {
  const run = createRun(candidate, 'smoke');
  console.log(JSON.stringify({ phase: 'smoke', root: run.root }));
  await setup(run);
  const cli = async (name: string, args: string[]) => execute({ argv: sandbox(run, [run.bin, ...args]), cwd: run.workspace, env: run.env, log: path.join(run.root, `logs/${name}.log`) });
  assert.equal((await cli('help', ['-h'])).code, 0);
  const help = fs.readFileSync(path.join(run.root, 'logs/help.log'), 'utf8');
  const product=runProduct(run);
  if(product.id==='current') {
    assert.match(help, /init --agent=claude,codex,eidolon/);
    assert.doesNotMatch(help, /^\s+demo\s/m);
  } else assert.match(help,/Codument/);
  assert.notEqual((await cli('unknown', ['no-such-e2e-command'])).code, 0);
  if(product.id==='current') assert.equal((await cli('guidance', ['plan-track', '--json'])).code, 0);
  else assert.ok(fs.readFileSync(path.join(runSkillRoot(run),'codument-plan-track/SKILL.md'),'utf8').length>0);
  const sentinel = path.join(run.root, 'protected-sentinel');
  fs.writeFileSync(sentinel, 'unchanged');
  const before = sha(sentinel);
  const attempt = await execute({ argv: sandbox(run, ['/usr/bin/touch', sentinel]), cwd: run.workspace, env: run.env, log: path.join(run.root, 'logs/deny-write.log') });
  assert.notEqual(attempt.code, 0); assert.equal(sha(sentinel), before);
  const write = await execute({ argv: sandbox(run, [process.execPath, '-e', "require('fs').writeFileSync('allowed','yes')"]), cwd: run.workspace, env: run.env, log: path.join(run.root, 'logs/allow-write.log') });
  assert.equal(write.code, 0);
  assert.equal(fs.readFileSync(path.join(run.workspace, 'allowed'), 'utf8'), 'yes');
  const timeout = await execute({ argv: [process.execPath, '-e', 'setInterval(()=>{},1000)'], cwd: run.workspace, env: run.env, log: path.join(run.root, 'logs/timeout.log'), timeoutMs: 100 });
  assert.equal(timeout.code, 124); assert.equal(timeout.timedOut, true);
  const legacy = await execute({ argv: [path.join(run.root, 'bin',product.rejectedCommand), '-h'], cwd: run.workspace, env: run.env, log: path.join(run.root, 'logs/legacy.log') });
  assert.equal(legacy.code, 89);
  const result = { status: 'passed', product:product.id, modelCalls: 0, root: run.root, assertions: ['isolated-install', 'version-owned-layout', 'workspace-assets', 'help', 'guidance', 'unknown-command', 'sandbox-denial', 'sandbox-write', 'timeout', 'other-product-rejected'] };
  writeJson(path.join(run.root, 'result.json'), result);
  return result;
}
