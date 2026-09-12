import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { createBrowserProviderClientFetch, requestUrl } from '../effects/browser-provider';
import { runWebApiModule, summarizeWebApiResult } from '../runtime/web-api';
import { resolveBrowserSelection, selectedOpenCliSubtransport } from './runtime-flags';

function parseInput(value: string | boolean | undefined): { ok: true; value: unknown } | { ok: false; message: string } {
  if (typeof value !== 'string') return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, message: 'Invalid --input JSON.' };
  }
}

export async function runWebApiCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length !== 1) {
    return {
      code: 1,
      data: { command: 'run-web-api' },
      message: `Usage: ${BIN} run-web-api <module> [--input <json>] [--transport ego-browser|opencli|mdd-browser-robot] [--opencli-transport plugin|browser-eval]`,
    };
  }

  let selection;
  try {
    selection = await resolveBrowserSelection(context.options.transport, context.options['opencli-transport'], context.runtime);
  } catch (error) {
    return { code: 1, data: { command: 'run-web-api' }, message: error instanceof Error ? error.message : String(error) };
  }
  if (!selection) {
    return { code: 1, data: { command: 'run-web-api' }, message: 'Invalid browser selection. Expected --transport ego-browser|opencli|mdd-browser-robot; --opencli-transport applies only to OpenCLI.' };
  }
  const { transport } = selection;
  const opencliSubtransport = selectedOpenCliSubtransport(selection);

  const input = parseInput(context.options.input);
  if (!input.ok) {
    return { code: 1, data: { command: 'run-web-api' }, message: input.message };
  }

  const modulePath = context.positional[0];
  const session = typeof context.options.session === 'string' ? context.options.session : undefined;
  const provider = context.runtime.browserProviderFor?.({ ...selection, session }) ?? context.runtime.browserProvider;
  if (!provider) return { code: 1, data: { command: 'run-web-api' }, message: 'Browser provider effect is not configured' };
  const clientFetch = createBrowserProviderClientFetch(provider);
  const calls: Array<{ url: string; method: string; status: number }> = [];
  const tracked: typeof clientFetch = async (request, init) => {
    const response = await clientFetch(request, init);
    calls.push({
      url: requestUrl(request),
      method: (init?.method ?? 'GET').toUpperCase(),
      status: response.status,
    });
    return response;
  };

  try {
    const result = await runWebApiModule({
      modulePath,
      input: input.value,
      clientFetch: tracked,
    });
    return {
      code: 0,
      data: {
        command: 'run-web-api',
        module: modulePath,
        transport,
        ...(opencliSubtransport ? { opencliSubtransport } : {}),
        fetchCount: calls.length,
        lastUrl: calls.at(-1)?.url ?? '',
        lastStatus: calls.at(-1)?.status ?? 0,
        result,
      },
      message: summarizeWebApiResult(result, calls),
    };
  } catch (error) {
    return {
      code: 1,
      data: {
        command: 'run-web-api',
        module: modulePath,
        transport,
        fetchCount: calls.length,
        lastUrl: calls.at(-1)?.url ?? '',
        lastStatus: calls.at(-1)?.status ?? 0,
      },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
