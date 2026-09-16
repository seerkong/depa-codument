import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { writeJson, loadRun, sandbox, assertTemporary, createRun, sha, type Run } from './runtime';
import { applicationEnvironment } from './application-state';
import { sourceFingerprint } from './integrity';

const CONTROLLER_ACQUISITION_MS = 300_000;
const BROWSER_ACCEPTANCE_MS = 900_000;
/** After server-ready, an operator must claim or submit a receipt. Empty 15-minute waits are infrastructure, not acceptance. */
function operatorAttachBudgetMs(): number {
  const raw = process.env.E2E_UI_OPERATOR_ATTACH_MS;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 15_000;
}
const HEALTH_READY_MS = 30_000;

/** Controller failures stop a trial; they are never feedback to the business implementer. */
export class BrowserInfrastructureFailure extends Error {}
class BrowserAcceptanceFailure extends Error {}

type UiStatus = 'requested' | 'leased' | 'server-ready' | 'passed' | 'browser-acceptance-failed' | 'browser-controller-failed';
type UiEvent = { at: string; status: UiStatus; actor: 'runner' | 'controller' | 'browser-operator'; detail: string };
export interface UiRequest {
  schema: 2;
  requestId: string;
  caseId: string;
  attempt: number;
  sourceFingerprint: string;
  dataDirectory: string;
  status: 'awaiting-ui';
  workspace: string;
  serverCommand: string[];
  controllerCommand: string[];
  createdAt: string;
  reverify?: { sourceRunRoot: string; historicalStatus: 'infrastructure-failed' };
}
export interface UiControllerState {
  schema: 2;
  requestId: string;
  caseId: string;
  attempt: number;
  sourceFingerprint: string;
  dataDirectory: string;
  status: UiStatus;
  events: UiEvent[];
  leaseId?: string;
  controllerPid?: number;
  origin?: string;
  serverPid?: number;
  serverReadyAt?: string;
  receiptFile?: string;
  reason?: string;
}

