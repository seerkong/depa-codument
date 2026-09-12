import { waitForShutdown as wait } from 'halfcode-cli-lite-cli-host-capsule/shutdown';
import { createProcessShutdownSignals } from 'halfcode-cli-lite-cli-host-support/shutdown';
export function waitForShutdown(onStop?: () => void | Promise<void>): Promise<void> {
  return wait(createProcessShutdownSignals(), onStop);
}
