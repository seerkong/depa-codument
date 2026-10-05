import { createDesktopIpc as createIpc, defaultIpcSocketPath } from 'halfcode-lite-cli-support/codex-desktop';
import { BIN } from '../../identity';
export { defaultIpcSocketPath, encodeIpcFrame, decodeIpcFrames } from 'halfcode-lite-cli-support/codex-desktop';
export type { DesktopIpc } from 'halfcode-lite-cli-contract/codex';
export function createDesktopIpc(socketPath = defaultIpcSocketPath()) {
  return createIpc({ socketPath, clientName: BIN });
}
