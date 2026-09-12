import { createServiceSupervisor } from 'halfcode-cli-lite-cli-host-capsule/service';
import type { ServiceOutcome } from 'halfcode-cli-lite-cli-host-contract/service';
import { isPidAlive, stopProcess, probeHttpHealth, spawnDetachedProcess, allocateTcpPort } from 'halfcode-cli-lite-cli-host-support/process';
import { httpServiceUrl } from 'halfcode-cli-lite-cli-host-logic/service';
export { isPidAlive } from 'halfcode-cli-lite-cli-host-support/process';
import { fileURLToPath } from 'node:url';
import { WORKSPACE_DIR } from '../../identity';
import type { WorkspaceEffect } from '../effects/workspace';
import { egoTaskSpaceName, serverInstanceId, workspaceSha8 } from './ego-scope';

export const PAGE_CONTROL_AGENTS = ['codex'] as const;
export type PageControlAgent = typeof PAGE_CONTROL_AGENTS[number];
export const DEFAULT_PAGE_CONTROL_AGENT: PageControlAgent = 'codex';
export const DEFAULT_SERVE_HOST = '127.0.0.1';
export const DEFAULT_SERVE_PORT = 0;
export const SERVE_PROTOCOL_VERSION = 2;

export function pageControlRecordPath(agent: PageControlAgent = DEFAULT_PAGE_CONTROL_AGENT): string {
  return `${WORKSPACE_DIR}/page-control-${agent}.json`;
}

/** @deprecated use pageControlRecordPath */
export const SERVE_RECORD_PATH = pageControlRecordPath('codex');

export interface PageControlRecord {
  agent: PageControlAgent;
  pid: number;
  host: string;
  port: number;
  url: string;
  threadId: string | null;
  workspaceId?: string | null;
  threadLocked: boolean;
  serverInstanceId?: string;
  workspaceSha8?: string;
  egoTaskSpace?: string;
}

export type ServeRecord = PageControlRecord;

export interface ServeSupervisorInput {
  action: 'status' | 'start' | 'stop' | 'restart';
  agent?: PageControlAgent;
  host?: string;
  port?: number;
  injectedThreadId?: string;
}

export interface ServeSupervisorOutput {
  command: 'serve-lifecycle';
  action: ServeSupervisorInput['action'];
  agent: PageControlAgent;
  running: boolean;
  pid: number;
  host: string;
  port: number;
  url: string;
  threadId: string;
  threadLocked: boolean;
  serverInstanceId: string;
  workspaceSha8: string;
  egoTaskSpace: string;
  message: string;
}

export interface ServeProcessEffect {
  start(options: {
    host: string;
    port: number;
    workspaceRoot: string;
    agent: PageControlAgent;
    serverInstanceId?: string;
    egoTaskSpace?: string;
  }): Promise<Pick<PageControlRecord, 'pid' | 'host' | 'port' | 'url'>>;
  stop(pid: number): Promise<void>;
  isAlive(pid: number): boolean;
  probeHealth(url: string): Promise<boolean>;
}

export function isPageControlAgent(value: string | undefined): value is PageControlAgent {
  return PAGE_CONTROL_AGENTS.includes(value as PageControlAgent);
}

export function parsePageControlAgent(value: string | undefined): PageControlAgent {
  if (value === undefined) return DEFAULT_PAGE_CONTROL_AGENT;
  if (isPageControlAgent(value)) return value;
  throw new Error(`Unsupported page control agent: ${value || '(empty)'}. Expected one of: ${PAGE_CONTROL_AGENTS.join(', ')}`);
}

export function injectedThreadIdFor(agent: PageControlAgent, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (agent === 'codex') {
    const value = env.CODEX_THREAD_ID?.trim();
    return value || undefined;
  }
  return undefined;
}

export function serveUrl(host: string, port: number): string {
  return httpServiceUrl(host, port);
}

export function parsePageControlRecord(raw: string | undefined, fallbackAgent: PageControlAgent): PageControlRecord | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const record = parsed as Record<string, unknown>;
  const pid = typeof record.pid === 'number' && Number.isInteger(record.pid) ? record.pid : 0;
  const host = typeof record.host === 'string' ? record.host : '';
  const port = typeof record.port === 'number' && Number.isInteger(record.port) ? record.port : 0;
  const url = typeof record.url === 'string' ? record.url : '';
  if (!pid || !host || !port || !url) return undefined;
  const rawAgent = typeof record.agent === 'string' ? record.agent : undefined;
  const agent = isPageControlAgent(rawAgent) ? rawAgent : fallbackAgent;
  return {
    agent,
    pid,
    host,
    port,
    url,
    threadId: typeof record.threadId === 'string' && record.threadId ? record.threadId : null,
    workspaceId: typeof record.workspaceId === 'string' && record.workspaceId ? record.workspaceId : null,
    threadLocked: record.threadLocked === true,
    serverInstanceId: typeof record.serverInstanceId === 'string' && record.serverInstanceId ? record.serverInstanceId : undefined,
    workspaceSha8: typeof record.workspaceSha8 === 'string' && record.workspaceSha8 ? record.workspaceSha8 : undefined,
    egoTaskSpace: typeof record.egoTaskSpace === 'string' && record.egoTaskSpace ? record.egoTaskSpace : undefined,
  };
}

