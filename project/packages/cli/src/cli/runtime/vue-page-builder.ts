import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createVuePageBuilderPort as createWorkerPort, resolveVueWorkerEntry, resolveBunExecutable,
  type VuePageBuilderPortDependencies } from 'depa-codument-page-builder-vue-support/worker-port';
import type { VuePageBuilderPort } from 'halfcode-cli-lite-skill-app-contract/page-build';
export type { VuePageBuilderPortDependencies } from 'depa-codument-page-builder-vue-support/worker-port';

/** The installed executable's adjacent worker layout is a product distribution binding. */
async function workerEntry(): Promise<string> {
  const executable = await fs.realpath(process.execPath).catch(() => path.resolve(process.execPath));
  const candidate = path.resolve(path.dirname(executable), '..', 'builder-vue', 'src', 'worker.ts');
  if ((await fs.stat(candidate).catch(() => undefined))?.isFile()) return candidate;
  return resolveVueWorkerEntry();
}
export function createVuePageBuilderPort(
  dependencies: VuePageBuilderPortDependencies = { workerEntry, bunExecutable: resolveBunExecutable },
): VuePageBuilderPort {
  return createWorkerPort(dependencies);
}
