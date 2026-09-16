import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { sha, writeJson, type Run } from './runtime';

/** Parent-owned baseline, never re-derived from the agent's workspace on resume. */
export function checkRequirements(run: Run, caseRoot: string): void {
  const baseline = path.join(run.root, 'requirements.json');
  const expected = Object.fromEntries(['request.md','acceptance.md'].map(name => [name,sha(path.join(caseRoot,name))]));
  if (fs.existsSync(baseline)) assert.deepEqual(JSON.parse(fs.readFileSync(baseline,'utf8')),expected,'Case definition changed; resume requires an explicit new trial');
  else writeJson(baseline,expected);
  for (const [name,hash] of Object.entries(expected)) assert.equal(sha(path.join(run.workspace,name)),hash,`Immutable ${name} modified`);
}

export function assertFreshThread(threadId: string | undefined, previous: string[]): void {
  assert.ok(threadId, 'Missing observed thread identity');
  assert.ok(!previous.includes(threadId), 'Fresh phase reused a previous thread');
}

export function sourceFingerprint(run: Run): string {
  const rows: string[] = [];
  function visit(directory: string): void {
    for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
      // .eidolon is the agent runtime's private project state (authority/locks),
      // the same class of non-authored bookkeeping as .git; it is never delivered
      // source, so it must not be readable as reviewer contamination.
      if (['.git','__pycache__','.pytest_cache','.eidolon'].includes(entry.name)) continue;
      if (entry.name.startsWith('.e2e-') && entry.name !== '.e2e-venv') continue;
      const file = path.join(directory,entry.name);
      const relative = path.relative(run.workspace,file);
      if (entry.isDirectory()) visit(file);
      else if (entry.isSymbolicLink()) {
        const target = fs.realpathSync(file);
        rows.push(`${relative}:link:${fs.readlinkSync(file)}`);
        if (fs.statSync(target).isFile()) rows.push(`${relative}:target:${sha(target)}`);
        else assert.ok(target.startsWith(run.workspace+path.sep),'External dependency directory is not a frozen source');
      } else rows.push(`${relative}:${sha(file)}`);
    }
  }
  visit(run.workspace);
  return createHash('sha256').update(rows.sort().join('\n')).digest('hex');
}

export class ReviewerInfrastructureFailure extends Error {}
export function assertReviewerSourceUnchanged(before: string, after: string): void {
  if (before !== after) throw new ReviewerInfrastructureFailure(`Independent reviewer modified delivered source: expected ${before}, observed ${after}`);
}

export function isFirstPass(attempts: Record<string,unknown>[]): boolean {
  return attempts.find(a=>a.attempt===0)?.status === 'passed';
}

export { isExecutedTestCommand } from './execution-evidence';

/** An interrupted runner cannot be resumed concurrently by another worker. */
export function lockRun(run: Run): () => void {
  const file = path.join(run.root,'runner-lock.json');
  if (fs.existsSync(file)) {
    const owner = JSON.parse(fs.readFileSync(file,'utf8'));
    assert.ok(Number.isInteger(owner.pid) && owner.pid > 0, 'Invalid runner lock');
    let alive = true;
    try { process.kill(owner.pid,0); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      alive = false;
    }
    assert.ok(!alive, `Run is already owned by PID ${owner.pid}`);
    fs.renameSync(file,path.join(run.root,`stale-lock-${Date.now()}.json`));
  }
  fs.writeFileSync(file,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
  return () => { if (JSON.parse(fs.readFileSync(file,'utf8')).pid === process.pid) fs.unlinkSync(file); };
}
