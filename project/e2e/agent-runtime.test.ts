import { test, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveAgentRuntime, skeletonFromSchema } from './agent-runtime';
import { parseStructuredDelivery } from './workload';
import type { Run } from './runtime';

function traceFile(records: unknown[]): string {
  const dir = fs.mkdtempSync('/tmp/depa-codument-e2e-unit-');
  const log = path.join(dir, 'trace.jsonl');
  fs.writeFileSync(log, records.map(r => JSON.stringify(r)).join('\n'));
  return log;
}

/** A completed turn as the eidolon runtime actually emits it. */
function eidolonTurn(overrides: { status?: string; completion?: number; estimated?: boolean; results?: unknown[] } = {}) {
  const records: unknown[] = [
    { ts: '2026-09-13T00:00:00.000Z', type: 'session_start', cwd: '/tmp/ws', model: null, profile: null, approvalMode: 'dangerous', mcpEnabled: false, ephemeral: true, additionalWritableRoots: [] },
    ...(overrides.results ?? []),
    { ts: '2026-09-13T00:00:01.000Z', type: 'session_end', status: overrides.status ?? 'completed', failureSummary: null, warningCount: 0, durationMs: 1000,
      finalMessageChars: 4, visibleOutputChars: 4,
      timing: { sessionId: 'plan-0' },
      usage: { prompt_tokens: 100, completion_tokens: overrides.completion ?? 20, total_tokens: 120, cache_creation_tokens: 0, cache_read_tokens: 7, is_estimated: overrides.estimated ?? true },
      providerCacheObservations: [{ identity: { model: 'deepseek-v4.1-flash' } }],
      workflowExecutions: [] },
  ];
  return traceFile(records);
}

test('an unknown agent runtime is rejected rather than silently defaulting', () => {
  expect(resolveAgentRuntime('codex').id).toBe('codex');
  expect(resolveAgentRuntime('eidolon').id).toBe('eidolon');
  expect(resolveAgentRuntime(undefined).id).toBe('codex');
  expect(() => resolveAgentRuntime('gemini')).toThrow('Unknown E2E agent runtime');
});

test('eidolon usage is projected to the shared shape and estimated counters stay flagged', () => {
  const events = resolveAgentRuntime('eidolon').readEvents(eidolonTurn());
  expect(events.completed).toBe(true);
  expect(events.failed).toBe(false);
  expect(events.usage).toEqual({ input: 100, cached: 7, output: 20 });
  // Provider counters that were synthesized must never be presented as measured.
  expect(events.usageEstimated).toBe(true);
  expect(events.observedModels).toEqual(['deepseek-v4.1-flash']);
  expect(events.threadId).toBe('plan-0');
});

test('a zero/unavailable output counter is reported rather than treated as measured zero', () => {
  const events = resolveAgentRuntime('eidolon').readEvents(eidolonTurn({ completion: 0 }));
  expect(events.outputTokensUnavailable).toBe(true);
});

test('only a completed eidolon session counts as success; paused and failed do not', () => {
  const runtime = resolveAgentRuntime('eidolon');
  for (const status of ['failed', 'paused_with_progress']) {
    const events = runtime.readEvents(eidolonTurn({ status }));
    expect(events.completed).toBe(false);
    expect(events.failed).toBe(true);
  }
});

test('a missing or empty trace fails closed instead of reading as a clean turn', () => {
  const runtime = resolveAgentRuntime('eidolon');
  const events = runtime.readEvents('/tmp/definitely-not-a-trace.jsonl');
  expect(events.completed).toBe(false);
  expect(events.failed).toBe(true);
  expect(events.usage).toBeNull();
});

