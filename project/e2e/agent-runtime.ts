/**
 * Agent runtime adapter for the E2E suite.
 *
 * The business gates, acceptance boundary, fingerprints and report semantics are
 * agent-agnostic; codex and eidolon differ only in invocation shape, evidence
 * projection, identity/auth preparation and where sessions/skills live.
 *
 * Nothing here relaxes a gate: a runtime that cannot produce the evidence a gate
 * requires must fail that gate, not skip it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type AgentId = 'codex' | 'eidolon';

/** Structural subset of a run; kept local so this module never imports runtime.ts. */
export interface AgentRun {
  readonly root: string;
  readonly workspace: string;
  readonly home: string;
  readonly env: NodeJS.ProcessEnv;
  readonly readonlyWorkspace?: boolean;
}

export interface Usage { input: number; cached: number; output: number }
export interface CommandExecution { command: string; argv?: readonly string[]; exitCode: number | null }

export interface AgentEvents {
  usage: Usage | null;
  /** Provider counters were estimated/synthesized: never present as measured usage. */
  usageEstimated: boolean;
  /** Output-token counters were absent from the provider projection. */
  outputTokensUnavailable: boolean;
  failed: boolean;
  completed: boolean;
  /**
   * The turn ended because the provider/transport failed, not because the agent
   * produced a wrong answer. A socket drop or a provider-side reset must not be
   * charged against the business correction budget.
   */
  transportFailure: boolean;
  failureSummary: string | null;
  reconnects: string[];
  threadId?: string;
  commands: string[];
  executions: CommandExecution[];
  /** Every model identity observed in provider evidence for this turn. */
  observedModels: string[];
}

export interface AgentModelContext { file: string; model: string | null; effort: string | null }

export interface AgentInvocation {
  argv: string[];
  /** Prompt transport; eidolon reads stdin, codex takes it as the final argument. */
  input: string;
  env: NodeJS.ProcessEnv;
}

export interface AgentRuntime {
  readonly id: AgentId;
  /** The model reference used to invoke this runtime (may be a provider/model ref). */
  readonly model: string;
  /**
   * Every identity string that legitimately denotes this model in provider
   * evidence. A runtime invoked by a provider/model ref resolves to a bare
   * model id, so both forms are the same model and neither is drift.
   */
  readonly modelIdentities: readonly string[];
  readonly effort: string | null;
  /**
   * Multiplier applied to the harness's per-turn calibration bounds. Codex
   * turns were measured against the original bounds; a substitute provider with
   * different latency needs a declared, reviewable factor rather than a silent
   * bound change. Gate semantics and attempt counts are unaffected.
   */
  readonly timeoutScale: number;
  /**
   * Absolute path to the agent executable, resolved in the parent process
   * before any sandbox is applied. The sandboxed PATH is deliberately minimal
   * and cannot be relied on to find an agent installed outside it. The run's
   * own bin dir takes precedence so harness fixtures can substitute it.
   */
  executable(run: AgentRun): string;
  /** Model clause for prompts. Effort is omitted only when the runtime has no such control. */
  identityGuidance(): string;
  invocation(run: AgentRun, prompt: string, name: string, outputFile: string, log: string, extraArgs: string[]): AgentInvocation;
  /**
   * Where this runtime's machine-readable evidence for a turn actually lands.
   * The process stdout log is harness-owned and lives outside the writable
   * sandbox roots, so a runtime that writes its own trace must write it
   * somewhere the sandbox permits.
   */
  evidencePath(run: AgentRun, name: string, log: string): string;
  /** Structured-output contract. Empty args: no chat JSON envelope. */
  schemaArgs(schemaPath: string, schemaJson: string): { args: string[]; promptSuffix: string };
  readEvents(log: string): AgentEvents;
  auditModels(run: AgentRun): { contexts: AgentModelContext[]; note: string };
  initArgs(): string[];
  skillRoot(run: AgentRun): string;
  /** Extra read-only roots the sandbox must allow for this agent's own runtime. */
  sandboxReadPaths(): readonly string[];
  prepare(run: AgentRun, authSource: string | undefined): void;
  cleanup(run: AgentRun): void;
  defaultAuth(): string;
}

