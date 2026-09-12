import { LocalFunctionAdmissionError, type LiveLocalFunctionInput, type LiveServiceRecord } from 'halfcode-cli-lite-skill-app-contract/execution';
import { invokeLiveLocalFunctionClient } from 'halfcode-cli-lite-skill-app-logic/live-client';
import { createFetchLiveTransport } from 'halfcode-cli-lite-skill-app-support/live-transport';

/** The product record is scoped by its path; the public client independently probes its live identity. */
export function selectCodumentLiveRecord(scope: Readonly<{ workspaceRoot: string; agent: string }>, value: unknown): LiveServiceRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.agent !== scope.agent || typeof record.serverInstanceId !== 'string' || !record.serverInstanceId
    || typeof record.url !== 'string' || !record.url
    || (record.workspaceRoot !== undefined && record.workspaceRoot !== scope.workspaceRoot)) return undefined;
  return Object.freeze({ ...scope, serverInstanceId: record.serverInstanceId, url: record.url });
}
export function createCodumentLiveLocalFunctionClient(scope: Readonly<{ workspaceRoot: string; agent: string }>,
  effects: { readonly readRecord: () => Promise<unknown>; readonly fetch: typeof globalThis.fetch }) {
  const identity = Object.freeze({ ...scope });
  const runtime = {
    scope: identity, records: { read: async () => selectCodumentLiveRecord(identity, await effects.readRecord()) },
    transport: createFetchLiveTransport({ fetch: effects.fetch }, { timeoutMs: 30_000 }),
  };
  return async (input: LiveLocalFunctionInput): Promise<unknown> => {
    try { return await invokeLiveLocalFunctionClient(runtime, input); }
    catch (error) {
      if (error instanceof LocalFunctionAdmissionError && error.code === 'LIVE_INSTANCE_REQUIRED') {
        throw new LocalFunctionAdmissionError(error.code, `${error.message}; run codument serve start first`);
      }
      throw error;
    }
  };
}
