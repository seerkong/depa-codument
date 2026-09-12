import * as path from 'node:path';
import type { ClientFetch } from '../effects/browser-provider';
import { runDebugCode as runHostDebugCode } from 'halfcode-cli-lite-browser-support/debug-code';
import { runWebApiModule } from './web-api';
import { runWithClientFetch } from './target-runtime';
export { evalDebugCode } from 'halfcode-cli-lite-browser-support/debug-code';

export function runCompiledEntry(options: {modulePath: string; input: unknown; clientFetch: ClientFetch}): Promise<unknown> {
  return runWebApiModule(options);
}

export function runDebugCode(options: {code: string; bundlePath: string; clientFetch: ClientFetch}): Promise<unknown> {
  // The product alone keeps compatibility with legacy globalThis.client_fetch.
  return runWithClientFetch(options.clientFetch, () => runHostDebugCode({ ...options, bundlePath: path.resolve(options.bundlePath) }));
}