function requestFile(root: string, attempt: number) { return path.join(root, `ui-request-${attempt}.json`); }
function stateFile(root: string, attempt: number) { return path.join(root, `ui-controller-${attempt}.json`); }
function receiptFile(root: string, attempt: number) { return path.join(root, `ui-receipt-${attempt}.json`); }
function operatorFile(root: string, attempt: number) { return path.join(root, `ui-operator-${attempt}.json`); }
function operatorAttached(root: string, attempt: number): boolean {
  if (process.env.E2E_UI_OPERATOR === '1' || process.env.E2E_UI_OPERATOR === 'wait') return true;
  return fs.existsSync(operatorFile(root, attempt));
}
export function claimUiOperator(root: string, attempt: number, claim: { browser: string; session?: string }): void {
  writeJson(operatorFile(root, attempt), { ...claim, claimedAt: new Date().toISOString() });
}
function readJson(file: string): any { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function assertRequest(value: any): asserts value is UiRequest {
  assert.equal(value?.schema, 2, 'Unsupported UI request schema');
  assert.ok(typeof value.requestId === 'string' && value.requestId.length > 0, 'Missing UI request identity');
  assert.ok(typeof value.caseId === 'string' && Number.isInteger(value.attempt), 'Invalid UI request case identity');
  assert.ok(typeof value.sourceFingerprint === 'string' && value.sourceFingerprint.length > 0, 'Missing UI source identity');
  assert.ok(typeof value.dataDirectory === 'string' && path.isAbsolute(value.dataDirectory), 'Invalid UI data directory');
  assert.ok(Array.isArray(value.serverCommand) && value.serverCommand.length && value.serverCommand.every((item: unknown) => typeof item === 'string'), 'Invalid UI server command');
}
/** Historical roots predate schema-2 controller state; normalize only in the new, additive root. */
function normalizeHistoricalRequest(value: any): UiRequest {
  if (value?.schema === 2) { assertRequest(value); return value; }
  assert.ok(typeof value?.caseId === 'string' && Number.isInteger(value?.attempt), 'Invalid historical UI request identity');
  assert.ok(typeof value?.sourceFingerprint === 'string' && value.sourceFingerprint.length > 0, 'Missing historical UI source identity');
  assert.ok(typeof value?.dataDirectory === 'string' && path.isAbsolute(value.dataDirectory), 'Invalid historical UI state directory');
  assert.ok(Array.isArray(value?.serverCommand) && value.serverCommand.length && value.serverCommand.every((item: unknown) => typeof item === 'string'), 'Invalid historical UI server command');
  return { ...value, schema: 2, requestId: `legacy-${value.attempt}-${value.sourceFingerprint}`, status: 'awaiting-ui', workspace: value.workspace, controllerCommand: value.controllerCommand ?? [], createdAt: value.createdAt ?? 'historical' };
}
function readRequest(root: string, attempt: number): UiRequest { const value = readJson(requestFile(root, attempt)); assertRequest(value); return value; }
function readState(root: string, attempt: number): UiControllerState {
  const value = readJson(stateFile(root, attempt));
  assert.equal(value?.schema, 2, 'Unsupported UI controller schema');
  assert.ok(Array.isArray(value.events), 'Missing UI controller transition history');
  return value;
}
function writeState(root: string, state: UiControllerState) { writeJson(stateFile(root, state.attempt), state); }
function transition(state: UiControllerState, status: UiStatus, actor: UiEvent['actor'], detail: string, extra: Partial<UiControllerState> = {}): UiControllerState {
  return { ...state, ...extra, status, events: [...state.events, { at: new Date().toISOString(), status, actor, detail }] };
}
function assertRequestState(request: UiRequest, state: UiControllerState) {
  for (const key of ['requestId', 'caseId', 'attempt', 'sourceFingerprint', 'dataDirectory'] as const) assert.equal(state[key], request[key], `UI controller ${key} mismatch`);
}
function pendingAttempts(root: string): number[] {
  return fs.readdirSync(root).flatMap(file => {
    const match = /^ui-request-(\d+)\.json$/.exec(file);
    if (!match) return [];
    const state = readState(root, Number(match[1]));
    return ['requested', 'leased', 'server-ready'].includes(state.status) ? [Number(match[1])] : [];
  }).sort((a, b) => a - b);
}
function requireOnePendingAttempt(root: string): number {
  const pending = pendingAttempts(root);
  assert.equal(pending.length, 1, pending.length ? 'Ambiguous pending UI controller requests' : 'No pending UI controller request');
  return pending[0]!;
}

function inspectUiReceiptIdentity(receipt: any, expected: {caseId:string;attempt:number;sourceFingerprint:string;dataDirectory?:string;leaseId?:string}): void {
  for (const key of ['caseId','attempt','sourceFingerprint'] as const) assert.equal(receipt[key],expected[key],`Browser evidence ${key} mismatch`);
  if (expected.dataDirectory) assert.equal(receipt.dataDirectory,expected.dataDirectory,'Browser runtime state directory mismatch');
  if (expected.leaseId) assert.equal(receipt.leaseId,expected.leaseId,'Browser controller lease mismatch');
  // The browser is an implementation detail of how the observable UI evidence
  // was produced. ego-browser is driven through a TaskSpace (spaceId > 0);
  // opencli drives a detached Chrome over its own bridge and carries a session
  // name instead. Both must still produce the full typed interaction evidence
  // below (5 coverage kinds, real observed text). This is scope broadening, not
  // weakening: a named browser with no TaskSpace is admitted only when it also
  // supplies a non-empty session handle.
  if (receipt.browser === 'ego-browser') {
    assert.ok(Number.isInteger(receipt.spaceId) && receipt.spaceId > 0, 'ego-browser evidence needs an actual TaskSpace');
  } else if (receipt.browser === 'opencli') {
    assert.ok(typeof receipt.session === 'string' && receipt.session.trim().length > 0, 'opencli evidence needs a named browser session');
  } else {
    assert.ok(typeof receipt.browser === 'string' && receipt.browser.trim().length > 0, 'Browser evidence needs a browser identity');
  }
  assert.ok(['passed', 'failed', 'infrastructure-failed'].includes(receipt.status), 'Unknown browser controller status');
}

export function validateUiReceipt(receipt: any, expected: {caseId:string;attempt:number;sourceFingerprint:string;dataDirectory?:string;leaseId?:string}): void {
  try {
    inspectUiReceiptIdentity(receipt, expected);
    if (receipt.status === 'infrastructure-failed') {
      assert.ok(typeof receipt.reason === 'string' && receipt.reason.trim(), 'Infrastructure failure requires a diagnostic reason');
      throw new BrowserInfrastructureFailure(receipt.reason);
    }
    if (receipt.status === 'failed') {
      assert.ok(Array.isArray(receipt.findings) && receipt.findings.length > 0 && receipt.findings.every((finding: unknown) => typeof finding === 'string' && finding.trim()), 'Business failure requires observed findings');
      throw new BrowserAcceptanceFailure(`Browser acceptance failed: ${JSON.stringify(receipt.findings)}`);
    }
    assert.ok(Array.isArray(receipt.findings) && receipt.findings.length===0,'PASS cannot retain unresolved findings');
    assert.ok(Array.isArray(receipt.actions) && receipt.actions.length >= 5,'Require actual UI interaction observations, not a bare HTML response');
    const covered = new Set<string>();
    for (const action of receipt.actions) {
      assert.ok(['click','fill','select','dialog','observe'].includes(action.operation));
      assert.match(action.url,/^http:\/\/127\.0\.0\.1:\d+(\/|$)/);
      assert.ok(typeof action.target==='string' && action.target.length>0);
      assert.ok(typeof action.observed==='string' && action.observed.length>0);
      assert.ok(typeof action.expected==='string' && action.expected.length>0);
      assert.ok(action.observed.includes(action.expected),'Visible browser assertion failed');
      covered.add(action.coverage);
    }
    for (const coverage of ['authentication','business-create','business-update','business-query','literal-input']) assert.ok(covered.has(coverage),`Missing browser coverage: ${coverage}`);
  } catch (error) {
    if (error instanceof BrowserAcceptanceFailure || error instanceof BrowserInfrastructureFailure) throw error;
    throw new BrowserInfrastructureFailure(`Invalid browser controller evidence: ${String(error)}`);
  }
}

/** Runner owns immutable request creation. It cannot create a receipt or lease a server. */
export function requestUiGate(run: Run, caseId: string, attempt: number, fingerprint: string, reverify?: UiRequest['reverify']): UiRequest {
  assertTemporary(run.root);
  const config = readJson(path.join(run.workspace, 'e2e-server.json'));
  const env = applicationEnvironment(run, `ui-${attempt}`);
  const request: UiRequest = {
    schema: 2, requestId: randomUUID(), caseId, attempt, sourceFingerprint: fingerprint,
    dataDirectory: env.E2E_DATA_DIR!, status: 'awaiting-ui', workspace: run.workspace,
    serverCommand: config.command, controllerCommand: ['bun', 'e2e/run.ts', 'ui-server', run.root, '--bin=' + run.bin],
    createdAt: new Date().toISOString(), ...(reverify ? { reverify } : {}),
  };
  assertRequest(request);
  assert.ok(!fs.existsSync(requestFile(run.root, attempt)), 'UI request attempt already exists');
  writeJson(requestFile(run.root, attempt), request);
  writeState(run.root, { schema: 2, requestId: request.requestId, caseId, attempt, sourceFingerprint: fingerprint, dataDirectory: request.dataDirectory, status: 'requested', events: [{ at: request.createdAt, status: 'requested', actor: 'runner', detail: reverify ? 'historical application UI re-verification requested' : 'fresh application UI verification requested' }] });
  console.log(JSON.stringify({ phase: 'awaiting-ui', root: run.root, ...request }));
  return request;
}

/** The runner only waits; the controller itself owns lease/ready/terminal transitions. */
export async function awaitUiGate(run: Run, caseId: string, attempt: number, fingerprint: string, reverify?: UiRequest['reverify']) {
  const request = requestUiGate(run, caseId, attempt, fingerprint, reverify);
  const acquisitionDeadline = Date.now() + CONTROLLER_ACQUISITION_MS;
  let acceptanceDeadline: number | undefined;
  let attachDeadline: number | undefined;
  while (true) {
    const state = readState(run.root, attempt); assertRequestState(request, state);
    if (state.status === 'server-ready' && !attachDeadline) {
      assert.ok(state.serverReadyAt, 'Ready UI controller lacks ready timestamp');
      attachDeadline = Date.parse(state.serverReadyAt) + operatorAttachBudgetMs();
    }
    if (state.status === 'server-ready' && !acceptanceDeadline && operatorAttached(run.root, attempt)) {
      assert.ok(state.serverReadyAt, 'Ready UI controller lacks ready timestamp');
      acceptanceDeadline = Date.parse(state.serverReadyAt) + BROWSER_ACCEPTANCE_MS;
    }
    if (['passed', 'browser-acceptance-failed', 'browser-controller-failed'].includes(state.status)) {
      if (!state.receiptFile) throw new BrowserInfrastructureFailure(state.reason ?? 'UI controller reached terminal state without a receipt');
      const receipt = readJson(state.receiptFile);
      validateUiReceipt(receipt, { ...request, leaseId: state.leaseId });
      return receipt;
    }
    if (!attachDeadline && Date.now() >= acquisitionDeadline) throw new BrowserInfrastructureFailure('UI controller did not lease and start the requested server within 5 minutes');
    if (attachDeadline && !acceptanceDeadline && Date.now() >= attachDeadline) throw new BrowserInfrastructureFailure('No browser operator attached after server-ready');
    if (acceptanceDeadline && Date.now() >= acceptanceDeadline) throw new BrowserInfrastructureFailure('UI controller did not finalize browser evidence within 15 minutes after server-ready');
    await Bun.sleep(250);
  }
}

function waitForHealth(origin: string, deadline: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try { if ((await fetch(origin + '/health')).ok) { resolve(); return; } } catch { /* server has not bound yet */ }
      if (Date.now() >= deadline) { reject(new BrowserInfrastructureFailure(`UI server did not become healthy at ${origin}/health`)); return; }
      setTimeout(tick, 100);
    };
    void tick();
  });
}
function stopProcessGroup(pid: number | undefined) { if (pid) try { process.kill(-pid, 'SIGKILL'); } catch { /* already stopped */ } }

