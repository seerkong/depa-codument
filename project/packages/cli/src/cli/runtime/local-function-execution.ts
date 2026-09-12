import { prepareLocalFunctionExecution as prepare } from 'halfcode-cli-lite-skill-app-logic/execution';
import { createCodumentLiveLocalFunctionClient } from 'depa-codument-product-capsule/live-client';
import { LocalFunctionAdmissionError, type LiveLocalFunctionInput } from 'halfcode-cli-lite-skill-app-contract/execution';
import type { CommandRuntime } from '../contracts/command';
import { canonicalWorkspaceRoot } from './ego-scope';
import { readLiveServiceRecord, DEFAULT_PAGE_CONTROL_AGENT } from './serve-process';

export { LOCAL_FUNCTION_SERVE_PATH } from 'halfcode-cli-lite-skill-app-contract/execution';
export type { LiveLocalFunctionRequest as ServeLocalFunctionRequest } from 'halfcode-cli-lite-skill-app-contract/execution';
export { parseLiveLocalFunctionRequest as parseServeLocalFunctionRequest } from 'halfcode-cli-lite-skill-app-logic/execution';

/** Keeps the product embedding shape; admission and captured-material proof have one public implementation. */
export async function prepareLocalFunctionExecution(runtime: CommandRuntime, fqn: string, profile?: string) {
  if (!runtime.localFunctions || !runtime.resourceCatalog) throw new Error('LocalFunction admission catalogs are not configured');
  const admitted = await prepare({
    context: runtime, functions: runtime.localFunctions, resources: runtime.resourceCatalog,
    profiles: runtime.configurationProfiles, defaultProfile: runtime.defaultConfigurationProfile,
  }, fqn, profile).catch(error => {
    if (error instanceof LocalFunctionAdmissionError && error.code === 'PROFILE_UNRESOLVED') {
      throw new LocalFunctionAdmissionError(error.code, `ConfigurationProfile was not found or is ambiguous: ${profile ?? '(default)'}`);
    }
    throw error;
  });
  return Object.freeze({ ...admitted, placement: admitted.receipt.placement,
    profile: profile ?? null, admissionDigest: admitted.receipt.digest });
}

/** Only a required live invocation reads a product record; no implicit start, retry or local fallback. */
export async function invokeServeLocalFunction(runtime: CommandRuntime, input: LiveLocalFunctionInput): Promise<unknown> {
  if (!runtime.httpFetch) throw new Error('LocalFunction Serve transport is not configured');
  const agent = runtime.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
  const workspace = runtime.workspace();
  const workspaceRoot = await canonicalWorkspaceRoot(workspace.root);
  return createCodumentLiveLocalFunctionClient({ workspaceRoot, agent }, {
    readRecord: () => readLiveServiceRecord(workspace, agent), fetch: runtime.httpFetch,
  })(input);
}
