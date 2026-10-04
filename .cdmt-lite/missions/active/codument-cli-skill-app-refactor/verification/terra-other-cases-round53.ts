import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

// Batch supervision only. Business actions and verdicts remain fresh-agent-owned.
const project = fs.realpathSync(process.argv[2]!);
const candidate = fs.realpathSync(process.argv[3]!);
if (!/^\/(private\/)?tmp\/depa-codument-verification-[^/]+\/depa-codument\/project$/.test(project)) throw Error('Isolated project required');
if (!candidate.startsWith(project + '/dist/')) throw Error('Candidate must belong to isolated project');
const runtime = await import(path.join(project, 'e2e/runtime.ts'));
const reporting = await import(path.join(project, 'e2e/report.ts'));
if (runtime.AGENT.id !== 'codex' || runtime.MODEL !== 'gpt-5.6-terra' || runtime.EFFORT !== 'medium') throw Error('Terra/medium identity required');
if (!Number.isSafeInteger(Number(process.env.E2E_EGO_SPACE_ID))) throw Error('Owner TaskSpace required');
const root = fs.realpathSync(fs.mkdtempSync('/tmp/depa-codument-e2e-batch-'));
const cases = ['stream-pipeline-ai-agent', 'blog', 'ecommerce', 'nested-mission-agent'];
const rows: { caseId: string; state: string; log: string; pid?: number; root?: string; exitCode?: number | null; result?: unknown }[] = [];
const candidateSha256 = runtime.sha(candidate);
const harnessSha256 = runtime.treeHash(path.join(project, 'e2e'));
let child: ReturnType<typeof spawn> | undefined;
let interrupted = false;
let interruptTimer: ReturnType<typeof setTimeout> | undefined;
const save = (status: string) => runtime.writeJson(path.join(root, 'suite-status.json'), {
  round: 53, status, pid: process.pid, project, candidate, candidateSha256, harnessSha256,
  model: runtime.MODEL, effort: runtime.EFFORT, spaceId: Number(process.env.E2E_EGO_SPACE_ID), cases, rows,
  updatedAt: new Date().toISOString(),
});
const interrupt = () => {
  interrupted = true;
  save('interrupted');
  if (child?.pid) try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already terminal */ }
  const pid = child?.pid;
  if (pid) interruptTimer = setTimeout(() => { try { process.kill(-pid, 'SIGKILL'); } catch { /* terminal */ } }, 2000);
};
process.once('SIGTERM', interrupt);
process.once('SIGINT', interrupt);
save('running');
console.log(JSON.stringify({ phase: 'batch-started', root, pid: process.pid, cases, candidateSha256, harnessSha256 }));
for (const caseId of cases) {
  if (interrupted) break;
  if (runtime.sha(candidate) !== candidateSha256 || runtime.treeHash(path.join(project, 'e2e')) !== harnessSha256) throw Error('Frozen candidate/harness drift');
  const row = { caseId, state: 'running', log: path.join(root, `${caseId}.log`) } as typeof rows[number];
  rows.push(row);
  const fd = fs.openSync(row.log, 'wx', 0o600);
  child = spawn(process.execPath, [path.join(project, 'e2e/run.ts'), 'run', caseId, `--bin=${candidate}`], {
    cwd: project, env: { ...process.env, E2E_AGENT: 'codex' }, detached: true, stdio: ['ignore', 'pipe', fd],
  });
  row.pid = child.pid;
  save('running');
  let pending = '';
  child.stdout!.on('data', bytes => {
    fs.writeSync(fd, bytes);
    pending += bytes.toString();
    let end: number;
    while ((end = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, end); pending = pending.slice(end + 1);
      try {
        const event = JSON.parse(line);
        if (event.phase === 'real-case' && event.caseId === caseId) {
          row.root = event.root; save('running'); console.log(JSON.stringify(event));
        }
      } catch { /* ordinary diagnostics and formatted final JSON */ }
    }
  });
  row.exitCode = await new Promise<number | null>((resolve, reject) => {
    child!.once('close', resolve); child!.once('error', reject);
  }).finally(() => fs.closeSync(fd));
  if (interruptTimer) clearTimeout(interruptTimer);
  if (interrupted && row.root) runtime.removeAuthentication(runtime.loadRun(row.root, candidate, caseId));
  const resultFile = row.root && path.join(row.root, 'result.json');
  row.result = resultFile && fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null;
  row.state = row.result ? (row.result as { status: string }).status : 'infrastructure-failed';
  save('running');
  console.log(JSON.stringify({ phase: 'case-terminal', caseId, root: row.root, status: row.state, exitCode: row.exitCode }));
}
child = undefined;
runtime.writeJson(path.join(root, 'report.json'), reporting.summarize(rows.flatMap(row => row.root ? [row.root] : [])));
save(interrupted ? 'interrupted' : 'completed');
console.log(JSON.stringify({ phase: 'batch-terminal', root, results: rows.map(({ caseId, state, root }) => ({ caseId, status: state, root })) }));
