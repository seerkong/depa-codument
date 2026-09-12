import { BIN } from '../../identity';
import type { CommandContext, CommandResult, CommandRun } from '../contracts/command';
import { waitForShutdown } from '../lifecycle';
import { serverInstanceId } from '../runtime/ego-scope';
import { invokeServeLifecycle } from '../app/invoke';

function parsePort(value: string | boolean | undefined): number | undefined {
  if (value === undefined) return 8787;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const port = Number(value);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : undefined;
}

function parseCodexThreadId(value: string | boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.trim();
}

function serveInput(
  context: CommandContext,
  action: 'start' | 'stop' | 'restart' | 'status',
  host: string | undefined,
  port: number | undefined,
): CommandResult | { action: 'start' | 'stop' | 'restart' | 'status'; host?: string; port?: number; injectedThreadId?: string } {
  if (context.options['codex-thread-id'] !== undefined && !parseCodexThreadId(context.options['codex-thread-id'])) {
    return { code: 1, data: { command: `serve-${action}` }, message: 'Invalid --codex-thread-id. Expected a non-empty Codex task id.' };
  }
  return {
    action,
    host,
    port,
    injectedThreadId: parseCodexThreadId(context.options['codex-thread-id']),
  };
}

export async function serveCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0) {
    return { code: 1, data: { command: 'serve' }, message: `Usage: ${BIN} serve [--port <n>] [--host <addr>] [--codex-thread-id <id>]` };
  }
  const host = typeof context.options.host === 'string' ? context.options.host : '127.0.0.1';
  const port = parsePort(context.options.port);
  if (port === undefined) {
    return { code: 1, data: { command: 'serve' }, message: 'Invalid --port. Expected an integer 0-65535.' };
  }
  const input = serveInput(context, 'start', host, port);
  if ('code' in input) return input;
  if (!process.env.CODUMENT_SERVER_INSTANCE_ID) {
    return invokeServeLifecycle(context.runtime, input);
  }
  const effect = context.runtime.httpServer;
  if (!effect) return { code: 1, data: { command: 'serve' }, message: 'HTTP server effect is not configured' };
  const started = effect.start({
    runtime: context.runtime,
    host,
    port,
    serverInstanceId: process.env.CODUMENT_SERVER_INSTANCE_ID?.trim() || serverInstanceId(),
  });
  return {
    code: 0,
    data: { command: 'serve', host, port: started.port, url: started.url },
    message: `${BIN} listening on ${started.url}`,
    wait: waitForShutdown(async () => {
      const results = await Promise.allSettled([started.stop()]);
      // Legacy injected runtimes have no aggregate owner; retain their explicit cleanup.
      if (!context.runtime.close) {
        results.push(...await Promise.allSettled([context.runtime.page?.workflows?.close()]));
        results.push(...await Promise.allSettled([context.runtime.page?.supervisor?.close()]));
      }
      const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
      if (failures.length) throw new AggregateError(failures, 'Serve shutdown failed');
    }),
  };
}

export function serveLifecycleCommand(action: 'start' | 'stop' | 'restart' | 'status'): CommandRun {
  return async (context): Promise<CommandResult> => {
    if (action === 'start') return serveCommand(context);
    if (context.positional.length > 0) {
      return { code: 1, data: { command: `serve-${action}` }, message: `Usage: ${BIN} serve ${action}` };
    }
    const host = typeof context.options.host === 'string' ? context.options.host : undefined;
    const port = context.options.port === undefined ? undefined : parsePort(context.options.port);
    if (context.options.port !== undefined && port === undefined) {
      return { code: 1, data: { command: `serve-${action}` }, message: 'Invalid --port. Expected an integer 0-65535.' };
    }
    const input = serveInput(context, action, host, port);
    if ('code' in input) return input;
    return invokeServeLifecycle(context.runtime, input);
  };
}
