import { waitForShutdown as wait } from 'halfcode-lite-cli-capsule/shutdown';
import { createProcessShutdownSignals } from 'halfcode-lite-cli-support/shutdown';
export function waitForShutdown(onStop?: () => void | Promise<void>): Promise<void> {
  return wait(createProcessShutdownSignals(), onStop);
}