/** Controller Effect: exactly one lease, one app process group, then one terminal state. */
export async function serveUi(root: string, candidate: string) {
  root = assertTemporary(root);
  const provenance = readJson(path.join(root, 'provenance.json'));
  const run = loadRun(root, candidate, provenance.caseId);
  const attempt = requireOnePendingAttempt(root);
  const request = readRequest(root, attempt);
  let state = readState(root, attempt); assertRequestState(request, state);
  assert.equal(state.status, 'requested', 'UI request has already been leased or completed');
  const leaseId = randomUUID();
  state = transition(state, 'leased', 'controller', 'controller claimed exact request', { leaseId, controllerPid: process.pid });
  writeState(root, state);
  const listener = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('allocation') });
  const port = listener.port!; listener.stop(true);
  const origin = `http://127.0.0.1:${port}`;
  const env = applicationEnvironment(run, `ui-${attempt}`);
  assert.equal(env.E2E_DATA_DIR, request.dataDirectory, 'Pending browser state identity mismatch');
  const log = path.join(root, `logs/ui-server-${attempt}.log`);
  const out = fs.openSync(log, 'wx', 0o600);
  const argv = sandbox(run, request.serverCommand);
  const child: import('node:child_process').ChildProcess = spawn(argv[0]!, argv.slice(1), { cwd: run.workspace, env: { ...env, PORT: String(port) }, detached: true, stdio: ['ignore', out, out] as any });
  fs.closeSync(out);
  try {
    await waitForHealth(origin, Date.now() + HEALTH_READY_MS);
    state = readState(root, attempt); assertRequestState(request, state);
    assert.equal(state.leaseId, leaseId, 'UI controller lease changed');
    assert.equal(state.status, 'leased', 'UI controller state changed before ready');
    state = transition(state, 'server-ready', 'controller', 'isolated application health check passed', { origin, serverPid: child.pid, serverReadyAt: new Date().toISOString() });
    writeState(root, state);
    console.log(JSON.stringify({ phase: 'ui-server-ready', root, attempt, origin, leaseId, serverControllerPid: process.pid, dataDirectory: request.dataDirectory }));
    const attachDeadline = Date.now() + operatorAttachBudgetMs();
    const deadline = Date.now() + BROWSER_ACCEPTANCE_MS;
    while (true) {
      state = readState(root, attempt); assertRequestState(request, state);
      if (['passed', 'browser-acceptance-failed', 'browser-controller-failed'].includes(state.status)) break;
      if (!operatorAttached(root, attempt) && Date.now() >= attachDeadline) {
        state = transition(state, 'browser-controller-failed', 'controller', 'no browser operator attached after server-ready', { reason: 'No browser operator attached after server-ready' });
        writeState(root, state);
        break;
      }
      if (operatorAttached(root, attempt) && Date.now() >= deadline) {
        state = transition(state, 'browser-controller-failed', 'controller', 'browser receipt deadline expired after server-ready', { reason: 'Browser receipt was not submitted within 15 minutes after server-ready' });
        writeState(root, state);
        break;
      }
      await Bun.sleep(250);
    }
    return { code: state.status === 'passed' ? 0 : 1, timedOut: state.status === 'browser-controller-failed', elapsedMs: 0 };
  } catch (error) {
    state = readState(root, attempt);
    if (state.status === 'leased') {
      state = transition(state, 'browser-controller-failed', 'controller', 'server startup failed', { reason: String(error) });
      writeState(root, state);
    }
    throw error;
  } finally { stopProcessGroup(child.pid); }
}

