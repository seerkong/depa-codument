import { createDesktopIpc as createIpc, defaultIpcSocketPath } from 'halfcode-cli-lite-cli-host-support/codex-desktop';
import { BIN } from '../../identity';
export { defaultIpcSocketPath, encodeIpcFrame, decodeIpcFrames } from 'halfcode-cli-lite-cli-host-support/codex-desktop';
export type { DesktopIpc } from 'halfcode-cli-lite-cli-host-contract/codex';
export function createDesktopIpc(socketPath = defaultIpcSocketPath()) {
  return createIpc({ socketPath, clientName: BIN });
}
