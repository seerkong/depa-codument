import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';
import { createRun, loadRun, setup, execute, ExecutionInterrupted, sandbox, installAuthentication, removeAuthentication, agentInvocation, readEvents, files, sha, treeHash, writeJson, MODEL, EFFORT, AGENT, runProduct, runSkillRoot, type Run, type CommandExecution } from './runtime';
import { productGuidance } from './product-profile';
import { prepareStreamDependencies } from './stream-verifier';
import { verifyNestedBindings } from './nested-verifier';
import { trackValidationSelection, exhaustedGapReason, resourceRoot } from './resource-oracle';
import { assertFreshThread, checkRequirements, lockRun, sourceFingerprint, isFirstPass, isExecutedTestCommand, assertReviewerSourceUnchanged, ReviewerInfrastructureFailure } from './integrity';
import { awaitUiGate, BrowserInfrastructureFailure } from './ui-gate';
import { preparePython, pythonRuntimeGuidance } from './python-runtime';
import { applicationEnvironment } from './application-state';
import { observePlannedIdentities, reconcilePlannedIdentities, implementationHandoff, type PlannedIdentity } from './handoff';
import { readNativeExecutions, REVIEW_EXECUTION_GUIDANCE } from './execution-evidence';
import { WORKFLOW_POLICY, workflowPolicyGuidance, assertWorkflowPolicySnapshot, assertTrackWorkflowPolicy } from './workflow-policy';

const caseRoot = path.join(import.meta.dir, 'cases');
class WorkflowBlocked extends Error {}
/** A completed agent turn can report a business defect; transport failures need a distinct type. */
export class AgentTurnFailure extends Error {}
export class AgentTransportFailure extends Error {}
export function isInfrastructureFailure(error: unknown): boolean {
  return error instanceof BrowserInfrastructureFailure || error instanceof ReviewerInfrastructureFailure ||
    error instanceof AgentTransportFailure || error instanceof ExecutionInterrupted || String(error).includes('Harness unsupported:');
}
export function requireIndependentReview(review: unknown, executions: readonly CommandExecution[]): void {
  const value = review as {verdict?: unknown; findings?: unknown; checks?: unknown} | null;
  if (!value || typeof value.verdict !== 'string' || !['PASS', 'FAIL'].includes(value.verdict) || !Array.isArray(value.findings) || !Array.isArray(value.checks)) throw new ReviewerInfrastructureFailure('Malformed independent review verdict');
  if (![...value.findings, ...value.checks].every(item => typeof item === 'string' && item.trim())) throw new ReviewerInfrastructureFailure('Malformed independent review verdict');
  if (value.verdict === 'FAIL') {
    if (!value.findings.length) throw new ReviewerInfrastructureFailure('Independent FAIL requires findings');
    throw new Error(`Independent review failed: ${JSON.stringify(value.findings)}`);
  }
  if (value.findings.length || !value.checks.length) throw new ReviewerInfrastructureFailure('Independent PASS has findings or no checks');
  if (!executions.some(execution => execution.exitCode === 0 && isExecutedTestCommand(execution.argv ?? execution.command))) throw new ReviewerInfrastructureFailure('No supported test invocation in a successful reviewer execution block; use a standalone absolute test command');
}
/**
 * Parse a JSON object from a file or (Codex-only review fallback) last.md.
 * Chat is not the implementation or review envelope. Tolerate exactly one JSON
 * object: bare, or wrapped in exactly one markdown code fence. A prose preamble
 * before a single JSON object is tolerated only when the message carries no
 * other JSON; where a machine-readable shell blob is a better interpretation
 * than prose, the reader fails closed rather than guessing.
 */