export function parseServeRecord(raw: string | undefined): PageControlRecord | undefined {
  return parsePageControlRecord(raw, DEFAULT_PAGE_CONTROL_AGENT);
}

export async function readPageControlRecord(
  workspace: WorkspaceEffect,
  agent: PageControlAgent = DEFAULT_PAGE_CONTROL_AGENT,
): Promise<PageControlRecord | undefined> {
  const named = parsePageControlRecord(await workspace.readText(pageControlRecordPath(agent)), agent);
  if (named) return named;
  if (agent === 'codex') {
    const legacy = parsePageControlRecord(await workspace.readText(`${WORKSPACE_DIR}/serve.json`), 'codex');
    if (legacy) return { ...legacy, agent: 'codex' };
  }
  return undefined;
}

export async function readServeRecord(workspace: WorkspaceEffect): Promise<PageControlRecord | undefined> {
  return readPageControlRecord(workspace, DEFAULT_PAGE_CONTROL_AGENT);
}

/** Exact modern record for typed invocation; no legacy fallback or agent coercion. */
export async function readLiveServiceRecord(workspace: WorkspaceEffect, agent: PageControlAgent): Promise<unknown> {
  const raw = await workspace.readText(pageControlRecordPath(agent));
  if (!raw) return undefined;
  try { return JSON.parse(raw) as unknown; } catch { return undefined; }
}

export async function writePageControlRecord(workspace: WorkspaceEffect, record: PageControlRecord): Promise<void> {
  await workspace.writeText(pageControlRecordPath(record.agent), `${JSON.stringify(record, null, 2)}\n`);
}

export async function writeServeRecord(workspace: WorkspaceEffect, record: Omit<PageControlRecord, 'agent' | 'threadId' | 'threadLocked'> & Partial<PageControlRecord>): Promise<void> {
  await writePageControlRecord(workspace, {
    agent: record.agent ?? DEFAULT_PAGE_CONTROL_AGENT,
    pid: record.pid,
    host: record.host,
    port: record.port,
    url: record.url,
    threadId: record.threadId ?? null,
    workspaceId: record.workspaceId ?? null,
    threadLocked: record.threadLocked === true,
    serverInstanceId: record.serverInstanceId,
    workspaceSha8: record.workspaceSha8,
    egoTaskSpace: record.egoTaskSpace,
  });
}

export async function clearPageControlRecord(
  workspace: WorkspaceEffect,
  agent: PageControlAgent = DEFAULT_PAGE_CONTROL_AGENT,
): Promise<void> {
  await workspace.remove(pageControlRecordPath(agent));
}

export async function clearServeRecord(workspace: WorkspaceEffect): Promise<void> {
  await clearPageControlRecord(workspace, DEFAULT_PAGE_CONTROL_AGENT);
}

function resolveAgent(input: ServeSupervisorInput): PageControlAgent {
  return input.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
}

function emptyOutput(action: ServeSupervisorInput['action'], agent: PageControlAgent, message: string): ServeSupervisorOutput {
  return {
    command: 'serve-lifecycle',
    action,
    agent,
    running: false,
    pid: 0,
    host: '',
    port: 0,
    url: '',
    threadId: '',
    threadLocked: false,
    serverInstanceId: '',
    workspaceSha8: '',
    egoTaskSpace: '',
    message,
  };
}

function fromRecord(
  action: ServeSupervisorInput['action'],
  record: PageControlRecord,
  running: boolean,
  message: string,
): ServeSupervisorOutput {
  return {
    command: 'serve-lifecycle',
    action,
    agent: record.agent,
    running,
    pid: record.pid,
    host: record.host,
    port: record.port,
    url: record.url,
    threadId: record.threadId ?? '',
    threadLocked: record.threadLocked,
    serverInstanceId: record.serverInstanceId ?? '',
    workspaceSha8: record.workspaceSha8 ?? '',
    egoTaskSpace: record.egoTaskSpace ?? '',
    message,
  };
}

export async function inspectServe(
  workspace: WorkspaceEffect,
  effect: ServeProcessEffect,
  agent: PageControlAgent = DEFAULT_PAGE_CONTROL_AGENT,
): Promise<{ record?: PageControlRecord; running: boolean }> {
  const record = await readPageControlRecord(workspace, agent);
  if (!record) return { running: false };
  const alive = effect.isAlive(record.pid);
  const healthy = alive && await effect.probeHealth(record.url);
  return { record, running: healthy };
}

