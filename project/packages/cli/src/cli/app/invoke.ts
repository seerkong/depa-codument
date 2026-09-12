import { demoCommand } from '../commands/demo';
import { statusCommand } from '../commands/status';
import { argvSchema, type CommandResult, type CommandRuntime } from '../contracts/command';
import { isThreadSortMode } from '../effects/codex';
import type { PageObjectSelector, PageWorkflowSelector } from '../resources/definitions';
import {
  DEFAULT_PAGE_CONTROL_AGENT,
  injectedThreadIdFor,
  inspectServe,
  readPageControlRecord,
  runServeSupervisor,
  updatePageControlThread,
  type ServeSupervisorInput,
} from '../runtime/serve-process';

function serveEffect(runtime: CommandRuntime): NonNullable<CommandRuntime['serveProcess']> {
  if (!runtime.serveProcess) throw new Error('Serve process effect is not configured');
  return runtime.serveProcess;
}

function codexEffect(runtime: CommandRuntime): NonNullable<CommandRuntime['codex']> {
  if (!runtime.codex) throw new Error('Codex effect is not configured');
  return runtime.codex;
}

function httpFetch(runtime: CommandRuntime): typeof fetch {
  if (!runtime.httpFetch) throw new Error('HTTP client effect is not configured');
  return runtime.httpFetch;
}

export function invokeDemo(runtime: CommandRuntime, name?: string): CommandResult {
  return demoCommand(argvSchema.parse(name ? [name] : [], ['demo'], runtime));
}

export function invokeStatus(runtime: CommandRuntime): Promise<CommandResult> {
  return statusCommand(argvSchema.parse([], ['status'], runtime));
}

export async function invokeServeLifecycle(
  runtime: CommandRuntime,
  input: ServeSupervisorInput,
): Promise<CommandResult> {
  const agent = input.agent ?? runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
  const output = await runServeSupervisor(
    runtime.workspace(),
    {
      ...input,
      agent,
      injectedThreadId: input.injectedThreadId ?? injectedThreadIdFor(agent),
    },
    serveEffect(runtime),
  );
  return {
    code: output.running || input.action === 'stop' || input.action === 'status' ? 0 : 1,
    data: { ...output },
    message: output.message,
  };
}

export async function invokePageFillDemo(
  runtime: CommandRuntime,
  input: { text: string; number: number },
): Promise<CommandResult> {
  if (!Number.isFinite(input.number)) {
    return {
      code: 1,
      data: { command: 'page-fill-demo', accepted: false },
      message: 'number is required',
    };
  }
  const effect = serveEffect(runtime);
  const inspected = await inspectServe(
    runtime.workspace(),
    effect,
    runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT,
  );
  if (!inspected.running || !inspected.record) {
    return {
      code: 1,
      data: { command: 'page-fill-demo', accepted: false },
      message: 'serve is not running. Start it with serve_start first.',
    };
  }
  const response = await httpFetch(runtime)(new URL('/api/page/fill-demo', inspected.record.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: input.text, number: input.number }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.accepted !== true) {
    return {
      code: 1,
      data: { command: 'page-fill-demo', accepted: false, ...body },
      message: typeof body.message === 'string' ? body.message : 'serve rejected the fill',
    };
  }
  return {
    code: 0,
    data: {
      command: 'page-fill-demo',
      accepted: true,
      delivered: typeof body.delivered === 'number' ? body.delivered : 0,
      text: input.text,
      number: input.number,
    },
    message: 'form demo filled',
  };
}

export async function invokePageWorkflowStart(
  runtime: CommandRuntime,
  input: { fqn: string; workflowInput: unknown; selector?: PageWorkflowSelector },
): Promise<CommandResult> {
  const effect = serveEffect(runtime);
  const inspected = await inspectServe(runtime.workspace(), effect, runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT);
  if (!inspected.running || !inspected.record) {
    return { code: 1, data: { command: 'PageWorkflow.start', accepted: false }, message: 'serve is not running. Start it with serve_start first.' };
  }
  const response = await httpFetch(runtime)(new URL('/api/page-workflows/start', inspected.record.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fqn: input.fqn, selector: input.selector, input: input.workflowInput }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.accepted !== true) {
    return { code: 1, data: { command: 'PageWorkflow.start', accepted: false, ...body }, message: typeof body.message === 'string' ? body.message : 'serve rejected the PageWorkflow' };
  }
  return { code: 0, data: { command: 'PageWorkflow.start', accepted: true, run: body.run }, message: 'PageWorkflow accepted' };
}

export async function invokePageWorkflowGet(runtime: CommandRuntime, runId: string): Promise<CommandResult> {
  const effect = serveEffect(runtime);
  const inspected = await inspectServe(runtime.workspace(), effect, runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT);
  if (!inspected.running || !inspected.record) {
    return { code: 1, data: { command: 'PageWorkflow.get', ok: false }, message: 'serve is not running. Start it with serve_start first.' };
  }
  const response = await httpFetch(runtime)(new URL(`/api/page-workflows/${encodeURIComponent(runId)}`, inspected.record.url));
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.ok !== true) {
    return { code: 1, data: { command: 'PageWorkflow.get', ...body }, message: typeof body.message === 'string' ? body.message : 'PageWorkflow run not found' };
  }
  return { code: 0, data: { command: 'PageWorkflow.get', ...body }, message: 'PageWorkflow receipt loaded' };
}

