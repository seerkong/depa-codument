import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';

const batch = fs.realpathSync(process.argv[2]!);
assert.match(batch, /^\/private\/tmp\/depa-codument-e2e-batch-[^/]+$/);
function read(file: string): any { return JSON.parse(fs.readFileSync(file, 'utf8')); }
const state = read(path.join(batch, 'suite-status.json'));
assert.equal(state.status, 'completed');
assert.equal(state.batchLabel, 'npm-release-0.2.1');
assert.equal(state.rows.length, 5);
const {sha, treeHash, AGENT, writeJson} = await import(path.join(state.project, 'e2e/runtime.ts'));
const {summarize} = await import(path.join(state.project, 'e2e/report.ts'));
const installation = read(path.join(path.dirname(path.dirname(state.project)), 'global-install.json'));
assert.equal(sha(state.candidate), state.candidateSha256);
assert.equal(sha(installation.binary), state.candidateSha256);
assert.equal(treeHash(path.join(state.project, 'e2e')), state.harnessSha256);
assert.equal(sha('/Users/kongweixian/.local/bin/codument'), installation.protectedBefore.oldBin);
assert.equal(fs.readlinkSync('/Users/kongweixian/.local/bin/codument'), installation.protectedBefore.oldLink);
assert.equal(treeHash('/Users/kongweixian/infra-dev/depa-codument/codument'), installation.protectedBefore.workspace);
for (const directory of ['.agents/skills', '.claude/skills', '.eidolon/skills']) {
  assert.equal(treeHash(path.join('/Users/kongweixian', directory, 'depa-codument')), installation.appSha256);
}
const source = '/Users/kongweixian/infra-dev/depa-codument/project';
assert.equal(treeHash(path.join(source, 'e2e')), state.harnessSha256);
const contexts: unknown[] = [], closedEndpoints: string[] = [];
async function requireClosed(endpoint: string): Promise<void> {
  assert.match(endpoint, /^http:\/\/127\.0\.0\.1:\d+(?:\/health)?$/);
  let reachable = false;
  try { await fetch(endpoint, {signal: AbortSignal.timeout(1000)}); reachable = true; } catch { /* closed */ }
  assert.equal(reachable, false, 'Owned endpoint remains: ' + endpoint);
  closedEndpoints.push(endpoint);
}
for (const row of state.rows) {
  assert.ok(row.root);
  assert.notEqual(row.state, 'running');
  const root = row.root;
  assert.equal(fs.existsSync(path.join(root, 'home/.codex/auth.json')), false);
  const provenance = read(path.join(root, 'provenance.json'));
  assert.equal(provenance.sha256, state.candidateSha256);
  assert.equal(provenance.harnessSha256, state.harnessSha256);
  const observed = AGENT.auditModels({root, workspace:path.join(root,'workspace'), home:path.join(root,'home'), env:{}}).contexts;
  assert.ok(observed.length > 0);
  assert.ok(observed.every((context: any) => context.model === 'gpt-5.6-terra' && context.effort === 'medium'));
  contexts.push(...observed);
  const installed = read(path.join(root, 'installation.json'));
  assert.equal(treeHash(installed.skill), installation.appSha256);
  assert.deepEqual(read(path.join(root, 'workflow-policy.json')), read(path.join(source, 'e2e/workflow-policy.json')));
  for (const [name, digest] of Object.entries(read(path.join(root, 'requirements.json')))) {
    assert.equal(sha(path.join(root, 'workspace', name)), digest);
    assert.equal(sha(path.join(source, 'e2e/cases', row.caseId, name)), digest);
  }
  for (const name of fs.readdirSync(root).filter(name => /^ui-controller-\d+\.json$/.test(name))) {
    const origin = read(path.join(root, name)).origin;
    if (origin) await requireClosed(origin + '/health');
  }
  for (const name of fs.readdirSync(path.join(root, 'home/tmp')).filter(name => name.endsWith('-connection.json'))) {
    const endpoint = read(path.join(root, 'home/tmp', name)).endpoint;
    if (endpoint) await requireClosed(endpoint);
  }
}
const report = summarize(state.rows.map((row: any) => row.root));
const rows = report.runs.map((row: any) => ({...row, result: read(path.join(row.root, 'result.json'))}));
const summary = {
  total: rows.length,
  firstPassed: rows.filter((row: any) => row.firstPass === true).length,
  finalPassed: rows.filter((row: any) => row.status === 'passed').length,
  infrastructure: rows.filter((row: any) => row.status === 'infrastructure-failed').length,
  elapsedMs: rows.reduce((total: number, row: any) => total + (row.elapsedMs ?? 0), 0),
  usage: rows.reduce((total: any, row: any) => ({input:total.input+(row.usage?.input??0), cached:total.cached+(row.usage?.cached??0), output:total.output+(row.usage?.output??0)}), {input:0,cached:0,output:0}),
  unknownUsageRuns: rows.filter((row: any) => row.usage === null).length,
};
writeJson(path.join(batch, 'observation.json'), {observedAt:new Date().toISOString(), summary, rows, report, contexts, closedEndpoints, installation, protectedUnchanged:true});
console.log(JSON.stringify({summary, modelContexts:contexts.length, closedEndpoints:closedEndpoints.length, cases:rows.map((row:any)=>({caseId:row.caseId,status:row.status,firstPass:row.firstPass,attempts:row.result.attempts?.length,elapsedMs:row.elapsedMs}))}));