test('eidolon command evidence carries a real exit code and an unparsed failure stays unknown', () => {
  const runtime = resolveAgentRuntime('eidolon');
  const call = (id: string, command: string) => ([
    { type: 'history', stream: 'tool_call_start', summary: { toolName: 'bash', toolCallId: id, argumentsText: JSON.stringify({ command }) } },
  ]);
  const result = (id: string, isError: boolean, text: string) => ([
    { type: 'history', stream: 'tool_call_result', summary: { toolName: 'bash', toolCallId: id, isError, resultChars: text.length, resultText: text } },
  ]);
  const events = runtime.readEvents(eidolonTurn({ results: [
    ...call('a', 'bun run test'), ...result('a', false, 'all pass'),
    ...call('b', 'pytest -q'), ...result('b', true, '(no output)\n\nProcess exited with exit code 3.'),
    ...call('c', 'bun run test | tee out.log'), ...result('c', true, 'something went wrong'),
    ...call('d', 'bun run build'), ...result('d', false, 'ok'),
  ] }));
  expect(events.executions.map(e => e.exitCode)).toEqual([0, 3, null, 0]);
  expect(events.commands).toEqual(['bun run test', 'pytest -q', 'bun run test | tee out.log', 'bun run build']);
  // A plain argv is tokenized for the lexical gate; anything shell-shaped is not.
  expect(events.executions[0]!.argv).toEqual(['bun', 'run', 'test']);
  expect(events.executions[2]!.argv).toBeUndefined();
});

test('an unpaired tool result never fabricates a command execution', () => {
  const events = resolveAgentRuntime('eidolon').readEvents(eidolonTurn({ results: [
    { type: 'history', stream: 'tool_call_result', summary: { toolName: 'bash', toolCallId: 'orphan', isError: false, resultText: 'ok' } },
  ] }));
  expect(events.executions).toEqual([]);
});

test('eidolon does not treat the chat message as a JSON contract', () => {
  const schema = JSON.stringify({ type: 'object', additionalProperties: false, properties: { verdict: { type: 'string', enum: ['PASS', 'FAIL'] }, findings: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'findings', 'checks'] });
  const contract = resolveAgentRuntime('eidolon').schemaArgs('/tmp/s.json', schema);
  expect(contract.args).toEqual([]);
  expect(contract.promptSuffix).toBe('');
  // The codex runtime keeps its real enforcing flag.
  expect(resolveAgentRuntime('codex').schemaArgs('/tmp/s.json', schema).args).toEqual(['--output-schema', '/tmp/s.json']);
});

test('the schema skeleton renders the contract keys without leaking schema keywords', () => {
  expect(skeletonFromSchema({ type: 'object', properties: { verdict: { type: 'string', enum: ['PASS', 'FAIL'] }, findings: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'findings', 'checks'] }))
    .toEqual({ verdict: 'PASS', findings: [], checks: [] });
  expect(skeletonFromSchema({ type: 'object', properties: { status: { type: 'string', enum: ['delivered', 'blocked'] }, reason: { type: 'string' } }, required: ['status', 'reason'] }))
    .toEqual({ status: 'delivered', reason: '' });
  // Unrecognised shapes degrade to null rather than inventing a value.
  expect(skeletonFromSchema(undefined)).toBeNull();
  expect(skeletonFromSchema({ type: 'mystery' })).toBeNull();
});

test('each runtime installs into its own agent skill root', () => {
  const run = { root: '/r', workspace: '/r/ws', home: '/r/home', env: {} };
  expect(resolveAgentRuntime('codex').skillRoot(run)).toBe('/r/home/.agents/skills/depa-codument');
  expect(resolveAgentRuntime('eidolon').skillRoot(run)).toBe('/r/home/.eidolon/skills/depa-codument');
  expect(resolveAgentRuntime('eidolon').initArgs()).toEqual(['init', '--agent=eidolon', '--json']);
  expect(resolveAgentRuntime('codex').initArgs()).toEqual(['init', '--agent=codex', '--json']);
});

test('the eidolon invocation keeps the prompt out of argv and sessions out of the workspace', () => {
  const invocation = resolveAgentRuntime('eidolon').invocation({ root: '/r', workspace: '/r/ws', home: '/r/home', env: {} }, 'SECRET PROMPT', 'plan-0', '/r/home/tmp/out.md', '/r/logs/plan-0.jsonl', []);
  expect(invocation.input).toBe('SECRET PROMPT');
  expect(invocation.argv).not.toContain('SECRET PROMPT');
  expect(invocation.argv).toContain('--ephemeral');
  expect(invocation.argv).toContain('mcp_servers={}');
  expect(invocation.argv.at(-1)).toBe('-');
  expect(invocation.env.EIDOLON_GLOBAL_DIR).toBe('/r/home/.eidolon');
});

