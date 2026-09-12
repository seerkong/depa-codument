import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';
import { createRun, execute, sandbox, setup, sha, writeJson } from './runtime';

export async function smoke(candidate: string) {
  const run = createRun(candidate, 'smoke');
  console.log(JSON.stringify({ phase: 'smoke', root: run.root }));
  await setup(run);
  const cli = async (name: string, args: string[]) => execute({ argv: sandbox(run, [run.bin, ...args]), cwd: run.workspace, env: run.env, log: path.join(run.root, `logs/${name}.log`) });
  assert.equal((await cli('help', ['-h'])).code, 0);
  const help = fs.readFileSync(path.join(run.root, 'logs/help.log'), 'utf8');
  assert.match(help, /init --agent=claude,codex,eidolon/);
  assert.doesNotMatch(help, /^\s+demo\s/m);
  assert.notEqual((await cli('unknown', ['no-such-e2e-command'])).code, 0);
  assert.equal((await cli('guidance', ['plan-track', '--json'])).code, 0);
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
  const legacy = await execute({ argv: [path.join(run.root, 'bin/codument'), '-h'], cwd: run.workspace, env: run.env, log: path.join(run.root, 'logs/legacy.log') });
  assert.equal(legacy.code, 89);
  const result = { status: 'passed', modelCalls: 0, root: run.root, assertions: ['isolated-install', 'global-layout', 'workspace-app', 'help', 'guidance', 'unknown-command', 'sandbox-denial', 'sandbox-write', 'timeout', 'legacy-rejected'] };
  writeJson(path.join(run.root, 'result.json'), result);
  return result;
}