export async function runServeSupervisor(
  workspace: WorkspaceEffect,
  input: ServeSupervisorInput,
  effect: ServeProcessEffect,
): Promise<ServeSupervisorOutput> {
  const agent = resolveAgent(input);
  const supervisor = createServiceSupervisor<PageControlRecord, ServeSupervisorInput>({
    records: {
      read: () => readPageControlRecord(workspace, agent),
      write: (record) => writePageControlRecord(workspace, record),
      clear: () => clearPageControlRecord(workspace, agent),
    },
    process: effect,
    sleep: (milliseconds) => Bun.sleep(milliseconds),
    reuse: (record, request) => applyInjectedThread(record, request.injectedThreadId),
    async launch(request) {
      const instance = serverInstanceId();
      const workspaceHash = await workspaceSha8(workspace.root);
      const egoTaskSpace = egoTaskSpaceName(workspaceHash, agent, instance);
      const started = await effect.start({
        host: request.host, port: request.port, workspaceRoot: workspace.root, agent,
        serverInstanceId: instance, egoTaskSpace,
      });
      return applyInjectedThread({
        agent, ...started, threadId: null, workspaceId: null, threadLocked: false,
        serverInstanceId: instance, workspaceSha8: workspaceHash, egoTaskSpace,
      }, request.injectedThreadId);
    },
  }, { defaultHost: DEFAULT_SERVE_HOST, defaultPort: DEFAULT_SERVE_PORT });
  try {
    const outcome = await supervisor.run(input);
    if (outcome.action === 'start' && outcome.reason === 'failed' && outcome.record && outcome.running) throw outcome.error;
    const message = serviceMessage(outcome, agent);
    return outcome.record
      ? fromRecord(outcome.action, outcome.record, outcome.running, message)
      : emptyOutput(outcome.action, agent, message);
  } finally { await supervisor.close(); }
}

function serviceMessage(outcome: ServiceOutcome<PageControlRecord>, agent: PageControlAgent): string {
  if (outcome.reason === 'restart-stop-failed') return 'failed to stop serve before restart';
  if (outcome.action === 'restart' && outcome.running) return `serve restarted at ${outcome.record!.url}`;
  switch (outcome.reason) {
    case 'not-running': return outcome.action === 'status' ? `serve is not running for agent ${agent}` : 'serve is not running';
    case 'stale': return 'serve record is stale';
    case 'healthy': return `serve is running at ${outcome.record!.url} (agent ${agent})`;
    case 'reused': return `serve already running at ${outcome.record!.url}`;
    case 'started': return `serve started at ${outcome.record!.url} (agent ${agent})`;
    case 'unhealthy': return `serve started as pid ${outcome.record!.pid} but health check failed`;
    case 'stopped': return `stopped serve pid ${outcome.record!.pid}`;
    case 'failed': return outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
  }
}

function applyInjectedThread(record: PageControlRecord, injectedThreadId?: string): PageControlRecord {
  const threadId = injectedThreadId?.trim();
  if (!threadId) return record;
  return { ...record, threadId, threadLocked: true };
}

export async function updatePageControlThread(
  workspace: WorkspaceEffect,
  agent: PageControlAgent,
  input: { threadId?: string | null; workspaceId?: string | null; threadLocked: boolean },
): Promise<PageControlRecord | undefined> {
  const record = await readPageControlRecord(workspace, agent);
  if (!record) return undefined;
  const threadId = input.threadLocked ? (input.threadId ?? record.threadId) : null;
  const workspaceId = input.threadLocked
    ? (input.workspaceId ?? record.workspaceId ?? null)
    : null;
  const next: PageControlRecord = {
    ...record,
    threadId,
    workspaceId,
    threadLocked: input.threadLocked && Boolean(threadId),
  };
  await writePageControlRecord(workspace, next);
  return next;
}

export function probeServeHealth(url: string): Promise<boolean> {
  return probeHttpHealth(url, { path: '/api/health', command: 'health', versionField: 'serveProtocolVersion', version: SERVE_PROTOCOL_VERSION, timeoutMs: 500 });
}

export function resolveCliSpawn(): { command: string; prefix: string[] } {
  const embedded = (Bun.embeddedFiles as readonly unknown[] | undefined)?.length ?? 0;
  if (embedded > 0) return { command: process.execPath, prefix: [] };
  return {
    command: process.execPath,
    prefix: [fileURLToPath(new URL('../index.ts', import.meta.url))],
  };
}

export function createServeProcessEffect(
  spawnSpec: { command: string; prefix: string[] } = resolveCliSpawn(),
): ServeProcessEffect {
  return {
    async start({ host, port, workspaceRoot, agent, serverInstanceId: instance, egoTaskSpace }) {
      const listenPort = port === 0 ? allocateTcpPort(host) : port;
      const pid = await spawnDetachedProcess({
        command: spawnSpec.command,
        args: [...spawnSpec.prefix, '--workspace-dir', workspaceRoot, '--agent', agent, 'serve', '--host', host, '--port', String(listenPort)],
        cwd: workspaceRoot,
        env: {
          ...process.env,
          ...(instance ? { CODUMENT_SERVER_INSTANCE_ID: instance } : {}),
          ...(egoTaskSpace ? { CODUMENT_EGO_TASK_SPACE: egoTaskSpace } : {}),
        },
      });
      return { pid, host, port: listenPort, url: serveUrl(host, listenPort) };
    },
    stop: stopProcess,
    isAlive: isPidAlive,
    probeHealth: probeServeHealth,
  };
}