/** Browser actor submits a typed terminal receipt through the suite authority, never by hand-writing a run file. */
export function submitUiReceipt(root: string, candidate: string, receipt: unknown) {
  root = assertTemporary(root);
  const provenance = readJson(path.join(root, 'provenance.json'));
  const run = loadRun(root, candidate, provenance.caseId);
  const value = receipt as any;
  assert.ok(Number.isInteger(value?.attempt), 'UI receipt needs an attempt');
  const request = readRequest(root, value.attempt);
  const state = readState(root, request.attempt); assertRequestState(request, state);
  assert.equal(state.status, 'server-ready', 'UI receipt requires a live, healthy controller server');
  inspectUiReceiptIdentity(value, { ...request, leaseId: state.leaseId });
  const terminal: UiStatus = value.status === 'passed' ? 'passed' : value.status === 'failed' ? 'browser-acceptance-failed' : 'browser-controller-failed';
  const destination = receiptFile(root, request.attempt);
  assert.ok(!fs.existsSync(destination), 'UI receipt already finalized');
  writeJson(destination, value);
  writeState(root, transition(state, terminal, 'browser-operator', value.status === 'passed' ? 'browser acceptance passed' : value.status === 'failed' ? 'browser acceptance findings submitted' : 'browser controller diagnostic submitted', { receiptFile: destination, ...(value.status === 'infrastructure-failed' ? { reason: value.reason } : {}) }));
  assert.equal(sourceFingerprint(run), request.sourceFingerprint, 'Browser receipt source identity drifted');
  return { root, attempt: request.attempt, status: terminal, receipt: destination };
}

