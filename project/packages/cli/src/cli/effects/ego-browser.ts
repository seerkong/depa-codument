export * from 'halfcode-lite-browser-support/ego-browser';
import { createEgoBrowserEffect as createProvider, prepareEgoBrowserTaskSpace as prepareTaskSpace, type EgoBrowserEffectOptions } from 'halfcode-lite-browser-support/ego-browser';
import type { BrowserProviderEffect } from 'halfcode-lite-cli-contract';
export const EGO_BROWSER_TASK_SPACE = 'codument-runtime';
export function createEgoBrowserEffect(options: EgoBrowserEffectOptions = {}): BrowserProviderEffect {
  return createProvider({ ...options, taskSpace: options.taskSpace ?? EGO_BROWSER_TASK_SPACE });
}
export function prepareEgoBrowserTaskSpace(options: EgoBrowserEffectOptions = {}): Promise<void> {
  return prepareTaskSpace({ ...options, taskSpace: options.taskSpace ?? EGO_BROWSER_TASK_SPACE });
}