test('the eidolon runtime declares the read-only root its own binary needs', () => {
  const paths = resolveAgentRuntime('eidolon').sandboxReadPaths();
  expect(paths.some(p => p.endsWith('dist'))).toBe(true);
  expect(resolveAgentRuntime('codex').sandboxReadPaths()).toEqual([]);
});

test('model audit asserts only the identities the runtime can actually observe', () => {
  const runtime = resolveAgentRuntime('eidolon');
  const root = fs.mkdtempSync('/tmp/depa-codument-e2e-unit-');
  // The agent process writes its own trace under a sandbox-writable root.
  const home = path.join(root, 'home');
  fs.mkdirSync(path.join(home, 'tmp'), { recursive: true });
  fs.writeFileSync(runtime.evidencePath({ root, workspace: path.join(root, 'ws'), home, env: {} }, 'plan-0', '/unused'), fs.readFileSync(eidolonTurn(), 'utf8'));
  const audit = runtime.auditModels({ root, workspace: path.join(root, 'ws'), home, env: {} });
  expect(audit.contexts.map(c => c.model)).toEqual(['deepseek-v4.1-flash']);
  // Effort is not exposed by this runtime and must stay unknown, not assumed.
  expect(audit.contexts.every(c => c.effort === null)).toBe(true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a runtime declares every identity that legitimately denotes its model', () => {
  // Invoked by provider/model ref, evidence reports the resolved bare id, so
  // both forms must be accepted as the same model rather than read as drift.
  // Derived from the runtime so a provider/model change cannot silently leave a
  // stale literal behind in the test.
  const eidolon = resolveAgentRuntime('eidolon');
  expect(eidolon.model).toContain('/');
  expect(eidolon.modelIdentities).toEqual([eidolon.model, eidolon.model.slice(eidolon.model.lastIndexOf('/') + 1)]);
  expect(resolveAgentRuntime('codex').modelIdentities).toEqual([resolveAgentRuntime('codex').model]);
});

test('structured payload parser fails closed on ambiguous output', () => {
  // A bare JSON object parses.
  expect(parseStructuredDelivery('{"verdict":"PASS","findings":[],"checks":["c"]}', '/s')).toEqual({ verdict: 'PASS', findings: [], checks: ['c'] });
  // Prose before a single JSON object is tolerated.
  expect(parseStructuredDelivery('All good. {"verdict":"PASS","findings":[],"checks":["c"]}', '/s')).toEqual({ verdict: 'PASS', findings: [], checks: ['c'] });
  // A clean fenced block parses.
  expect(parseStructuredDelivery('```json\n{"verdict":"PASS","findings":[],"checks":["c"]}\n```', '/s')).toEqual({ verdict: 'PASS', findings: [], checks: ['c'] });
  // Malformed outputs must never synthesize a verdict.
  for (const bad of ['', 'verdict PASS', '{"verdict":"PASS"} x', '{"verdict":"PASS","findings":[1],"checks":["c"]} trailing', '{"a":1} {"b":2}', '```json\n{"verdict":"PASS","findings":[],"checks":["c"]}```\nmore prose']) {
    // Real schemas require verdict/findings/checks; a malformed top-level shape must throw.
    expect(() => parseStructuredDelivery(bad, '/s')).toThrow();
  }
});

test('a provider transport failure is classified as infrastructure, not a business answer', () => {
  const runtime = resolveAgentRuntime('eidolon');
  const withFailure = (summary: string) => traceFile([
    { ts: '2026-09-13T00:00:00.000Z', type: 'session_start', cwd: '/tmp/ws', model: 'deepseek-v4.1-flash', profile: null, approvalMode: 'dangerous', mcpEnabled: false, ephemeral: true, additionalWritableRoots: [] },
    { ts: '2026-09-13T00:00:01.000Z', type: 'session_end', status: 'failed', failureSummary: summary, warningCount: 0, durationMs: 1000, finalMessageChars: 0, visibleOutputChars: 0,
      timing: { sessionId: 'plan-0' }, usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10, cache_creation_tokens: 0, cache_read_tokens: 0, is_estimated: true },
      providerCacheObservations: [], workflowExecutions: [] },
  ]);
  // Observed provider faults must not consume the business correction budget.
  for (const summary of [
    'Error: The socket connection was closed unexpectedly.',
    'fetch failed',
    'read ECONNRESET',
    '429 Too Many Requests',
    '503 Service Unavailable',
    'Error: OpenAI fetch error 402: {"error":{"message":"Insufficient Balance"}}',
    'first event exceeded timeout after 180s',
    'Timeout after 1000ms',
    'Runtime unavailable: Model not found under provider: deepseek-iqingwa/deepseek-v4.1-flash',
    'Error: OpenAI fetch error 400: {"error":{"message":"Unknown model: deepseek-flash"}}',
  ]) {
    const events = runtime.readEvents(withFailure(summary));
    expect(events.failed).toBe(true);
    expect(events.transportFailure).toBe(true);
  }
  // A genuine agent-side failure stays a business correction.
  const business = runtime.readEvents(withFailure('Agent refused: requirement is ambiguous'));
  expect(business.failed).toBe(true);
  expect(business.transportFailure).toBe(false);
  // A clean turn is not a transport failure.
  const ok = runtime.readEvents(eidolonTurn());
  expect(ok.failed).toBe(false);
  expect(ok.transportFailure).toBe(false);
});