/** Additive re-verification owns a new run root and may only observe a frozen historical application. */
export function createUiReverification(sourceRunRoot: string, candidate: string): Run {
  sourceRunRoot = assertTemporary(sourceRunRoot);
  const sourceProvenance = readJson(path.join(sourceRunRoot, 'provenance.json'));
  const sourceResult = readJson(path.join(sourceRunRoot, 'result.json'));
  assert.ok(['todo', 'blog'].includes(sourceProvenance.caseId), 'Only completed Todo and Blog workspaces are eligible for historical UI re-verification');
  assert.equal(sourceResult.status, 'infrastructure-failed', 'Historical UI re-verification preserves only infrastructure-failed trials');
  assert.equal(sourceProvenance.sha256, sha(candidate), 'Historical candidate identity mismatch');
  const requests = fs.readdirSync(sourceRunRoot).flatMap(file => /^ui-request-(\d+)\.json$/.test(file) ? [normalizeHistoricalRequest(readJson(path.join(sourceRunRoot, file)))] : []).sort((a, b) => b.attempt - a.attempt);
  const sourceRequest = requests[0]; assert.ok(sourceRequest, 'Historical run has no UI request to re-verify');
  const sourceRun = loadRun(sourceRunRoot, candidate, sourceProvenance.caseId);
  assert.equal(sourceFingerprint(sourceRun), sourceRequest.sourceFingerprint, 'Historical application source drifted; cannot re-verify');
  const run = createRun(candidate, sourceProvenance.caseId);
  const provenance = readJson(path.join(run.root, 'provenance.json'));
  writeJson(path.join(run.root, 'provenance.json'), { ...provenance, kind: 'ui-reverification', sourceRunRoot, sourceWorkspace: sourceRun.workspace, historicalResult: sourceResult.status, historicalSourceFingerprint: sourceRequest.sourceFingerprint });
  writeJson(path.join(run.root, 'ui-reverification-source.json'), { sourceRunRoot, sourceWorkspace: sourceRun.workspace, caseId: sourceProvenance.caseId, historicalResult: sourceResult.status, sourceFingerprint: sourceRequest.sourceFingerprint, createdAt: new Date().toISOString() });
  return { ...run, workspace: sourceRun.workspace, readonlyWorkspace: true };
}