export function parseStructuredDelivery(text: string, schemaPath: string, classify: 'infrastructure' | 'business' = 'infrastructure'): unknown {
  // The implementation envelope is the agent's own output contract: failing to
  // meet it is a real, correctable failure and must be counted as business.
  // A reviewer verdict is not attributable to the delivery, so its malformed
  // shape stays infrastructure. Conflating these hides real agent failures.
  const fail = (message: string): never => {
    throw classify === 'business' ? new AgentTurnFailure(message) : new ReviewerInfrastructureFailure(message);
  };
  const trimmed = text.trim();
  // A single fenced JSON block is the cleanest form: strip the fence only if the
  // message holds nothing but that block.
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const direct = (() => { try { const v = JSON.parse(trimmed); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; } })();
  if (fence) {
    const inner = fence[1]!.trim();
    const value = JSON.parse(inner); // fails closed if the fence body is not JSON
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Malformed structured delivery: fenced block is not a JSON object (${schemaPath})`);
    return value;
  }
  if (direct) return direct;
  // Prose before a single JSON object: extract exactly the first balanced object
  // and require the rest of the message to be non-JSON prose (never a second
  // object or a shell blob).
  const start = trimmed.indexOf('{');
  if (start < 0) fail(`Malformed structured delivery: no JSON object (${schemaPath})`);
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const c = trimmed[i]!;
    if (escaped) { escaped = false; continue; }
    if (inString) { if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        for (let j = i + 1; j < trimmed.length; j++) {
          if (/\S/.test(trimmed[j]!)) fail(`Malformed structured delivery: content after the JSON object (${schemaPath})`);
        }
        return JSON.parse(trimmed.slice(start, i + 1));
      }
    }
  }
  fail(`Malformed structured delivery: unbalanced JSON (${schemaPath})`);
}

export function reviewVerdictPath(run: Run, name: string): string {
  return path.join(run.home, 'tmp', `${name}-verdict.json`);
}

/** Review contract is a file under isolated HOME/tmp, not the chat message. Codex may still emit JSON last.md via --output-schema; that is a fallback only. */
export function readReviewVerdict(run: Run, name: string, outputFile: string, schemaPath: string): unknown {
  const file = reviewVerdictPath(run, name);
  if (fs.existsSync(file)) {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
      return value;
    } catch {
      throw new ReviewerInfrastructureFailure(`Malformed independent review verdict file (${file})`);
    }
  }
  if (AGENT.id === 'codex' && fs.existsSync(outputFile)) return parseStructuredDelivery(fs.readFileSync(outputFile, 'utf8'), schemaPath);
  throw new ReviewerInfrastructureFailure(`Independent review produced no verdict file (${file}); chat is not the review contract`);
}

export function requireDeliveredImplementation(value: unknown): void {
  assert.ok(value && typeof value === 'object','Missing implementation outcome');
  const outcome = value as {status?:unknown;reason?:unknown};
  assert.ok(typeof outcome.reason === 'string' && outcome.reason.trim(),'Implementation outcome requires a reason');
  if (outcome.status === 'blocked') throw new WorkflowBlocked(outcome.reason);
  assert.equal(outcome.status,'delivered','Unknown implementation outcome');
}
export function requireNoExhaustedWorkflow(run: Run): void {
  const roots=[run.workspace,path.join(run.workspace,'main-repo'),path.join(run.workspace,'inventory-repo')];
  const sources=roots.flatMap(root=>['tracks','missions'].flatMap(family=>['active','pending'].flatMap(stage=>files(path.join(root,'codument',family,stage)))));
  for (const source of sources.filter(file=>/\/(track|mission)\.xnl$/.test(file))) {
    const kind=source.endsWith('/track.xnl') ? 'track' : 'mission';
    const text=fs.readFileSync(source,'utf8');
    const round=resourceRoot(text,kind,runProduct(run).id).attributes?.gap_round;
    const reports=files(path.join(path.dirname(source),'reports')).filter(file=>path.basename(file).startsWith('gap-') && file.endsWith(`-${round}.md`)).map(file=>fs.readFileSync(file,'utf8'));
    const reason=exhaustedGapReason(text,kind,reports,runProduct(run).id);
    if (reason?.startsWith('Harness unsupported:')) throw new Error(reason);
    if (reason) throw new WorkflowBlocked(reason);
  }
}
export async function agentTurn(run: Run, prompt: string, name: string, authoredTimeoutMs: number, extraArgs: string[] = [], access: 'write' | 'read-only' | 'acceptance' = 'write') {
  // The runtime's declared scale is applied here, once, so call sites keep the
  // authored bound and the factor stays reviewable in one place.
  const timeoutMs = Math.round(authoredTimeoutMs * AGENT.timeoutScale);
  const log = path.join(run.root, `logs/${name}.jsonl`);
  const outputFile = path.join(access === 'write' ? run.workspace : path.join(run.home, 'tmp'), `.e2e-${name}-last.md`);
  const guidance = pythonRuntimeGuidance(run.env.UV_PYTHON) + (access === 'read-only' ? REVIEW_EXECUTION_GUIDANCE : '');
  const invocation = agentInvocation(run, guidance + prompt, name, outputFile, log, extraArgs);
  writeJson(path.join(run.root, `${name}-invocation.json`), { agent: AGENT.id, model: MODEL, effort: EFFORT, argv: invocation.argv, authoredTimeoutMs, timeoutScale: AGENT.timeoutScale, timeoutMs });
  const acceptanceEnv = {};
  const sandboxMode = access === 'acceptance' ? 'acceptance' : access === 'read-only' ? 'review' : true;
  let result;
  try {
    result = await execute({ argv: sandbox(run, invocation.argv, sandboxMode), cwd: run.workspace, env: { ...invocation.env, ...applicationEnvironment(run,`agent-${name}`), ...acceptanceEnv }, log, timeoutMs, input: invocation.input });
  } catch (error) {
    throw new AgentTransportFailure(`Agent ${name} transport failed before a completed turn: ${String(error)}`);
  }
  // Evidence lives wherever the runtime actually wrote it; the process log stays
  // the raw transport record and is never silently substituted for evidence.
  const evidence = AGENT.evidencePath(run, name, log);
  const events = readEvents(evidence);
  const nativeExecutions = readNativeExecutions(run, events.threadId);
  const executionSource = nativeExecutions.length ? 'native-session' : 'cli-events';
  if (nativeExecutions.length) events.executions = nativeExecutions;
  writeJson(path.join(run.root, `${name}-receipt.json`), { ...result, ...events, executionSource, evidencePath: evidence });
  if (result.code || events.failed) {
    // A provider/transport fault is infrastructure, not a business answer: it
    // must not be charged to the correction budget or fed back as a defect.
    if (events.transportFailure) throw new AgentTransportFailure(`Agent ${name} transport failed mid-turn: ${events.failureSummary ?? 'no summary'}; see ${log}`);
    // Empty visible chat is not a delivery contract. Workspace files, Track
    // state and review verdict files bind; the final model message does not.
    if (!/runtime_turn_completed_without_final_output/i.test(events.failureSummary ?? '')) {
      throw new AgentTurnFailure(`Agent ${name} failed: exit=${result.code}; see ${log}`);
    }
  }
  const previousThreads = fs.readdirSync(run.root).filter(f => f.endsWith('-receipt.json') && f !== `${name}-receipt.json`).flatMap(name => {
    const f = path.join(run.root,name);
    const receipt = JSON.parse(fs.readFileSync(f,'utf8'));
    return typeof receipt.threadId === 'string' ? [receipt.threadId] : [];
  });
  assertFreshThread(events.threadId,previousThreads);
  return { ...result, ...events, outputFile, executionSource };
}

export function auditModels(run: Run) {
  const { contexts, note } = AGENT.auditModels(run);
  writeJson(path.join(run.root, 'model-audit.json'), { agent: AGENT.id, expectedModel: MODEL, expectedEffort: EFFORT, observationScope: note, contexts });
  assert.ok(contexts.length > 0, 'No observed model identity');
  // Only the models the runtime actually exposes can be asserted. Where a
  // runtime exposes no model (or no effort), the value stays unknown rather
  // than being treated as a match. A model invoked by provider/model ref
  // resolves to a bare id in provider evidence; both denote the same model.
  const accepted = AGENT.modelIdentities;
  const observed = contexts.filter(c => c.model !== null);
  assert.ok(observed.length > 0, 'No observed model identity');
  assert.ok(observed.every(c => accepted.includes(c.model!)), `Model drift (including child sessions): observed ${[...new Set(observed.map(c => c.model))].join(', ')}, expected one of ${accepted.join(', ')}`);
  const efforts = contexts.filter(c => c.effort !== null);
  if (EFFORT === null) assert.equal(efforts.length, 0, 'Runtime exposed an effort that this profile does not assert');
  else assert.ok(efforts.length > 0 && efforts.every(c => c.effort === EFFORT), 'Model drift (including child sessions)');
  return contexts;
}
export async function probe(candidate: string, auth: string | undefined) {
  const run = createRun(candidate, 'model-probe');
  console.log(JSON.stringify({ phase: 'model-probe', root: run.root }));
  try {
    await setup(run); installAuthentication(run, auth);
    const receipt = await agentTurn(run,
      `Do not implement anything. ${productGuidance(runProduct(run),run.workspace)} Read the installed SKILL.md, run ${runProduct(run).command} -h, and report its binary path and product version. Do not call any other model or modify any global installation.`,
      'probe', 180_000);
    assert.ok(receipt.executions.some(e => e.exitCode===0 && e.command.includes(runProduct(run).command) && /(-h|--help)/.test(e.command)), 'Probe must successfully execute the CLI; an agent refusal is not success');
    auditModels(run);
    writeJson(path.join(run.root, 'result.json'), { status: 'passed', agent: AGENT.id, model: MODEL, receipt, root: run.root });
    return run.root;
  } catch (error) {
    writeJson(path.join(run.root, 'result.json'), { status: 'infrastructure-failed', agent: AGENT.id, model: MODEL, error: String(error), root: run.root });
    throw error;
  } finally { removeAuthentication(run); }
}

function basePrompt(run: Run): string {
  return `This is an authorized, non-interactive real engineering E2E. Work only in this temporary business workspace. Read each repository's AGENTS.md. ${productGuidance(runProduct(run),run.workspace)} Preserve all configured hook, gap-loop, attractor and fresh verification requirements. ${AGENT.identityGuidance()} Do not modify the installed Skills, test harness, auth or configuration. Do not install globally, publish, or touch other projects. Safe product choices are preapproved; do not stop merely to request implementation approval. Genuine unsafe decisions must be reported as blocked. Deliver real runnable code, not only prose.\n` +
    'Mutable application databases, queues and logs belong under the supplied E2E_DATA_DIR. '
    'Both E2E_DATA_DIR and DATA_FILE are absolute paths that already exist: E2E_DATA_DIR is a directory, '
    'and DATA_FILE is a ready-to-use file path whose parent directory already exists. '
    'Use each as given and never join them together - in particular DATA_FILE is not a filename relative to E2E_DATA_DIR. '
    'Honor these environment variables for server runs. Tests use their own unique directories under isolated HOME/tmp. '
    'Keep all source, dependencies and built deliverables unchanged during acceptance.\n';
}
export async function verifyWorkflow(run: Run, stage: 'plan' | 'implementation', attempt: number) {
  const listLog = path.join(run.root, `logs/list-${stage}-${attempt}.json`);
  assert.equal((await execute({ argv: sandbox(run, [run.bin, 'list', '--json']), cwd: run.workspace, env: run.env, log: listLog })).code, 0);
  const listing = JSON.parse(fs.readFileSync(listLog, 'utf8'));
  assert.ok(Array.isArray(listing), 'List must preserve its JSON contract (pending Tracks are not listed by default)');
  const tracks = files(path.join(run.workspace, 'codument/tracks')).filter(p => p.endsWith('/track.xnl'));
  assert.ok(tracks.length > 0);
  if (tracks.filter(file=>file.includes('/tracks/archived/')).length > 1) throw new Error('Harness unsupported: multiple archived deliveries require baseline-aware promotion verification; not a business failure or PASS');
  for (const [index, track] of tracks.entries()) {
    const text = fs.readFileSync(track, 'utf8');
    const {root,selector} = trackValidationSelection(path.relative(run.workspace,path.dirname(track)),text,runProduct(run).id);
    // Legacy-compatible show/list only expose active Tracks. The exact validation
    // below admits pending and active resources through the lifecycle owner.
    if (stage === 'implementation') assert.equal(root.attributes?.status,'completed', 'Track root must actually be completed');
    const result = await execute({ argv: sandbox(run, [run.bin, 'validate', selector, '--strict']), cwd: run.workspace, env: run.env, log: path.join(run.root, `logs/${stage}-${attempt}-${index}-strict.log`) });
    assert.equal(result.code, 0, 'strict validation failed');
  }
}
export async function runCase(candidate: string, auth: string | undefined, caseId: string, resumeRoot?: string) {
  if (!['todo','blog','ecommerce','stream-pipeline-ai-agent','nested-mission-agent'].includes(caseId)) throw new Error(`Unknown case: ${caseId}`);
  const nested = caseId === 'nested-mission-agent';
  const stream = caseId === 'stream-pipeline-ai-agent';
  const run = resumeRoot ? loadRun(resumeRoot,candidate,caseId) : createRun(candidate, caseId);
  if (resumeRoot && fs.existsSync(path.join(run.root,'terminal-policy.json'))) throw new Error('Configured workflow block requires an explicit new policy decision; generic resume is forbidden');
  const policyFile = path.join(run.root, 'workflow-policy.json');
  if (resumeRoot) assertWorkflowPolicySnapshot(fs.existsSync(policyFile) ? JSON.parse(fs.readFileSync(policyFile, 'utf8')) : undefined);
  const unlock = lockRun(run);
  if (resumeRoot) writeJson(path.join(run.root,`resume-provenance-${Date.now()}.json`),{harnessSha256:treeHash(import.meta.dir),resumedAt:new Date().toISOString()});
  console.log(JSON.stringify({ phase: 'real-case', caseId, root: run.root }));
  const priorFile = path.join(run.root,fs.existsSync(path.join(run.root,'result.json')) ? 'result.json' : 'progress.json');
  const prior = resumeRoot && fs.existsSync(priorFile) ? JSON.parse(fs.readFileSync(priorFile,'utf8')) : undefined;
  const attempts: Record<string, unknown>[] = prior?.attempts ?? [];
  const start = Date.now();
  let status = 'failed';
  try {
    if (stream) await preparePython(run);
    if(!resumeRoot) await setup(run, nested);
    if (!stream && !nested) {
    const { probePersistentBrowser } = await import('./ego-probe');
    await probePersistentBrowser(run);
    }
    installAuthentication(run, auth);
    const repositories = nested ? ['main-repo','inventory-repo'].map(p => path.join(run.workspace,p)) : [run.workspace];
    if (!resumeRoot) writeJson(policyFile, WORKFLOW_POLICY);
    assertWorkflowPolicySnapshot(fs.existsSync(policyFile) ? JSON.parse(fs.readFileSync(policyFile, 'utf8')) : undefined);
    const checkTrackPolicies = () => {
      assertWorkflowPolicySnapshot(fs.existsSync(policyFile) ? JSON.parse(fs.readFileSync(policyFile, 'utf8')) : undefined);
      for (const repo of repositories) {
        const tracks = files(path.join(repo, 'codument/tracks')).filter(file => file.endsWith('/track.xnl'));
        assert.ok(tracks.length, 'E2E workflow policy requires authored Tracks');
        for (const file of tracks) assertTrackWorkflowPolicy(fs.readFileSync(file, 'utf8'),WORKFLOW_POLICY,runProduct(run).id);
      }
    };
    const configurationFile = path.join(run.root,'configuration-baseline.json');
    const configuration = () => Object.fromEntries(repositories.flatMap(repo => files(path.join(repo,'codument/config')).map(file => [path.relative(run.workspace,file),fs.readFileSync(file,'utf8')])));
    if (!resumeRoot) writeJson(configurationFile,configuration());
    const configuredBaseline = JSON.parse(fs.readFileSync(configurationFile,'utf8'));
    const checkConfiguration = () => assert.deepEqual(configuration(),configuredBaseline,'Configured hooks/profiles/knowledge settings changed');
    if(!resumeRoot) for (const name of ['request.md', 'acceptance.md']) fs.copyFileSync(path.join(caseRoot, caseId, name), path.join(run.workspace, name));
    checkRequirements(run,path.join(caseRoot,caseId));
    const skillRoots = runProduct(run).id==='legacy' ? repositories.map(repo=>runSkillRoot({...run,workspace:repo})) : [runSkillRoot(run)];
    const skillHashes = skillRoots.map(treeHash);
    let planPassed = false;
    const handoffFile = path.join(run.root, 'planning-handoff.json');
    let planned: PlannedIdentity[] | undefined = fs.existsSync(handoffFile) ? JSON.parse(fs.readFileSync(handoffFile, 'utf8')) : undefined;
    // A saved delivery identity must be admitted before any recovery model turn.
    // Invalid deltas may be repaired; missing/replaced authorities are not new plans.
    const observePlan = () => observePlannedIdentities(run.workspace,repositories,runProduct(run).id);
    if (planned) reconcilePlannedIdentities(planned, observePlan());
    let feedback = attempts.filter(a => a.status === 'failed').map(a => String(a.error ?? '')).join('\n');
    const externalFeedback = path.join(run.root,'external-feedback.json');
    if (fs.existsSync(externalFeedback)) feedback += '\nIndependent outer acceptance findings: '+JSON.stringify(JSON.parse(fs.readFileSync(externalFeedback,'utf8')));
    const previous = fs.readdirSync(run.root).flatMap(n=>{const m=/^(?:plan|implementation|review)-(\d+)-invocation\.json$/.exec(n);return m?[Number(m[1])]:[];});
    const offset = resumeRoot ? Math.max(-1,...previous)+1 : 0;
    if(resumeRoot){
      for(const name of ['result.json','progress.json']){const f=path.join(run.root,name);if(fs.existsSync(f))fs.renameSync(f,path.join(run.root,`prior-${offset}-${name}`));}
      try { for(const repo of repositories) await verifyWorkflow({...run,workspace:repo},'plan',1000+offset*10+repositories.indexOf(repo)); checkTrackPolicies(); if(nested) await verifyNestedBindings(run, `resume-plan-${offset}`); planPassed=true; } catch(error){ feedback='Resume observed incomplete planning: '+String(error); }
    }
    if(offset >= 3) throw new Error('Three-attempt budget exhausted; resume cannot reset it');
    for (let attempt = offset; attempt < 3; attempt++) {
      const row: Record<string, unknown> = { attempt, first: attempt === offset, startedAt: new Date().toISOString() };
      attempts.push(row);
      try {
        checkConfiguration();
        checkRequirements(run,path.join(caseRoot,caseId));
        if (planPassed) {
          try { checkTrackPolicies(); } catch (error) {
            planPassed = false;
            feedback = 'Repair the existing plan to retain the declared E2E workflow policy: ' + String(error);
          }
        }
        if (!planPassed) {
          const recovery = planned ? 'Repair and validate the existing plan only; do not create replacement resources or implement application code.\n' + implementationHandoff(observePlan(),runProduct(run).command) :
            'If an earlier planning attempt left resources, repair those in place instead of creating duplicate plans.\n';
          row.plan = await agentTurn(run, basePrompt(run) + workflowPolicyGuidance() +
            (nested ? 'Read request.md and acceptance.md. For this turn only plan the root and child Missions in main-repo and inventory-repo using plan-mission, create implementation Tracks and establish reciprocal links, selected-tasks and ProjectRef bindings. Validate every Track. Follow the version-specific tool routing above. Do not implement application code yet. Plans are approved for the next turn after validation.\n' :
            'Read request.md and acceptance.md. For this turn only: use plan-track to create or repair a complete implementation Track. Use deterministic scaffolding and validate the track. Do not implement code yet. The plan is preapproved for the next turn once it validates.\n') + recovery + feedback,
          `plan-${attempt}`, 1800_000);
          for (const repo of repositories) await verifyWorkflow({ ...run, workspace: repo }, 'plan', nested ? attempt * 10 + repositories.indexOf(repo) : attempt);
          checkTrackPolicies();
          if (nested) await verifyNestedBindings(run, `plan-${attempt}`);
          if (planned) reconcilePlannedIdentities(planned, observePlan());
          planPassed = true;
        }
        checkConfiguration();
        checkTrackPolicies();
        const currentPlan = observePlan();
        if (planned) reconcilePlannedIdentities(planned, currentPlan);
        else { planned = currentPlan; writeJson(handoffFile, planned); }
        row.implementation = await agentTurn(run, basePrompt(run) + workflowPolicyGuidance() +
          'Read request.md and acceptance.md. Plans are approved. Use ' + (nested ? 'impl-mission to orchestrate the root and child Missions and impl-track for code work' : 'impl-track') + ' to implement the entire application, run its tests, finish all required hooks and independent verification, and complete delivery through CLI. Implement the real acceptance boundary; do not mock or hard-code expected results. For nested Missions keep the independent child backlog active after the selected root delivery completes. If any mandatory hook exhausts with on_exhausted=block or requires a genuine policy decision, leave that evidence on the Track and stop. Do not reset/increase rounds or bypass blocked hooks to satisfy an outer retry. Delivery is observed from Track completion, validation, tests and hook receipts; do not put a JSON envelope in the chat message.\n' + implementationHandoff(currentPlan,runProduct(run).command) + feedback,
        `implementation-${attempt}`, 3600_000);
        requireNoExhaustedWorkflow(run);
        reconcilePlannedIdentities(planned, observePlan());
        checkTrackPolicies();
        if (!nested) await verifyWorkflow(run, 'implementation', attempt);
        if (stream) await prepareStreamDependencies(run,attempt);
        const deliveredFingerprint = sourceFingerprint(run);
        if (!nested && !stream) {
          const pkg = JSON.parse(fs.readFileSync(path.join(run.workspace, 'package.json'), 'utf8'));
          for (const name of ['test', 'typecheck', 'build']) {
            assert.ok(pkg.scripts?.[name], `Missing required ${name} script`);
            const checked = await execute({ argv: sandbox(run, [process.execPath, 'run', name]), cwd: run.workspace, env: applicationEnvironment(run,`scripts-${attempt}-${name}`), log: path.join(run.root, `logs/app-${attempt}-${name}.log`), timeoutMs: 180_000 });
            assert.equal(checked.code, 0, `Application ${name} failed`);
          }
        }
        // Generated business implementations are judged by the fresh reviewer
        // below, not a fixed API/DOM/bridge script authored in this harness.
        row.business = { policy: 'fresh-agent-semantic-v1', deterministicBusinessOracle: false };
        assert.equal(sourceFingerprint(run),deliveredFingerprint,'Application scripts or business verification modified delivered source/build/dependencies');
        const schema = path.join(run.root, 'review-schema.json');
        const reviewSchemaJson = { type: 'object', additionalProperties: false, properties: { verdict: { type: 'string', enum: ['PASS','FAIL'] }, findings: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'string' } } }, required: ['verdict','findings','checks'] };
        writeJson(schema, reviewSchemaJson);
        const reviewContract = AGENT.schemaArgs(schema, JSON.stringify(reviewSchemaJson));
        const reviewName = `review-${attempt}`;
        const verdictFile = reviewVerdictPath(run, reviewName);
        const sourceBeforeReview = sourceFingerprint(run);
        const reviewReceipt = await agentTurn(run, basePrompt(run) + workflowPolicyGuidance() +
          'The delivered workspace is OS-enforced read-only. Keep temporary reviewer environments and diagnostic files under isolated HOME/tmp. Existing .e2e-venv may be used read-only. Do not pip install the original source path: package builds write build/ and egg-info there even when the destination venv is elsewhere. If a clean package build is necessary, copy the exact delivered inputs into a temporary build directory, never repair that copy, and keep all build/install writes there. Test the original delivery whenever possible; identify any copied build and its original source in the evidence. Changes to delivered dependencies/build outputs also count as source drift.\n' +
          'You are a fresh independent acceptance reviewer, NOT the implementer. Read request.md, acceptance.md, actual source, Track and evidence. Run real checks yourself. Review completeness including functional browser UI, auth/ownership, domain and engineering alignment, configured hooks/gap-loop/fresh checks. Detect fake test scripts, hardcoded outputs, forged receipts, and missing functionality. Do not repair or change project source, requirements, reports or workflow state. Execute app tests directly; do not invoke track verify, task transitions or other commands that write workflow receipts. The implementation phase already owns those mandatory hooks; this outer review independently checks them without rewriting evidence. Give FAIL for any substantive gap; report exact paths and runnable evidence. Do not trust prior agent summaries. ' +
          'The verdict and the two arrays are mutually exclusive by contract: verdict=PASS requires an empty findings array and at least one check, and verdict=FAIL requires at least one finding. Record positive observations as checks, and reserve findings strictly for defects that justify FAIL; a PASS verdict with any finding is rejected as malformed. ' +
          `Write that verdict as a JSON object to this exact file using a file write tool: ${verdictFile}\nDo not put the verdict in the chat message; chat may be ordinary prose. The file is the only review contract.\n` + reviewContract.promptSuffix,
        reviewName, 1200_000, reviewContract.args, 'read-only');
        row.review = reviewReceipt;
        assertReviewerSourceUnchanged(sourceBeforeReview,sourceFingerprint(run));
        const review = readReviewVerdict(run, reviewName, reviewReceipt.outputFile, schema);
        requireIndependentReview(review, reviewReceipt.executions);
        if (!nested && !stream) {
          row.ui = await awaitUiGate(run,caseId,attempt,sourceBeforeReview);
          assert.equal(sourceFingerprint(run),sourceBeforeReview,'Browser-tested source drifted');
        }
        auditModels(run);
        checkConfiguration();
        checkRequirements(run,path.join(caseRoot,caseId));
        assert.deepEqual(skillRoots.map(treeHash), skillHashes, 'Installed Skills modified');
        row.status = 'passed'; status = 'passed';
        break;
      } catch (error) {
        if (!(error instanceof WorkflowBlocked)) {
          try { requireNoExhaustedWorkflow(run); } catch (observed) { if (observed instanceof WorkflowBlocked || String(observed).includes('Harness unsupported:')) error=observed; }
        }
        row.status = 'failed'; row.error = String(error);
        if (error instanceof WorkflowBlocked) {
          row.status = 'blocked'; status = 'blocked';
          writeJson(path.join(run.root,'terminal-policy.json'),{kind:'configured-workflow-block',caseId,attempt,reason:error.message,rawResultPreserved:true,resumeAllowed:false});
          break;
        }
        // Authentication/model/transport failures are not business corrections.
        if (isInfrastructureFailure(error)) {
          row.status = 'infrastructure-failed'; status = 'infrastructure-failed'; break;
        }
        feedback = `External acceptance found this failure; diagnose and fix the implementation, not the requirement or tests: ${String(error)}. Inspect your local test outputs and task evidence. Continue from the existing Track; do not fabricate receipts.`;
      } finally {
        row.finishedAt = new Date().toISOString();
        row.elapsedMs = Date.now() - Date.parse(String(row.startedAt));
        writeJson(path.join(run.root, 'progress.json'), { status: 'running', attempts, root: run.root });
      }
    }
    const result = { status, caseId, product:runProduct(run).id, agent: AGENT.id, model: MODEL, effort: EFFORT, attempts, resumed: Boolean(resumeRoot), firstPass: isFirstPass(attempts), elapsedMs: (prior?.elapsedMs ?? 0) + Date.now() - start, root: run.root };
    writeJson(path.join(run.root, 'result.json'), result);
    return result;
  } catch (error) {
    writeJson(path.join(run.root, 'result.json'), { status: 'infrastructure-failed', caseId, attempts, error: String(error), root: run.root });
    throw error;
  } finally { removeAuthentication(run); unlock(); }
}