export async function invokePageObjectAction(
  runtime: CommandRuntime,
  input: { operationRef: string; actionInput: unknown; selector?: PageObjectSelector },
): Promise<CommandResult> {
  const effect = serveEffect(runtime);
  const inspected = await inspectServe(runtime.workspace(), effect, runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT);
  if (!inspected.running || !inspected.record) {
    return { code: 1, data: { command: 'PageObject.invoke', ok: false }, message: 'serve is not running. Start it with serve_start first.' };
  }
  const response = await httpFetch(runtime)(new URL('/api/page-objects/action', inspected.record.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operationRef: input.operationRef, selector: input.selector, input: input.actionInput }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.ok !== true) {
    return { code: 1, data: { command: 'PageObject.invoke', ...body }, message: typeof body.message === 'string' ? body.message : 'PageObject action failed' };
  }
  return { code: 0, data: { command: 'PageObject.invoke', ...body }, message: 'PageObject action completed' };
}

export async function invokeCodexList(
  runtime: CommandRuntime,
  query: { searchTerm?: string; sortMode?: string; cwd?: string | string[]; useStateDbOnly?: boolean } = {},
): Promise<CommandResult> {
  try {
    const threads = await codexEffect(runtime).listThreads({
      searchTerm: query.searchTerm,
      sortMode: isThreadSortMode(query.sortMode) ? query.sortMode : undefined,
      cwd: query.cwd,
      useStateDbOnly: query.useStateDbOnly,
    });
    return {
      code: 0,
      data: {
        command: 'codex-list',
        count: threads.length,
        threads,
      },
      message: threads.length ? `loaded ${threads.length} threads` : 'no Codex threads',
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'codex-list', count: 0, threads: [] },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function invokePageControlStatus(runtime: CommandRuntime): Promise<CommandResult> {
  const agent = runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
  const record = await readPageControlRecord(runtime.workspace(), agent);
  return {
    code: 0,
    data: {
      command: 'page-control',
      agent,
      running: Boolean(record),
      threadId: record?.threadId ?? '',
      workspaceId: record?.workspaceId ?? '',
      threadLocked: record?.threadLocked === true,
      url: record?.url ?? '',
    },
    message: record?.threadLocked && record.threadId
      ? `locked ${record.threadId}`
      : 'thread is not locked',
  };
}

export async function invokePageControlLock(
  runtime: CommandRuntime,
  input: { threadId?: string | null; workspaceId?: string | null; threadLocked: boolean },
): Promise<CommandResult> {
  const agent = runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
  const record = await updatePageControlThread(runtime.workspace(), agent, input);
  if (!record) {
    return {
      code: 1,
      data: { command: 'page-control', accepted: false, agent },
      message: 'serve control file is missing; start serve first',
    };
  }
  return {
    code: 0,
    data: {
      command: 'page-control',
      accepted: true,
      agent,
      threadId: record.threadId ?? '',
      workspaceId: record.workspaceId ?? '',
      threadLocked: record.threadLocked,
    },
    message: record.threadLocked ? `locked ${record.threadId}` : 'unlocked',
  };
}

export async function invokeCodexSend(
  runtime: CommandRuntime,
  input: { message: string; threadId?: string },
): Promise<CommandResult> {
  const message = input.message.trim();
  if (!message) {
    return {
      code: 1,
      data: { command: 'codex-send', accepted: false },
      message: 'message is required',
    };
  }
  try {
    const agent = runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
    const locked = await readPageControlRecord(runtime.workspace(), agent);
    const threadId = input.threadId
      || (locked?.threadLocked ? locked.threadId ?? undefined : undefined);
    const result = await codexEffect(runtime).sendMessage({
      message,
      threadId,
    });
    return {
      code: 0,
      data: {
        command: 'codex-send',
        accepted: result.accepted,
        threadId: result.threadId,
        via: result.via,
        turnId: result.turnId ?? '',
      },
      message: `accepted via ${result.via}`,
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'codex-send', accepted: false },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function egoEffect(runtime: CommandRuntime): NonNullable<CommandRuntime['ego']> {
  if (!runtime.ego) throw new Error('Ego effect is not configured');
  return runtime.ego;
}

export async function invokeEgoOpen(runtime: CommandRuntime, url: string): Promise<CommandResult> {
  if (!url.trim()) {
    return { code: 1, data: { command: 'ego-open', accepted: false }, message: 'url is required' };
  }
  try {
    const session = await egoEffect(runtime).openSession(url.trim());
    return {
      code: 0,
      data: { command: 'ego-open', accepted: true, sessionId: session.id, url: session.url },
      message: `ego session ${session.id}`,
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'ego-open', accepted: false },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function invokeEgoCall(
  runtime: CommandRuntime,
  input: { sessionId: string; operation: string; arguments?: Record<string, unknown> },
): Promise<CommandResult> {
  try {
    const result = await egoEffect(runtime).call(input.sessionId, input.operation, input.arguments ?? {});
    return {
      code: 0,
      data: { command: 'ego-call', accepted: true, result },
      message: 'ego call accepted',
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'ego-call', accepted: false },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