/** Resolve an agent binary: a run-local fixture wins, then the known install dir. */
function resolveExecutable(name: string, run: AgentRun | undefined, directory: string): string {
  if (run) {
    const local = path.join(run.root, 'bin', name);
    if (fs.existsSync(local)) return fs.realpathSync(local);
  }
  const candidate = path.join(directory, name);
  return fs.existsSync(candidate) ? fs.realpathSync(candidate) : name;
}

/**
 * Render a value template for a small JSON Schema so a runtime without schema
 * enforcement can be told the exact shape without being shown the schema text
 * itself. Only the keywords the E2E contracts use are interpreted; anything
 * unrecognised yields null, and the shared JSON-validation gate still decides.
 * Arrays render empty (never a placeholder element, which invites filling a
 * list the contract may require to stay empty); their member type is described
 * in prose instead, so nothing inside the template can be echoed as data.
 */
export function skeletonFromSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return null;
  const node = schema as Record<string, unknown>;
  if (Array.isArray(node.enum)) return node.enum[0] ?? null;
  if (node.type === 'array') return [];
  if (node.type === 'object' || node.properties) {
    const properties = (node.properties ?? {}) as Record<string, unknown>;
    const required = Array.isArray(node.required) ? node.required as string[] : Object.keys(properties);
    return Object.fromEntries(required.filter(key => key in properties).map(key => [key, skeletonFromSchema(properties[key])]));
  }
  if (node.type === 'string') return '';
  if (node.type === 'number' || node.type === 'integer') return 0;
  if (node.type === 'boolean') return false;
  return null;
}

/** Describe array member types in prose so the template need not contain one. */
export function arrayMemberNotes(schema: unknown): string[] {
  const notes: string[] = [];
  const visit = (node: unknown, trail: string): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const properties = (record.properties ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(properties)) {
      const path = trail ? `${trail}.${key}` : key;
      const child = value as Record<string, unknown> | null;
      if (child && child.type === 'array') {
        const items = child.items as Record<string, unknown> | undefined;
        const memberType = items && typeof items.type === 'string' ? items.type : 'string';
        notes.push(`"${path}" must be an array of ${memberType}s (never objects).`);
      } else visit(child, path);
    }
  };
  visit(schema, '');
  return notes;
}

/**
 * Provider/transport failures reported by an agent runtime. These are
 * infrastructure: the agent never produced a business answer, so they must not
 * consume the correction budget or be fed back as a business defect.
 */
