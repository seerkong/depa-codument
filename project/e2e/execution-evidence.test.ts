import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRun } from './runtime';
import { isExecutedTestCommand, readNativeExecutions } from './execution-evidence';
import { requireIndependentReview, isInfrastructureFailure } from './workload';
import { ReviewerInfrastructureFailure } from './integrity';

test('native argv recognizes quoted venv paths and environment prefixes without evaluating shell data', () => {
  for (const script of [
    '"$review_venv/bin/python" -m pytest -q',
    'PYTHONPATH="$PWD/src:$PWD" "$review_venv/bin/python" -m pytest -q',
    'HOME="$review_home" "$review_root/package-venv/bin/pytest" -q',
    'review_root=$(mktemp -d "$TMPDIR/review.XXXXXX") && HOME="$review_root/home" "$review_root/venv/bin/python" -m pytest -q && printf done',
    'env HOME="$review_home" "/tmp/path with spaces/bin/pytest" -q',
  ]) expect(isExecutedTestCommand(['/bin/zsh', '-lc', script])).toBe(true);
  expect(isExecutedTestCommand(['/tmp/venv/bin/python', '-m', 'pytest', '-q'])).toBe(true);
  for (const script of [
    'echo "prefix; pytest -q"', "echo 'prefix && pytest -q; ignored'", "rg 'bun test' package.json",
    'python -c "print(\'pytest\')"', 'echo $(pytest -q)', 'runner=$(echo pytest); echo "$runner"',
    'if false; then pytest -q; fi', 'pytest -q | cat', 'false || pytest -q',
    "cat <<EOF\npytest -q\nEOF", '# pytest -q\necho done', 'echo "unterminated; pytest -q',
  ]) expect(isExecutedTestCommand(['/bin/zsh', '-lc', script])).toBe(false);
});

test('native execution evidence is scoped to one observed thread and deduplicated', () => {
  const run = createRun(process.execPath, 'unit');
  try {
    const dir = path.join(run.home, '.codex/sessions'); fs.mkdirSync(dir);
    const item = (thread: string, id: string, exit: number | null) => ({type:'event_msg',payload:{type:'item_completed',thread_id:thread,item:{type:'CommandExecution',id,command:['/bin/zsh','-lc','"$venv/bin/python" -m pytest -q'],exit_code:exit}}});
    const events = [{type:'session_meta',payload:{id:'selected'}}, item('selected','test',0), item('selected','test',0), item('other','foreign',0), item('selected','unknown',null)];
    fs.writeFileSync(path.join(dir,'rollout-selected.jsonl'), events.map(event=>JSON.stringify(event)).join('\n'));
    fs.writeFileSync(path.join(dir,'other-selected.jsonl'), JSON.stringify({type:'session_meta',payload:{id:'other'}})+'\n'+JSON.stringify(item('selected','spoof',0)));
    const observed = readNativeExecutions(run,'selected');
    expect(observed).toHaveLength(2);
    expect(observed[0]!.argv).toEqual(['/bin/zsh','-lc','"$venv/bin/python" -m pytest -q']);
    expect(observed.map(value=>value.exitCode)).toEqual([0,null]);
    expect(readNativeExecutions(run,undefined)).toEqual([]);
  } finally { fs.rmSync(run.root,{recursive:true,force:true}); }
});

test('real FAIL is preserved before PASS evidence checks; missing or malformed PASS evidence is infrastructure', () => {
  const pass = {verdict:'PASS',findings:[],checks:['ran pytest']};
  expect(() => requireIndependentReview(pass,[{command:'pytest -q',exitCode:0}])).not.toThrow();
  for (const executions of [[],[{command:'pytest -q',exitCode:1}],[{command:'echo pytest',exitCode:0}]]) expect(()=>requireIndependentReview(pass,executions)).toThrow(ReviewerInfrastructureFailure);
  const fail = {verdict:'FAIL',findings:['file tool escapes allowed root'],checks:['actual probe']};
  try { requireIndependentReview(fail,[]); throw new Error('expected failure'); }
  catch (error) {
    expect(String(error)).toContain('file tool escapes allowed root');
    expect(isInfrastructureFailure(error)).toBe(false);
  }
  for (const value of [null,{...pass,verdict:'unknown'},{...pass,verdict:{toString:'PASS'}},{...pass,checks:[' ']},{...pass,checks:[]},{...pass,findings:['contradiction']},{...fail,findings:[]}]) expect(()=>requireIndependentReview(value,[])).toThrow(ReviewerInfrastructureFailure);
});
