import { invokeServiceLifecycle, invokeCodexList as invokeCodexListShared, invokePageControlStatus as invokePageControlStatusShared, invokePageControlLock as invokePageControlLockShared, invokeCodexSend as invokeCodexSendShared, invokeEgoOpen as invokeEgoOpenShared, invokeEgoCall as invokeEgoCallShared } from 'halfcode-lite-cli-logic/agent-client';
import { invokePageWorkflowStart as startWorkflow, invokePageWorkflowGet as getWorkflow, invokePageObjectAction as invokeObject } from 'halfcode-lite-skill-app-logic/page-live-client';
import { demoCommand } from '../commands/demo';
import { statusCommand } from '../commands/status';
import { argvSchema, type CommandResult, type CommandRuntime } from '../contracts/command';
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
  return invokeServiceLifecycle(request => runServeSupervisor(
    runtime.workspace(),
    {
      ...request,
      agent,
      injectedThreadId: input.injectedThreadId ?? injectedThreadIdFor(agent),
    },
    serveEffect(runtime),
  ), input);
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

function pageLiveClient(runtime: CommandRuntime) {
  return {
    inspect: () => inspectServe(runtime.workspace(), serveEffect(runtime), runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT),
    fetch: httpFetch(runtime),
  };
}
export function invokePageWorkflowStart(runtime: CommandRuntime, input: Parameters<typeof startWorkflow>[1]) {
  return startWorkflow(pageLiveClient(runtime), input);
}
export function invokePageWorkflowGet(runtime: CommandRuntime, runId: string) {
  return getWorkflow(pageLiveClient(runtime), runId);
}
export function invokePageObjectAction(runtime: CommandRuntime, input: Parameters<typeof invokeObject>[1]) {
  return invokeObject(pageLiveClient(runtime), input);
}

function agentClient(runtime: CommandRuntime) {
  const agent = runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
  return {
    agent, codex: () => codexEffect(runtime),
    ego: () => { if (!runtime.ego) throw new Error('Ego effect is not configured'); return runtime.ego; },
    readControl: () => readPageControlRecord(runtime.workspace(), agent),
    updateControl: (input: Parameters<typeof updatePageControlThread>[2]) => updatePageControlThread(runtime.workspace(), agent, input),
  };
}
export function invokeCodexList(runtime: CommandRuntime, ...args: Tail<Parameters<typeof invokeCodexListShared>>) { return invokeCodexListShared(agentClient(runtime), ...args); }
export function invokePageControlStatus(runtime: CommandRuntime, ...args: Tail<Parameters<typeof invokePageControlStatusShared>>) { return invokePageControlStatusShared(agentClient(runtime), ...args); }
export function invokePageControlLock(runtime: CommandRuntime, ...args: Tail<Parameters<typeof invokePageControlLockShared>>) { return invokePageControlLockShared(agentClient(runtime), ...args); }
export function invokeCodexSend(runtime: CommandRuntime, ...args: Tail<Parameters<typeof invokeCodexSendShared>>) { return invokeCodexSendShared(agentClient(runtime), ...args); }
export function invokeEgoOpen(runtime: CommandRuntime, ...args: Tail<Parameters<typeof invokeEgoOpenShared>>) { return invokeEgoOpenShared(agentClient(runtime), ...args); }
export function invokeEgoCall(runtime: CommandRuntime, ...args: Tail<Parameters<typeof invokeEgoCallShared>>) { return invokeEgoCallShared(agentClient(runtime), ...args); }
type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;
