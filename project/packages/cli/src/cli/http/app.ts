import { Hono } from 'hono';
import { createPageHttpApp } from 'halfcode-cli-lite-http-shell/page-http';
import { cors } from 'hono/cors';
import { buildMcpAppAgentMessage, type JsonSchema } from 'depa-codument-mcp-app-capsule';
import { BIN, DISPLAY_NAME } from '../../identity';
import { VERSION } from '../../version';
import {
  invokeCodexList,
  invokeCodexSend,
  invokeEgoCall,
  invokeEgoOpen,
  invokeDemo,
  invokePageControlLock,
  invokePageControlStatus,
  invokeStatus,
} from '../app/invoke';
import type { CommandRuntime } from '../contracts/command';
import type { HttpInstanceIdentity } from 'halfcode-cli-lite-cli-host-contract/http';
import { buildOutputPayload } from '../output';
import { createInstructionHub, type InstructionHub } from './page-control';
import { createPageInstanceHub, type PageInstanceHub } from './page-instances';
import { invokeInstalledPageObjectAction } from '../runtime/page-workflow';
import { createPageInstanceTargetPort } from '../runtime/page-target';
import { loadWebAsset } from './static';
import { moduleFederationBrowserRuntime } from './federation-browser-runtime';
import { prepareLocalFunctionExecution } from '../runtime/local-function-execution';
import { createLocalFunctionHttpApp } from 'halfcode-cli-lite-http-shell/execution';
import { LOCAL_FUNCTION_INSTANCE_PATH, LOCAL_FUNCTION_SERVE_PATH } from 'halfcode-cli-lite-skill-app-contract/execution';
import { selectCodumentLiveRecord } from 'depa-codument-product-capsule/live-client';
import { readLiveServiceRecord } from '../runtime/serve-process';
import { canonicalWorkspaceRoot } from '../runtime/ego-scope';
import {
  readPageControlRecord,
  SERVE_PROTOCOL_VERSION,
  type PageControlRecord,
} from '../runtime/serve-process';

