import {
  createBrowserProviderClientFetch,
  requestUrl,
  type BrowserProviderEffect,
  type BrowserProviderSelection,
  type ClientFetch,
  type BrowserTransport,
} from '../effects/browser-provider';
import type { OpenCliSubtransport } from '../effects/opencli';
import type { CommandRuntime } from '../contracts/command';

export function parseTransport(value: string | boolean | undefined): BrowserTransport | undefined {
  if (value === undefined) return 'ego-browser';
  if (value === 'opencli' || value === 'ego-browser' || value === 'mdd-browser-robot') return value;
  return undefined;
}

export function parseOpenCliSubtransport(value: string | boolean | undefined): OpenCliSubtransport | undefined {
  if (value === undefined) return undefined;
  if (value === 'plugin' || value === 'browser-eval') return value;
  return undefined;
}

export async function resolveBrowserSelection(
  value: string | boolean | undefined,
  opencliAdapterValue: string | boolean | undefined,
  runtime: CommandRuntime,
): Promise<BrowserProviderSelection | undefined> {
  const explicitTransport = value === undefined ? undefined : parseTransport(value);
  if (value !== undefined && !explicitTransport) return undefined;
  const configured = explicitTransport
    ? { transport: explicitTransport }
    : await runtime.defaultBrowserSelection?.() ?? { transport: 'ego-browser' as const };
  if (configured.transport !== 'opencli') {
    if (opencliAdapterValue !== undefined) return undefined;
    if (configured.transport === 'mdd-browser-robot') {
      const transport = configured.backend?.transport ?? 'chrome-extension';
      return transport === 'chrome-extension'
        ? { transport: 'mdd-browser-robot', backend: { transport } }
        : undefined;
    }
    return configured;
  }
  const explicitSubtransport = parseOpenCliSubtransport(opencliAdapterValue);
  if (opencliAdapterValue !== undefined && !explicitSubtransport) return undefined;
  const configuredSubtransport = parseOpenCliSubtransport(configured.backend?.transport);
  return {
    transport: 'opencli',
    backend: { transport: explicitSubtransport ?? configuredSubtransport ?? 'plugin' },
  };
}

export function selectedOpenCliSubtransport(
  selection: BrowserProviderSelection,
): OpenCliSubtransport | undefined {
  return selection.transport === 'opencli'
    ? parseOpenCliSubtransport(selection.backend?.transport)
    : undefined;
}

export function parseJsonInput(value: string | boolean | undefined, option = 'input'): { ok: true; value: unknown } | { ok: false; message: string } {
  if (typeof value !== 'string') return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, message: `Invalid --${option} JSON.` };
  }
}

export function optionString(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function createTrackedClientFetch(options: {
  transport: BrowserTransport;
  session?: string;
  provider: BrowserProviderEffect;
}): {
  clientFetch: ClientFetch;
  calls: Array<{ url: string; method: string; status: number }>;
} {
  const clientFetch = createBrowserProviderClientFetch(options.provider);
  const calls: Array<{ url: string; method: string; status: number }> = [];
  const tracked: ClientFetch = async (request, init) => {
    const response = await clientFetch(request, init);
    calls.push({
      url: requestUrl(request),
      method: (init?.method ?? 'GET').toUpperCase(),
      status: response.status,
    });
    return response;
  };
  return { clientFetch: tracked, calls };
}
