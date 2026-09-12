import { resolveDiscoveredFunction, resolveModulePath, type LocateRegistryOptions, type RegistryFunction } from './registry';
import { runCompiledEntry } from './exec-code';
import { createTrackedClientFetch } from '../commands/runtime-flags';
import type { BrowserProviderEffect, BrowserTransport } from '../effects/browser-provider';

export interface InvokeCompiledFunctionOptions extends LocateRegistryOptions {
  fqn: string;
  input: unknown;
  transport: BrowserTransport;
  session?: string;
  provider: BrowserProviderEffect;
}

export interface InvokeCompiledFunctionResult {
  result: unknown;
  entry: RegistryFunction;
  registryFile: string;
  modulePath: string;
  calls: Array<{ url: string; method: string; status: number }>;
}

export async function invokeCompiledFunction(
  options: InvokeCompiledFunctionOptions,
): Promise<InvokeCompiledFunctionResult> {
  const located = resolveDiscoveredFunction(options, options.fqn);
  const modulePath = resolveModulePath(located.registryFile, located.entry.module);
  const { clientFetch, calls } = createTrackedClientFetch({
    transport: options.transport,
    session: options.session,
    provider: options.provider,
  });
  const result = await runCompiledEntry({
    modulePath,
    input: options.input,
    clientFetch,
  });
  return {
    result,
    entry: located.entry,
    registryFile: located.registryFile,
    modulePath,
    calls,
  };
}
