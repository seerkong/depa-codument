import {mkdtemp, realpath, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const binary=process.argv[2];
assert.ok(binary,'binary-smoke.ts ABSOLUTE_DEPA_BIN');
const root=await realpath(await mkdtemp(join(tmpdir(),'depa-composition-binary-')));
const results=[];
for(const args of [
  ['init-workspace','--agent=claude,codex','--json'],
  ['Resource','validate','--json'],
  ['status','--json'],
  ['discuss','--json'],
]) {
  const child=Bun.spawn([binary,...args],{cwd:root,stdout:'pipe',stderr:'pipe'});
  const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  assert.equal(code,0,`${args.join(' ')}: ${stderr}\n${stdout}`);
  const payload=JSON.parse(stdout);
  assert.notEqual(payload.ok,false);
  results.push({command:args.join(' '),code,bytes:Buffer.byteLength(stdout),payload});
}
assert.ok((await stat(join(root,'codument/manifest.xnl'))).isFile());
console.log(JSON.stringify({root,binary,results}));
