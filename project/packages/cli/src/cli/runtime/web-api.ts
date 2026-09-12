import * as path from 'node:path';
import type { ClientFetch } from '../effects/browser-provider';
import { createWebApiModuleLoader } from 'halfcode-cli-lite-browser-support/web-api';
import { runWithClientFetch } from './target-runtime';
export { summarizeWebApiResult } from 'halfcode-cli-lite-cli-host-logic/web-api';

export async function runWebApiModule(options: { modulePath: string; input: unknown; clientFetch: ClientFetch }): Promise<unknown> {
  const loader = createWebApiModuleLoader();
  try {
    // Explicitly preserve legacy scripts that reference globalThis.client_fetch.
    return await runWithClientFetch(options.clientFetch, () => loader.run({
      ...options, modulePath: path.resolve(options.modulePath),
    }));
  } finally { await loader.close(); }
}
