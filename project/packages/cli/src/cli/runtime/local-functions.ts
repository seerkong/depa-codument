import type { CommandRuntime } from '../contracts/command';
import type { BundleDefinitionCatalog } from '../resources/bundle-materializer';
import type { HostCapabilityName, HostRuntime } from '../resources/definitions';
import type { LocalFunctionCatalog as PublicCatalog, LocalFunctionCapabilityContext } from 'halfcode-cli-lite-skill-app-contract/local-function';
import { createLocalFunctionCatalog as createCatalog } from 'halfcode-cli-lite-skill-app-logic/local-function';
import { createBunLocalFunctionCapabilityBindings } from 'halfcode-cli-lite-skill-app-capsule/local-function-capabilities';
import type { PageWorkflowRun, PageWorkflowStartInput } from './page-workflow';

export type { LocalFunctionOperation, LocalFunctionCapability, LocalFunctionJsonSchema, LocalFunctionDescriptor } from 'halfcode-cli-lite-skill-app-contract/local-function';
export type LocalFunctionRuntime<C extends readonly HostCapabilityName[] = readonly HostCapabilityName[]> = HostRuntime<C>;
export type LocalFunctionCatalog = PublicCatalog<CommandRuntime>;
export interface LocalFunctionPageWorkflowEffect {
  start(request: PageWorkflowStartInput): Promise<PageWorkflowRun>;
  get(runId: string): PageWorkflowRun | undefined;
  wait(runId: string, options?: { timeoutMs?: number; intervalMs?: number }): Promise<PageWorkflowRun>;
}

/** Product context conversion only; capability grants and SQLite ownership are public mechanisms. */
export function createLocalFunctionCatalog(definitions: BundleDefinitionCatalog): LocalFunctionCatalog {
  const bindings = createBunLocalFunctionCapabilityBindings();
  return createCatalog(definitions, {
    buildRuntime(runtime: CommandRuntime, definition, options) {
      const context: LocalFunctionCapabilityContext = {
        workspace: () => runtime.workspace(), clock: { now: () => Date.now() }, ids: { randomUUID: () => crypto.randomUUID() },
        configurationProfiles: runtime.configurationProfiles,
        defaultConfigurationProfile: () => runtime.defaultConfigurationProfile?.() ?? Promise.resolve(undefined),
        workflows: runtime.page?.workflows,
      };
      return bindings.buildRuntime(context, definition, options);
    },
    releaseRuntime: capabilities => bindings.releaseRuntime?.(capabilities),
  });
}
