import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';
import { createRun, loadRun, setup, execute, sandbox, installAuthentication, removeAuthentication, codexArgs, readEvents, files, sha, treeHash, writeJson, MODEL, EFFORT, type Run } from './runtime';
import { verifyHttp } from './http-verifier';
import { verifyStream, prepareStreamDependencies } from './stream-verifier';
import { verifyNested } from './nested-verifier';
import { trackValidationSelection, validateArchivedKnowledge, assertPromotedKnowledge, assertPromotedBehaviors, exhaustedGapReason, resourceRoot } from './resource-oracle';
import { assertFreshThread, checkRequirements, lockRun, sourceFingerprint, isFirstPass, isExecutedTestCommand } from './integrity';
import { awaitUiGate } from './ui-gate';
import { preparePython } from './python-runtime';
import { applicationEnvironment } from './application-state';

const caseRoot = path.join(import.meta.dir, 'cases');
class WorkflowBlocked extends Error {}
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
    const round=resourceRoot(text,kind).attributes?.gap_round;
    const reports=files(path.join(path.dirname(source),'reports')).filter(file=>path.basename(file).startsWith('gap-') && file.endsWith(`-${round}.md`)).map(file=>fs.readFileSync(file,'utf8'));
    const reason=exhaustedGapReason(text,kind,reports);
    if (reason?.startsWith('Harness unsupported:')) throw new Error(reason);
    if (reason) throw new WorkflowBlocked(reason);
  }
}
export async function agentTurn(run: Run, codex: string, prompt: string, name: string, timeoutMs: number, extraArgs: string[] = []) {
  const log = path.join(run.root, `logs/${name}.jsonl`);
  const args = codexArgs(run, codex, prompt, name);
  args.splice(args.length - 1, 0, ...extraArgs);
  writeJson(path.join(run.root, `${name}-invocation.json`), { model: MODEL, effort: EFFORT, args, timeoutMs });
  const result = await execute({ argv: sandbox(run, args, true), cwd: run.workspace, env: applicationEnvironment(run,`agent-${name}`), log, timeoutMs });
  const events = readEvents(log);
  writeJson(path.join(run.root, `${name}-receipt.json`), { ...result, ...events });
  if (result.code || events.failed) throw new Error(`Agent ${name} failed: exit=${result.code}; see ${log}`);
  const previousThreads = fs.readdirSync(run.root).filter(f => f.endsWith('-receipt.json') && f !== `${name}-receipt.json`).flatMap(name => {
    const f = path.join(run.root,name);
    const receipt = JSON.parse(fs.readFileSync(f,'utf8'));
    return typeof receipt.threadId === 'string' ? [receipt.threadId] : [];
  });
  assertFreshThread(events.threadId,previousThreads);
  return { ...result, ...events };
}

export function auditModels(run: Run) {
  const contexts: { file: string; model: string; effort: string }[] = [];
  for (const file of files(path.join(run.home, '.codex/sessions')).filter(f => f.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (e.type === 'turn_context') contexts.push({ file, model: e.payload.model, effort: e.payload.effort });
    }
  }
  writeJson(path.join(run.root, 'model-audit.json'), contexts);
  assert.ok(contexts.length > 0, 'No observed model identity');
  assert.ok(contexts.every(c => c.model === MODEL && c.effort === EFFORT), 'Model drift (including child sessions)');
  return contexts;
}
export async function probe(candidate: string, codex: string, auth: string) {
  const run = createRun(candidate, 'model-probe');
  console.log(JSON.stringify({ phase: 'model-probe', root: run.root }));
  try {
    await setup(run); installAuthentication(run, auth);
    const receipt = await agentTurn(run, codex,
      'Do not implement anything. Confirm that the depa-codument Skill is available, read its SKILL.md, run depa-codument -h, and report its binary path and product version. Do not call any other model or modify any global installation.',
      'probe', 180_000);
    assert.ok(receipt.executions.some(e => e.exitCode===0 && e.command.includes('depa-codument') && /(-h|--help)/.test(e.command)), 'Probe must successfully execute the CLI; an agent refusal is not success');
    auditModels(run);
    writeJson(path.join(run.root, 'result.json'), { status: 'passed', receipt, root: run.root });
    return run.root;
  } catch (error) {
    writeJson(path.join(run.root, 'result.json'), { status: 'infrastructure-failed', error: String(error), root: run.root });
    throw error;
  } finally { removeAuthentication(run); }
}