const TRANSPORT_FAILURE_PATTERNS = [
  /socket connection was closed/i,
  /socket hang up/i,
  /ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/,
  /fetch failed/i,
  /network error/i,
  /rate limit|429|too many requests/i,
  /overloaded|503|502|500\b/,
  /context length|maximum context/i,
  /insufficient balance/i,
  /fetch error 402\b/i,
  /first event exceeded timeout/i,
  /Timeout after \d+ms/,
  /Model not found under provider/i,
  /Unknown model:/i,
];
function isTransportFailure(summary: string | null | undefined): boolean {
  if (!summary) return false;
  return TRANSPORT_FAILURE_PATTERNS.some(pattern => pattern.test(summary));
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${file}`);
    return entry.isDirectory() ? walkFiles(file) : [file];
  }).sort();
}

/**
 * Walk a temp/scratch tree where the agent legitimately creates symlinks (a
 * virtualenv's interpreter links, for example). Symlinks are reported as leaves
 * rather than followed, and never raise: this tree is ephemera, not evidence.
 */
function walkFilesAllowingSymlinks(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink() || !entry.isDirectory()) return [file];
    return walkFilesAllowingSymlinks(file);
  }).sort();
}

function readJsonLines(file: string): Record<string, unknown>[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').flatMap(line => {
    try {
      const value = JSON.parse(line) as unknown;
      return value && typeof value === 'object' ? [value as Record<string, unknown>] : [];
    } catch { return []; }
  });
}

/* ------------------------------------------------------------------ codex */

const CODEX_MODEL = 'gpt-5.6-terra';
const CODEX_EFFORT = 'medium';

const codexRuntime: AgentRuntime = {
  id: 'codex',
  model: CODEX_MODEL,
  modelIdentities: [CODEX_MODEL],
  effort: CODEX_EFFORT,
  timeoutScale: 1,
  executable: (run) => resolveExecutable('codex', run, path.join(os.homedir(), '.bun/bin')),
  identityGuidance: () => `Every model invocation including child agents must use ${CODEX_MODEL}, reasoning ${CODEX_EFFORT}; do not override to other models.`,
  invocation: (run, prompt, _name, outputFile, _log, extraArgs) => ({
    argv: [codexRuntime.executable(run), 'exec', '--ignore-user-config', '--ignore-rules', '--json',
      '-m', CODEX_MODEL, '-c', `model_reasoning_effort="${CODEX_EFFORT}"`,
      '-c', 'approval_policy="never"', '-c', 'sandbox_workspace_write.network_access=true',
      '-c', 'sandbox_workspace_write.exclude_slash_tmp=true', '-c', 'sandbox_workspace_write.exclude_tmpdir_env_var=true',
      '-c', 'shell_environment_policy.inherit="all"',
      // Seatbelt is already applied to the whole process tree; macOS rejects reapplying it.
      '--sandbox', 'danger-full-access', '-C', run.workspace, '--skip-git-repo-check',
      ...extraArgs, '-o', outputFile, prompt],
    input: '',
    env: run.env,
  }),
  evidencePath: (_run, _name, log) => log,
  schemaArgs: (schemaPath) => ({ args: ['--output-schema', schemaPath], promptSuffix: '' }),
  readEvents: (log) => {
    const result: AgentEvents = { usage: null, usageEstimated: false, outputTokensUnavailable: false, failed: false, completed: false, transportFailure: false, failureSummary: null, reconnects: [], commands: [], executions: [], observedModels: [] };
    for (const e of readJsonLines(log) as Record<string, any>[]) {
      if (e.type === 'thread.started') result.threadId = e.thread_id;
      if (e.type === 'turn.started') result.completed = false;
      if (e.type === 'turn.failed') result.failed = true;
      if (e.type === 'error') {
        // Codex emits reconnect notifications as error events even when the same
        // turn subsequently completes. Only this observed nonterminal shape is
        // recoverable; unknown errors and terminal failures remain failures.
        if (typeof e.message === 'string' && /^Reconnecting\.\.\. \d+\/\d+ \(/.test(e.message)) result.reconnects.push(e.message);
        else { result.failed = true; result.failureSummary ??= typeof e.message === 'string' ? e.message : null; }
      }
      if (e.type === 'turn.failed' && typeof e.error === 'string') result.failureSummary ??= e.error;
      if (e.type === 'turn.completed') result.completed = true;
      if (e.type === 'turn.completed' && e.usage) {
        result.usage ??= { input: 0, cached: 0, output: 0 };
        result.usage.input += e.usage.input_tokens;
        result.usage.cached += e.usage.cached_input_tokens ?? 0;
        result.usage.output += e.usage.output_tokens;
      }
      if (e.type === 'item.completed' && e.item?.type === 'command_execution') {
        result.commands.push(e.item.command);
        result.executions.push({ command: e.item.command, exitCode: e.item.exit_code ?? null });
      }
    }
    if (!result.completed) result.failed = true;
    result.transportFailure = result.failed && isTransportFailure(result.failureSummary);
    return result;
  },
  auditModels: (run) => {
    const contexts: AgentModelContext[] = [];
    for (const file of walkFiles(path.join(run.home, '.codex/sessions')).filter(f => f.endsWith('.jsonl'))) {
      for (const e of readJsonLines(file) as Record<string, any>[]) {
        if (e.type === 'turn_context') contexts.push({ file, model: e.payload?.model ?? null, effort: e.payload?.effort ?? null });
      }
    }
    return { contexts, note: 'codex turn_context events across parent and child sessions' };
  },
  initArgs: () => ['init', '--agent=codex', '--json'],
  skillRoot: (run) => path.join(run.home, '.agents/skills/depa-codument'),
  sandboxReadPaths: () => [],
  prepare: (run, authSource) => {
    // Copy only the auth file, never config, history, plugins or personal instructions.
    if (!authSource) throw new Error('Codex runtime requires an auth file');
    const auth = path.join(run.home, '.codex/auth.json');
    fs.copyFileSync(authSource, auth); fs.chmodSync(auth, 0o600);
  },
  cleanup: (run) => {
    const auth = path.join(run.home, '.codex/auth.json');
    if (fs.existsSync(auth)) fs.unlinkSync(auth);
  },
  defaultAuth: () => path.join(os.homedir(), '.codex/auth.json'),
};

/* ---------------------------------------------------------------- eidolon */

/**
 * Default provider/model for the eidolon runtime. Keep the provider-qualified
 * form: a bare model id is not resolvable. Official DeepSeek is not the
 * default; iqingwa is the authorized substitute when that balance is empty.
 */
const EIDOLON_MODEL = process.env.E2E_EIDOLON_MODEL ?? 'deepseek-iqingwa/deepseek-v4.1-flash';
/**
 * Per-turn settle point handed to eidolon. Chosen above the observed spread of
 * normal implementation turns (median 21.5m, max 44.8m across 21 recorded runs)
 * and around the point where this provider has been observed to drop the socket
 * (35.8m), so an over-long turn becomes resumable rather than a transport
 * failure. Overridable for a measured re-calibration.
 */
const EIDOLON_TURN_SETTLE_SECONDS = Number(process.env.E2E_EIDOLON_TURN_SECONDS ?? 2700);
/** eidolon exec has no reasoning-effort control; effort stays unobserved, not assumed. */
const EIDOLON_EFFORT: string | null = null;

const EXIT_CODE_PATTERN = /Process exited with exit code (-?\d+)\./;

/**
 * Only tokenize commands that carry no shell evaluation. Anything with quoting,
 * expansion, redirection or control operators keeps its raw string form so the
 * shared lexical gate decides on exactly what ran.
 */
function plainArgv(command: string): readonly string[] | undefined {
  if (!/^[\w./=:@+,-]+(?: [\w./=:@+,-]+)*$/.test(command)) return undefined;
  return command.split(' ');
}

const eidolonRuntime: AgentRuntime = {
  id: 'eidolon',
  model: EIDOLON_MODEL,
  modelIdentities: [EIDOLON_MODEL, EIDOLON_MODEL.slice(EIDOLON_MODEL.lastIndexOf('/') + 1)],
  effort: EIDOLON_EFFORT,
  // Observed: a reviewer calibration turn took ~190-230s where codex finished
  // inside 300s; the factor is declared here rather than hidden in a call site.
  timeoutScale: 3,
  executable: (run) => resolveExecutable('eidolon', run, path.join(os.homedir(), '.local/bin')),
  identityGuidance: () => `Every model invocation including child agents must use ${EIDOLON_MODEL}; do not override to other models.`,
  invocation: (run, prompt, name, outputFile, log, extraArgs) => ({
    argv: [eidolonRuntime.executable(run), 'exec', '--json',
      '-m', EIDOLON_MODEL,
      // The outer Seatbelt boundary owns isolation; eidolon must not re-apply its own.
      '--yolo',
      '-C', run.workspace,
      // Sessions and traces stay outside the delivered workspace so the source
      // fingerprint only ever covers authored material.
      '--ephemeral',
      '--output-trace', eidolonRuntime.evidencePath(run, name, log),
      '-o', outputFile,
      // eidolon's own long-turn machinery: a turn that is interrupted mid-flight
      // is settled as resumable and continued inside this same invocation rather
      // than being reported as a failed turn. This does not grant another
      // attempt, reset a budget or relax a gate - it only lets one authored turn
      // run to completion.
      '--auto-resume',
      // A per-turn settle point below the observed provider disconnect. Measured
      // basis: 21 recorded implementation turns ran a median of 21.5m and at most
      // 44.8m; this provider dropped the socket at 35.8m in one trial. 45 minutes
      // leaves normal turns untouched while giving a long turn a resumable
      // checkpoint instead of a transport failure.
      '--timeout', String(EIDOLON_TURN_SETTLE_SECONDS),
      // A personal MCP server must never load into an isolated trial.
      '-c', 'mcp_servers={}',
      // A fresh session key per turn keeps threads distinct without reuse.
      '-s', name,
      ...extraArgs,
      // '-' makes the positional a stdin sentinel; the prompt never lands in argv.
      '-'],
    input: prompt,
    env: { ...run.env, EIDOLON_GLOBAL_DIR: path.join(run.home, '.eidolon') },
  }),
  evidencePath: (run, name) => path.join(run.home, 'tmp', `${name}-trace.jsonl`),
  schemaArgs: () => ({
    // eidolon has no --output-schema. Do not pretend the chat message is JSON:
    // E2E contracts are files and workspace facts, not the final model turn.
    args: [],
    promptSuffix: '',
  }),
  readEvents: (log) => {
    const result: AgentEvents = { usage: null, usageEstimated: false, outputTokensUnavailable: false, failed: false, completed: false, transportFailure: false, failureSummary: null, reconnects: [], commands: [], executions: [], observedModels: [] };
    const started = new Map<string, { command: string; argv?: readonly string[] }>();
    const seenSessions = new Set<string>();
    let status: string | undefined;
    for (const e of readJsonLines(log) as Record<string, any>[]) {
      if (e.kind === 'eidolon.headlessExecResult') {
        status = e.status;
        if (typeof e.timing?.sessionId === 'string') result.threadId = e.timing.sessionId;
        if (typeof e.failureSummary === 'string' && e.failureSummary) result.failureSummary ??= e.failureSummary;
      }
      if (e.type === 'session_start' && typeof e.model === 'string' && e.model) result.observedModels.push(e.model);
      if (e.type === 'history') {
        const summary = e.summary ?? {};
        if (e.stream === 'tool_call_start' && typeof summary.toolCallId === 'string') {
          let command = '';
          try {
            const parsed = JSON.parse(summary.argumentsText ?? '{}') as Record<string, unknown>;
            if (typeof parsed.command === 'string') command = parsed.command;
          } catch { /* non-bash tool call */ }
          started.set(summary.toolCallId, { command, argv: plainArgv(command) });
        }
        if (e.stream === 'tool_call_result' && typeof summary.toolCallId === 'string') {
          const open = started.get(summary.toolCallId);
          started.delete(summary.toolCallId);
          const text = typeof summary.resultText === 'string' ? summary.resultText : '';
          const matched = EXIT_CODE_PATTERN.exec(text);
          // A tool result carries an exit code only when the process itself
          // reported one; otherwise the code stays unknown rather than 0.
          const exitCode = summary.isError === false ? 0 : matched ? Number(matched[1]) : null;
          if (open?.command) {
            result.commands.push(open.command);
            result.executions.push({ command: open.command, ...(open.argv ? { argv: open.argv } : {}), exitCode });
          }
        }
      }
      if (e.type === 'session_end') {
        if (typeof e.failureSummary === 'string' && e.failureSummary) result.failureSummary ??= e.failureSummary;
        if (typeof e.timing?.sessionId === 'string') { result.threadId ??= e.timing.sessionId; seenSessions.add(e.timing.sessionId); }
        const usage = e.usage ?? {};
        const isEstimated = usage.is_estimated === true;
        const output = Number(usage.completion_tokens ?? 0);
        result.usage ??= { input: 0, cached: 0, output: 0 };
        result.usage.input += Number(usage.prompt_tokens ?? 0);
        result.usage.cached += Number(usage.cache_read_tokens ?? 0);
        result.usage.output += output;
        result.usageEstimated ||= isEstimated;
        if (output === 0) result.outputTokensUnavailable = true;
        for (const observation of e.providerCacheObservations ?? []) {
          const model = observation?.identity?.model;
          if (typeof model === 'string' && model) result.observedModels.push(model);
        }
        if (status === undefined) status = e.status;
      }
    }
    result.completed = status === 'completed';
    if (status === 'paused_with_progress') result.failed = true;
    if (!result.completed) result.failed = true;
    if (!result.usage) result.usage = null;
    result.transportFailure = result.failed && isTransportFailure(result.failureSummary);
    return result;
  },
  auditModels: (run) => {
    // eidolon has no per-turn context file; provider evidence in each exec trace
    // is the observable identity source. Effort is not exposed by this runtime.
    const contexts: AgentModelContext[] = [];
    // Traces live under home/tmp because the agent process itself writes them
    // inside the sandbox; logs/ holds harness-owned stdout only. That temp root
    // also holds agent-created scratch (e.g. reviewer virtualenvs), so the scan
    // reads regular files and skips symlinked runtime artifacts rather than
    // treating them as evidence.
    for (const file of walkFilesAllowingSymlinks(path.join(run.home, 'tmp'))) {
      if (!/-trace\.jsonl$/.test(file)) continue;
      const models = new Set<string>();
      for (const e of readJsonLines(file) as Record<string, any>[]) {
        if (e.type === 'session_start' && typeof e.model === 'string' && e.model) models.add(e.model);
        if (e.type === 'session_end') {
          for (const observation of e.providerCacheObservations ?? []) {
            const model = observation?.identity?.model;
            if (typeof model === 'string' && model) models.add(model);
          }
        }
      }
      for (const model of models) contexts.push({ file, model, effort: null });
    }
    return { contexts, note: 'eidolon provider-call identities per exec trace; reasoning effort is not observable in this runtime and is not asserted' };
  },
  initArgs: () => ['init', '--agent=eidolon', '--json'],
  skillRoot: (run) => path.join(run.home, '.eidolon/skills/depa-codument'),
  sandboxReadPaths: () => [path.join(os.homedir(), 'ai/eidolon/eidolon-anchor/dist')],
  prepare: (run, authSource) => {
    // Copy only the credential catalog and preset selection, never mcp servers,
    // sessions, skills, projects or personal instructions.
    const target = path.join(run.home, '.eidolon');
    fs.mkdirSync(target, { recursive: true });
    for (const name of ['llm-provider.json', 'agent-present.json']) {
      const source = path.join(authSource ?? path.join(os.homedir(), '.eidolon'), name);
      if (!fs.existsSync(source)) throw new Error(`eidolon runtime requires ${source}`);
      const destination = path.join(target, name);
      fs.copyFileSync(source, destination); fs.chmodSync(destination, 0o600);
    }
  },
  cleanup: (run) => {
    for (const name of ['llm-provider.json', 'agent-present.json']) {
      const file = path.join(run.home, '.eidolon', name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  },
  defaultAuth: () => path.join(os.homedir(), '.eidolon'),
};

const RUNTIMES: Record<AgentId, AgentRuntime> = { codex: codexRuntime, eidolon: eidolonRuntime };

export function resolveAgentRuntime(id: string | undefined): AgentRuntime {
  const key = (id ?? 'codex') as AgentId;
  const runtime = RUNTIMES[key];
  if (!runtime) throw new Error(`Unknown E2E agent runtime: ${id}. Supported: ${Object.keys(RUNTIMES).join(', ')}`);
  return runtime;
}
