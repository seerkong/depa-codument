import * as path from 'node:path';
import type { ClientFetch } from '../effects/browser-provider';
import { createWebApiModuleLoader } from 'halfcode-lite-browser-support/web-api';
import { runWithClientFetch } from './target-runtime';
export { summarizeWebApiResult } from 'halfcode-lite-cli-logic/web-api';

export async function runWebApiModule(options: { modulePath: string; input: unknown; clientFetch: ClientFetch }): Promise<unknown> {
  const loader = createWebApiModuleLoader();
  try {
    // Explicitly preserve legacy scripts that reference globalThis.client_fetch.
    return await runWithClientFetch(options.clientFetch, () => loader.run({
      ...options, modulePath: path.resolve(options.modulePath),
    }));
  } finally { await loader.close(); }
}