function basePrompt(): string {
  return `This is an authorized, non-interactive real engineering E2E. Work only in this temporary business workspace. Read AGENTS.md and use the installed global depa-codument Skill. Discover current operations through depa-codument commands; do not use legacy codument binary or old per-operation Skill folders. Preserve all configured hook, gap-loop, attractor and fresh verification requirements. Every model invocation including child agents must use ${MODEL}, reasoning ${EFFORT}; do not override to other models. Do not modify the global Skill, test harness, auth or configuration. Do not install globally, publish, or touch other projects. Safe product choices are preapproved; do not stop merely to request implementation approval. Genuine unsafe decisions must be reported as blocked. Deliver real runnable code, not only prose.\n` +
    'Mutable application databases, queues and logs belong under the supplied E2E_DATA_DIR; DATA_FILE names the per-phase JSON store when applicable. Honor these environment variables for server runs. Tests use their own unique directories under isolated HOME/tmp. Keep all source, dependencies and built deliverables unchanged during acceptance.\n';
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
    const {root,id,archived,selector} = trackValidationSelection(path.relative(run.workspace,path.dirname(track)),text);
    // Legacy-compatible show/list only expose active Tracks. The exact validation
    // below admits pending and active resources through the lifecycle owner.
    if (stage === 'implementation') assert.equal(root.attributes?.status,'completed', 'Track root must actually be completed');
    if (archived) {
      // The CLI delta selector deliberately admits active/pending Tracks only.
      // Validate retained historical deltas through the public pure validator,
      // and separately validate the promoted current registry through the CLI.
      for (const family of ['modeling','engineering'] as const) {
        const directory = path.join(path.dirname(track),family+'_deltas');
        const sources = new Map(files(directory).filter(f=>f.endsWith('.xnl')).map(f=>[path.relative(directory,f),fs.readFileSync(f,'utf8')]));
        const findings = validateArchivedKnowledge(sources,family);
        const canonicalRoot = path.join(run.workspace,'codument',family);
        assertPromotedKnowledge(sources,new Map(files(canonicalRoot).filter(f=>f.endsWith('.xnl')).map(f=>[path.relative(canonicalRoot,f),fs.readFileSync(f,'utf8')])),family);
        writeJson(path.join(run.root,`logs/${stage}-${attempt}-${index}-${family}-archived.json`),{selector,findings});
        assert.ok(files(path.join(run.workspace,'codument',family)).some(f=>f.endsWith('.xnl')),`Missing promoted ${family} registry`);
      }
      assert.ok(files(path.join(run.workspace,'codument/behaviors')).some(f=>f.endsWith('.xnl')),'Missing promoted behaviors');
      const readSources = (directory: string) => new Map(files(directory).filter(f=>f.endsWith('.xnl')).map(f=>[path.relative(directory,f),fs.readFileSync(f,'utf8')]));
      assertPromotedBehaviors(readSources(path.join(path.dirname(track),'behavior_deltas')),readSources(path.join(run.workspace,'codument/behaviors')));
    }
    for (const [label, args] of [
      ['strict', ['validate', selector, '--strict']],
      ['modeling', ['modeling', 'validate', ...(archived ? [] : ['--deltas', id])]],
      ['engineering', ['engineering', 'validate', ...(archived ? [] : ['--deltas', id])]],
    ] as const) {
      const result = await execute({ argv: sandbox(run, [run.bin, ...args]), cwd: run.workspace, env: run.env, log: path.join(run.root, `logs/${stage}-${attempt}-${index}-${label}.log`) });
      assert.equal(result.code, 0, `${label} validation failed`);
    }
    for (const kind of ['behavior_deltas', 'modeling_deltas', 'engineering_deltas']) {
      assert.ok(files(path.join(path.dirname(track), kind)).some(p => p.endsWith('.xnl')), `Missing ${kind}`);
    }
  }
}
export async function runCase(candidate: string, codex: string, auth: string, caseId: string, resumeRoot?: string) {
  if (!['todo','blog','ecommerce','stream-pipeline-ai-agent','nested-mission-agent'].includes(caseId)) throw new Error(`Unknown case: ${caseId}`);
  const nested = caseId === 'nested-mission-agent';
  const stream = caseId === 'stream-pipeline-ai-agent';
  const run = resumeRoot ? loadRun(resumeRoot,candidate,caseId) : createRun(candidate, caseId);
  if (resumeRoot && fs.existsSync(path.join(run.root,'terminal-policy.json'))) throw new Error('Configured workflow block requires an explicit new policy decision; generic resume is forbidden');
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
    installAuthentication(run, auth);
    const repositories = nested ? ['main-repo','inventory-repo'].map(p => path.join(run.workspace,p)) : [run.workspace];
    for (const repo of resumeRoot ? [] : repositories) {
      for (const kind of ['modeling','engineering']) {
        const config = path.join(repo,'codument/config',kind+'.xnl');
        const source = fs.readFileSync(config,'utf8');
        assert.match(source,/enabled\s*=\s*(true|false)/);
        fs.writeFileSync(config,source.replace(/enabled\s*=\s*false/,'enabled = true'));
      }
    }
    const configurationFile = path.join(run.root,'configuration-baseline.json');
    const configuration = () => Object.fromEntries(repositories.flatMap(repo => files(path.join(repo,'codument/config')).map(file => [path.relative(run.workspace,file),fs.readFileSync(file,'utf8')])));
    if (!resumeRoot) writeJson(configurationFile,configuration());
    const configuredBaseline = JSON.parse(fs.readFileSync(configurationFile,'utf8'));
    const checkConfiguration = () => assert.deepEqual(configuration(),configuredBaseline,'Configured hooks/profiles/knowledge settings changed');
    if(!resumeRoot) for (const name of ['request.md', 'acceptance.md']) fs.copyFileSync(path.join(caseRoot, caseId, name), path.join(run.workspace, name));
    checkRequirements(run,path.join(caseRoot,caseId));
    const skillRoot = path.join(run.home, '.agents/skills/depa-codument');
    const skillHash = treeHash(skillRoot);
    let planPassed = false;
    let feedback = attempts.filter(a => a.status === 'failed').map(a => String(a.error ?? '')).join('\n');
    const externalFeedback = path.join(run.root,'external-feedback.json');
    if (fs.existsSync(externalFeedback)) feedback += '\nIndependent outer acceptance findings: '+JSON.stringify(JSON.parse(fs.readFileSync(externalFeedback,'utf8')));
    const previous = fs.readdirSync(run.root).flatMap(n=>{const m=/^(?:plan|implementation|review)-(\d+)-invocation\.json$/.exec(n);return m?[Number(m[1])]:[];});
    const offset = resumeRoot ? Math.max(-1,...previous)+1 : 0;
    if(resumeRoot){
      for(const name of ['result.json','progress.json']){const f=path.join(run.root,name);if(fs.existsSync(f))fs.renameSync(f,path.join(run.root,`prior-${offset}-${name}`));}
      try { for(const repo of repositories) await verifyWorkflow({...run,workspace:repo},'plan',1000+offset*10+repositories.indexOf(repo)); planPassed=true; } catch(error){ feedback='Resume observed incomplete planning: '+String(error); }
    }
    if(offset >= 3) throw new Error('Three-attempt budget exhausted; resume cannot reset it');
    for (let attempt = offset; attempt < 3; attempt++) {
      const row: Record<string, unknown> = { attempt, first: attempt === offset, startedAt: new Date().toISOString() };
      attempts.push(row);
      try {
        checkConfiguration();
        checkRequirements(run,path.join(caseRoot,caseId));
        if (!planPassed) {
          row.plan = await agentTurn(run, codex, basePrompt() +
            (nested ? 'Read request.md and acceptance.md. For this turn only plan the root and child Missions in main-repo and inventory-repo using plan-mission, create implementation Tracks and establish reciprocal links, selected-tasks and ProjectRef bindings. The legacy skill names in request.md are historical; use the current global Skill. Do not implement application code yet. Plans are approved for the next turn after validation.\n' :
            'Read request.md and acceptance.md. For this turn only: use plan-track to create a complete implementation Track including BehaviorPatch, Modeling delta (domain/backend/surface), and Engineering delta (at least three knowledge kinds). Modeling and Engineering are enabled. Use deterministic scaffolding and validate track plus both delta sets. Do not implement code yet. The plan is preapproved for the next turn once it validates.\n') + feedback,
          `plan-${attempt}`, 1800_000);
          for (const repo of repositories) await verifyWorkflow({ ...run, workspace: repo }, 'plan', nested ? attempt * 10 + repositories.indexOf(repo) : attempt);
          planPassed = true;
        }
        checkConfiguration();
        const implementationSchema = path.join(run.root,'implementation-schema.json');
        writeJson(implementationSchema,{type:'object',additionalProperties:false,properties:{status:{type:'string',enum:['delivered','blocked']},reason:{type:'string'}},required:['status','reason']});
        row.implementation = await agentTurn(run, codex, basePrompt() +
          'Read request.md and acceptance.md. Plans are approved. Use ' + (nested ? 'impl-mission to orchestrate the root and child Missions and impl-track for code work' : 'impl-track') + ' to implement the entire application, run its tests, finish all required hooks and independent verification, and complete delivery through CLI. Implement the real acceptance boundary; do not mock or hard-code expected results. For nested Missions keep the independent child backlog active after the selected root delivery completes. If any mandatory hook exhausts with on_exhausted=block or requires a genuine policy decision, return status=blocked with the exact reason. Do not reset/increase rounds or bypass blocked hooks to satisfy an outer retry. Return delivered only after the real delivery gates complete.\n' + feedback,
        `implementation-${attempt}`, 3600_000,['--output-schema',implementationSchema]);
        requireNoExhaustedWorkflow(run);
        requireDeliveredImplementation(JSON.parse(fs.readFileSync(path.join(run.workspace,`.e2e-implementation-${attempt}-last.md`),'utf8')));
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
        if (nested) row.business = await verifyNested(run,attempt);
        else if (stream) row.business = await verifyStream(run,attempt);
        else row.business = await verifyHttp(run, caseId, attempt);
        assert.equal(sourceFingerprint(run),deliveredFingerprint,'Application scripts or business verification modified delivered source/build/dependencies');
        const schema = path.join(run.root, 'review-schema.json');
        writeJson(schema, { type: 'object', additionalProperties: false, properties: { verdict: { type: 'string', enum: ['PASS','FAIL'] }, findings: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'string' } } }, required: ['verdict','findings','checks'] });
        const sourceBeforeReview = sourceFingerprint(run);
        const reviewReceipt = await agentTurn(run, codex, basePrompt() +
          'Keep temporary reviewer environments and diagnostic files under the isolated HOME/tmp, not inside the delivered workspace. Existing .e2e-venv may be used read-only. Changes to delivered dependencies/build outputs also count as source drift.\n' +
          'You are a fresh independent acceptance reviewer, NOT the implementer. Read request.md, acceptance.md, actual source, Track and evidence. Run real checks yourself. Review completeness including functional browser UI, auth/ownership, domain and engineering alignment, configured hooks/gap-loop/fresh checks. Detect fake test scripts, hardcoded outputs, forged receipts, and missing functionality. Do not repair or change project source, requirements, reports or workflow state. Execute app tests directly; do not invoke track verify, task transitions or other commands that write workflow receipts. The implementation phase already owns those mandatory hooks; this outer review independently checks them without rewriting evidence. Give FAIL for any substantive gap; report exact paths and runnable evidence. Do not trust prior agent summaries. Return the specified JSON verdict.',
        `review-${attempt}`, 1200_000, ['--output-schema', schema]);
        row.review = reviewReceipt;
        assert.equal(sourceFingerprint(run),sourceBeforeReview,'Independent reviewer modified delivered source');
        assert.ok(reviewReceipt.executions.some(e=>e.exitCode===0 && isExecutedTestCommand(e.command)),'Reviewer must execute a successful test/typecheck/build command; curl versions, source searches and prose are not execution evidence');
        const review = JSON.parse(fs.readFileSync(path.join(run.workspace, `.e2e-review-${attempt}-last.md`), 'utf8'));
        assert.equal(review.verdict, 'PASS', `Independent review failed: ${JSON.stringify(review.findings)}`);
        assert.ok(review.checks.length > 0, 'Reviewer provided no execution evidence');
        if (!nested && !stream) {
          row.ui = await awaitUiGate(run,caseId,attempt,sourceBeforeReview);
          assert.equal(sourceFingerprint(run),sourceBeforeReview,'Browser-tested source drifted');
        }
        auditModels(run);
        checkConfiguration();
        checkRequirements(run,path.join(caseRoot,caseId));
        assert.equal(treeHash(skillRoot), skillHash, 'Global Skill modified');
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
        feedback = `External acceptance found this failure; diagnose and fix the implementation, not the requirement or tests: ${String(error)}. Inspect your local test outputs and task evidence. Continue from the existing Track; do not fabricate receipts.`;
        // Authentication/model/transport failures are not business corrections.
        if (String(error).includes('Harness unsupported:') || String(error).includes('Agent ') && String(error).includes('failed: exit=')) { status = 'infrastructure-failed'; break; }
      } finally {
        writeJson(path.join(run.root, 'progress.json'), { status: 'running', attempts, root: run.root });
      }
    }
    const result = { status, caseId, model: MODEL, effort: EFFORT, attempts, resumed: Boolean(resumeRoot), firstPass: isFirstPass(attempts), elapsedMs: (prior?.elapsedMs ?? 0) + Date.now() - start, root: run.root };
    writeJson(path.join(run.root, 'result.json'), result);
    return result;
  } catch (error) {
    writeJson(path.join(run.root, 'result.json'), { status: 'infrastructure-failed', caseId, attempts, error: String(error), root: run.root });
    throw error;
  } finally { removeAuthentication(run); unlock(); }
}