test('review verdict is a file; chat is not the implementation envelope', async () => {
  const { readReviewVerdict, reviewVerdictPath } = await import('./workload');
  const { ReviewerInfrastructureFailure } = await import('./integrity');
  const home = fs.mkdtempSync('/tmp/depa-codument-e2e-unit-');
  const run: Run = { root: home, workspace: home, home, bin: path.join(home, 'bin/depa-codument'), env: {} };
  try {
    const missing = () => readReviewVerdict(run, 'review-0', path.join(home, 'missing-last.md'), '/s');
    expect(missing).toThrow(ReviewerInfrastructureFailure);
    expect(missing).toThrow('chat is not the review contract');
    fs.mkdirSync(path.dirname(reviewVerdictPath(run, 'review-0')), { recursive: true });
    fs.writeFileSync(reviewVerdictPath(run, 'review-0'), JSON.stringify({ verdict: 'PASS', findings: [], checks: ['ran tests'] }));
    expect(readReviewVerdict(run, 'review-0', path.join(home, 'unused'), '/s')).toEqual({ verdict: 'PASS', findings: [], checks: ['ran tests'] });
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('the eidolon invocation delegates long-turn settling to its own resume machinery', () => {
  const invocation = resolveAgentRuntime('eidolon').invocation({ root: '/r', workspace: '/r/ws', home: '/r/home', env: {} }, 'p', 'plan-0', '/r/out.md', '/unused', []);
  // A long turn settles as resumable inside the same invocation instead of
  // being reported as a failed turn; this grants no extra attempt.
  expect(invocation.argv).toContain('--auto-resume');
  const i = invocation.argv.indexOf('--timeout');
  expect(i).toBeGreaterThan(-1);
  const seconds = Number(invocation.argv[i + 1]);
  // The settle point sits above the recorded spread of normal implementation
  // turns (median 21.5m, max 44.8m) so ordinary turns are not interrupted.
  expect(seconds).toBeGreaterThan(44.8 * 60);
  // The codex runtime has no auto-resume concept and must not silently gain one.
  expect(resolveAgentRuntime('codex').invocation({ root: '/r', workspace: '/r/ws', home: '/r/home', env: {} }, 'p', 'plan-0', '/r/out.md', '/unused', []).argv).not.toContain('--auto-resume');
});

test('an exhausted or stalled resume still counts as a failed turn', () => {
  // With --auto-resume in effect, ending as paused_with_progress means
  // continuation was exhausted or stopped making progress; that is a real
  // failure, not a resumable success.
  const events = resolveAgentRuntime('eidolon').readEvents(eidolonTurn({ status: 'paused_with_progress' }));
  expect(events.failed).toBe(true);
  expect(events.completed).toBe(false);
  expect(events.transportFailure).toBe(false);
});