function readName(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function responseBytes(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

interface AgentTarget {
  targetId: string;
  scopeId: string;
  label: string;
  detail: string;
}

export type ServeInstanceIdentity = HttpInstanceIdentity;

export interface HttpAppOptions {
  serveInstance?: ServeInstanceIdentity;
}

interface AgentBinding {
  threadId: string;
  workspaceId: string;
  threadLocked: boolean;
}

export function buildAgentTaskMessage(input: {
  action: string;
  pageName: string;
  targetRef: string;
  typedInput?: Readonly<Record<string, unknown>>;
  inputSchema?: JsonSchema;
}): string {
  return buildMcpAppAgentMessage({
    hostSkill: BIN,
    sopFqn: input.action,
    pageName: input.pageName,
    targetRef: input.targetRef,
    ...(input.typedInput === undefined ? {} : { input: input.typedInput, inputSchema: input.inputSchema }),
  });
}

function emptyAgentBinding(): AgentBinding {
  return { threadId: '', workspaceId: '', threadLocked: false };
}

function recordBelongsToInstance(record: PageControlRecord | undefined, instance: ServeInstanceIdentity): boolean {
  return Boolean(
    record
    && record.serverInstanceId === instance.serverInstanceId
    && record.pid === instance.pid
    && record.host === instance.host
    && record.port === instance.port
    && record.url === instance.url,
  );
}

function bindingFromRecord(record: PageControlRecord | undefined): AgentBinding {
  if (!record?.threadLocked || !record.threadId) return emptyAgentBinding();
  return {
    threadId: record.threadId,
    workspaceId: record.workspaceId ?? '',
    threadLocked: true,
  };
}

async function listAgentTargets(runtime: CommandRuntime): Promise<AgentTarget[]> {
  const workspaceRoot = runtime.workspace().root;
  const threadsResult = await invokeCodexList(runtime, {
    sortMode: 'recency_desc',
    cwd: workspaceRoot,
    useStateDbOnly: true,
  });
  if (threadsResult.code !== 0) throw new Error(threadsResult.message || 'Unable to list Codex threads');
  const threads = Array.isArray(threadsResult.data?.threads) ? threadsResult.data.threads : [];
  const candidates = threads.filter((thread) => isRecord(thread) && thread.cwd === workspaceRoot);
  return candidates.flatMap((thread): AgentTarget[] => {
    if (!isRecord(thread) || typeof thread.id !== 'string' || !thread.id) return [];
    return [{
      targetId: thread.id,
      scopeId: '',
      label: typeof thread.name === 'string' && thread.name
        ? thread.name
        : typeof thread.preview === 'string' && thread.preview ? thread.preview : thread.id,
      detail: typeof thread.cwd === 'string' ? thread.cwd : '',
    }];
  });
}

export function createHttpApp(
  runtime: CommandRuntime,
  hub: InstructionHub = createInstructionHub(),
  pages: PageInstanceHub = createPageInstanceHub(),
  options: HttpAppOptions = {},
): Hono {
  const app = new Hono();
  const pageTargets = createPageInstanceTargetPort(pages);
  const pageCatalog = () => {
    const catalog = runtime.page?.pages;
    if (!catalog) throw new Error('Page resource catalog is not configured');
    return catalog;
  };
  const siteCatalog = () => {
    const catalog = runtime.page?.sites;
    if (!catalog) throw new Error('Site resource catalog is not configured');
    return catalog;
  };
  let localBinding: AgentBinding | undefined;

  async function currentBinding(): Promise<AgentBinding> {
    const agent = runtime.agent ?? 'codex';
    const record = await readPageControlRecord(runtime.workspace(), agent);
    if (!options.serveInstance || recordBelongsToInstance(record, options.serveInstance)) {
      return bindingFromRecord(record);
    }
    return localBinding ?? emptyAgentBinding();
  }

  async function updateCurrentBinding(input: AgentBinding) {
    const next = input.threadLocked && input.threadId ? input : emptyAgentBinding();
    if (!options.serveInstance) {
      return invokePageControlLock(runtime, {
        threadId: next.threadId || null,
        workspaceId: next.workspaceId || null,
        threadLocked: next.threadLocked,
      });
    }
    const agent = runtime.agent ?? 'codex';
    const record = await readPageControlRecord(runtime.workspace(), agent);
    if (recordBelongsToInstance(record, options.serveInstance)) {
      return invokePageControlLock(runtime, {
        threadId: next.threadId || null,
        workspaceId: next.workspaceId || null,
        threadLocked: next.threadLocked,
      });
    }
    localBinding = next;
    return Promise.resolve({
      code: 0,
      data: {
        command: 'page-control',
        accepted: true,
        agent,
        threadId: next.threadId,
        workspaceId: next.workspaceId,
        threadLocked: next.threadLocked,
        persisted: false,
      },
      message: next.threadLocked ? `locked ${next.threadId} for current serve instance` : 'unlocked',
    });
  }

  function bindingPayload(binding: AgentBinding) {
    return {
      ok: true,
      code: 0,
      command: 'page-control',
      agent: runtime.agent ?? 'codex',
      running: true,
      threadId: binding.threadId,
      workspaceId: binding.workspaceId,
      threadLocked: binding.threadLocked,
      url: options.serveInstance?.url ?? '',
      serverInstanceId: options.serveInstance?.serverInstanceId ?? '',
      message: binding.threadLocked ? `locked ${binding.threadId}` : 'thread is not locked',
    };
  }

  app.use('/api/*', cors());

  if (options.serveInstance) {
    const instance = options.serveInstance;
    const scope = { workspaceRoot: runtime.workspace().root, agent: runtime.agent ?? 'codex' };
    let ingress: Promise<Hono> | undefined;
    function localFunctionIngress(): Promise<Hono> {
      return ingress ??= canonicalWorkspaceRoot(scope.workspaceRoot).then(workspaceRoot => {
        const canonicalScope = { ...scope, workspaceRoot };
        return createLocalFunctionHttpApp({
          identity: { ...canonicalScope, serverInstanceId: instance.serverInstanceId },
          prepare: (fqn, profile) => prepareLocalFunctionExecution(runtime, fqn, profile),
          async isCurrentInstance() {
            const current = selectCodumentLiveRecord(canonicalScope, await readLiveServiceRecord(runtime.workspace(), scope.agent));
            return current?.serverInstanceId === instance.serverInstanceId && current.url === instance.url;
          },
        });
      });
    }
    app.get(LOCAL_FUNCTION_INSTANCE_PATH, async context => (await localFunctionIngress()).fetch(context.req.raw));
    app.post(LOCAL_FUNCTION_SERVE_PATH, async context => (await localFunctionIngress()).fetch(context.req.raw));
  }

  app.get('/api/health', (context) => context.json({
    ok: true,
    code: 0,
    command: 'health',
    bin: BIN,
    name: DISPLAY_NAME,
    version: VERSION,
    serveProtocolVersion: SERVE_PROTOCOL_VERSION,
  }));

  app.get('/api/demo', (context) => {
    const result = invokeDemo(runtime, context.req.query('name'));
    return context.json(buildOutputPayload(result), result.code === 0 ? 200 : 400);
  });

  app.post('/api/demo', async (context) => {
    const body = await context.req.json().catch(() => ({}));
    const result = invokeDemo(runtime, readName(isRecord(body) ? body.name : undefined));
    return context.json(buildOutputPayload(result), result.code === 0 ? 200 : 400);
  });

  app.get('/api/status', async (context) => {
    const result = await invokeStatus(runtime);
    return context.json(buildOutputPayload(result));
  });

  app.post('/api/page/fill-demo', async (context) => {
    const body = await context.req.json().catch(() => ({}));
    const record = isRecord(body) ? body : {};
    const text = typeof record.text === 'string' ? record.text : '';
    const number = typeof record.number === 'number' ? record.number : Number(record.number);
    if (!Number.isFinite(number)) {
      return context.json({
        ok: false,
        code: 1,
        command: 'page-fill-demo',
        accepted: false,
        message: 'number is required',
      }, 400);
    }
    const published = hub.publish('duplex-codex', { type: 'fill-demo', text, number }, 'page-fill-demo');
    return context.json({
      ok: true,
      code: 0,
      text,
      number,
      ...published,
    });
  });

  app.get('/api/page-control', async (context) => {
    if (!options.serveInstance) {
      const result = await invokePageControlStatus(runtime);
      return context.json(buildOutputPayload(result));
    }
    return context.json(bindingPayload(await currentBinding()));
  });

  app.post('/api/page-control/lock', async (context) => {
    const body = await context.req.json().catch(() => ({}));
    const record = isRecord(body) ? body : {};
    const result = await updateCurrentBinding({
      threadId: typeof record.threadId === 'string' ? record.threadId : '',
      workspaceId: typeof record.workspaceId === 'string' ? record.workspaceId : '',
      threadLocked: record.threadLocked === true,
    });
    return context.json(buildOutputPayload(result), result.code === 0 ? 200 : 400);
  });

  app.get('/api/codex/threads', async (context) => {
    const result = await invokeCodexList(runtime, {
      searchTerm: context.req.query('search') ?? undefined,
      sortMode: context.req.query('sort') ?? undefined,
    });
    return context.json(buildOutputPayload(result), result.code === 0 ? 200 : 400);
  });

  app.post('/api/codex/send', async (context) => {
    const body = await context.req.json().catch(() => ({}));
    const record = isRecord(body) ? body : {};
    const result = await invokeCodexSend(runtime, {
      message: typeof record.message === 'string' ? record.message : '',
      threadId: typeof record.threadId === 'string' ? record.threadId : undefined,
    });
    return context.json(buildOutputPayload(result), result.code === 0 ? 200 : 400);
  });

  app.get('/api/page-instances', (context) => context.json({ ok: true, pages: pages.list() }));

  app.get('/api/agent/targets', async (context) => {
    try {
      const control = await currentBinding();
      return context.json({
        ok: true,
        agent: runtime.agent ?? 'codex',
        lockedTargetId: control.threadLocked ? control.threadId : '',
        lockedScopeId: control.threadLocked ? control.workspaceId : '',
        targets: await listAgentTargets(runtime),
      });
    } catch (error) {
      return context.json({ ok: false, targets: [], message: pageErrorMessage(error) }, 502);
    }
  });

  app.post('/api/agent/bind', async (context) => {
    const body = await context.req.json().catch(() => ({}));
    const record = isRecord(body) ? body : {};
    const targetId = typeof record.targetId === 'string' ? record.targetId.trim() : '';
    const scopeId = typeof record.scopeId === 'string' ? record.scopeId.trim() : '';
    if (!targetId) return context.json({ ok: false, accepted: false, message: 'targetId is required' }, 400);
    try {
      const targets = await listAgentTargets(runtime);
      const target = targets.find((item) => item.targetId === targetId && item.scopeId === scopeId);
      if (!target) return context.json({ ok: false, accepted: false, message: 'Agent target is unknown or stale' }, 404);
      const result = await updateCurrentBinding({
        threadId: target.targetId,
        workspaceId: target.scopeId,
        threadLocked: true,
      });
      return context.json({
        ...buildOutputPayload(result),
        targetId: target.targetId,
        scopeId: target.scopeId,
        label: target.label,
      }, result.code === 0 ? 200 : 400);
    } catch (error) {
      return context.json({ ok: false, accepted: false, message: pageErrorMessage(error) }, 502);
    }
  });

  app.post('/api/agent/send', async (context) => {
    const body = await context.req.json().catch(() => ({}));
    const record = isRecord(body) ? body : {};
    const targetRef = typeof record.targetRef === 'string' ? record.targetRef.trim() : '';
    const action = typeof record.action === 'string' ? record.action.trim() : '';
    if (!targetRef || !action) {
      return context.json({ ok: false, accepted: false, message: 'targetRef and action are required' }, 400);
    }
    const unknownFields = Object.keys(record).filter((name) => !['targetRef', 'action', 'input'].includes(name));
    if (unknownFields.length) return context.json({ ok: false, accepted: false, message: `Unknown Agent task field: ${unknownFields[0]}` }, 400);
    const target = pages.list().find((entry) => entry.targetRef === targetRef);
    if (!target) return context.json({ ok: false, accepted: false, message: 'Page target is unknown or stale' }, 409);
    let page;
    try {
      page = await pageCatalog().get(target.pageName);
    } catch (error) {
      return context.json({ ok: false, accepted: false, message: pageErrorMessage(error) }, 500);
    }
    const declaredAction = page?.agentAction?.action ?? page?.mcpApp?.sopFqn;
    if (!page || page.status !== 'ready' || declaredAction !== action) {
      return context.json({ ok: false, accepted: false, message: 'Page Agent action is not installed or allowlisted' }, 400);
    }
    const typedInput = record.input;
    if (typedInput !== undefined && !isRecord(typedInput)) {
      return context.json({ ok: false, accepted: false, message: 'Agent task input must be an object' }, 400);
    }
    const control = await currentBinding();
    if (!control.threadLocked || !control.threadId) {
      return context.json({
        ok: false,
        accepted: false,
        bindingRequired: true,
        message: '请先在页面顶部选择并关联要接收指令的助手会话',
      }, 409);
    }
    let message: string;
    try {
      message = buildAgentTaskMessage({
        action,
        pageName: target.pageName,
        targetRef,
        ...(typedInput === undefined ? {} : { typedInput, inputSchema: page.agentAction?.inputSchema }),
      });
    } catch (error) {
      return context.json({ ok: false, accepted: false, message: pageErrorMessage(error) }, 400);
    }
    const result = await invokeCodexSend(runtime, { message, threadId: control.threadId });
    return context.json(buildOutputPayload(result), result.code === 0 ? 200 : 400);
  });

  app.post('/api/ego/session', async (context) => {
    const body = await context.req.json().catch(() => ({}));
    const url = isRecord(body) && typeof body.url === 'string' ? body.url : '';
    const result = await invokeEgoOpen(runtime, url);
    return context.json(buildOutputPayload(result), result.code === 0 ? 200 : 400);
  });

  app.post('/api/ego/call', async (context) => {
    const body = await context.req.json().catch(() => ({}));
    const record = isRecord(body) ? body : {};
    const result = await invokeEgoCall(runtime, {
      sessionId: typeof record.sessionId === 'string' ? record.sessionId : '',
      operation: typeof record.operation === 'string' ? record.operation : '',
      arguments: isRecord(record.arguments) ? record.arguments : {},
    });
    return context.json(buildOutputPayload(result), result.code === 0 ? 200 : 400);
  });

  app.route('/', createPageHttpApp({
    targets: pageTargets, pages: pageCatalog, sites: siteCatalog,
    workflows: () => runtime.page?.workflows,
    builds: () => runtime.page?.builds,
    localFunctions() {
      const catalog = runtime.localFunctions;
      return catalog && { invoke: (fqn, input, config, targets) => catalog.invoke(runtime, fqn, input, config, { pages: targets }) };
    },
    invokePageObject: (request, targets) => invokeInstalledPageObjectAction(runtime, request, targets),
    webAsset: (assetPath) => loadWebAsset(runtime.resources, assetPath),
    moduleFederationRuntime: moduleFederationBrowserRuntime,
  }));

  app.get('/*', async (context) => {
    const asset = await loadWebAsset(runtime.resources, context.req.path);
    if (!asset) return context.body('Not found', 404);
    return new Response(responseBytes(asset.body), { status: 200, headers: { 'Content-Type': asset.contentType } });
  });

  return app;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pageErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(?:[A-Za-z]:[\\/]|\/)[^\s]+/g, '[internal path]');
}
