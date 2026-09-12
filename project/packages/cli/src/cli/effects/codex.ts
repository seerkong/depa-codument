import type { CodexSidecar, DesktopIpc, ManagedCodexEffect } from 'halfcode-cli-lite-cli-host-contract/codex';
import { createCodexClient } from 'halfcode-cli-lite-cli-host-capsule/codex';
import { createCodexSidecar } from 'halfcode-cli-lite-cli-host-support/codex';
import { createDesktopIpc } from './codex-desktop';
import { BIN } from '../../identity';
import { VERSION } from '../../version';
export type * from 'halfcode-cli-lite-cli-host-contract/codex';
export * from 'halfcode-cli-lite-cli-host-logic/codex';

export function createCodexEffect(options: {
  desktop?: DesktopIpc | null;
  sidecar?: CodexSidecar;
  envThreadId?: string;
  cwd?: string;
} = {}): ManagedCodexEffect {
  const cwd = options.cwd ?? process.cwd();
  const desktop = options.desktop === undefined ? createDesktopIpc() : undefined;
  const sidecar = options.sidecar ? undefined : createCodexSidecar({
    command: process.env.CODEX_BIN ?? 'codex', args: ['app-server'], cwd,
    clientInfo: { name: BIN, version: VERSION }, env: process.env,
  });
  return createCodexClient({
    cwd, envThreadId: options.envThreadId ?? process.env.CODEX_THREAD_ID,
    desktop: desktop ?? options.desktop ?? null,
    sidecar: sidecar ?? options.sidecar!,
    async release() {
      const results = await Promise.allSettled([desktop?.close(), sidecar?.close()]);
      const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
      if (failures.length) throw new AggregateError(failures, 'Codex connection release failed');
    },
  });
}
