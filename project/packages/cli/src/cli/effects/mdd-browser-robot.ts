export * from 'halfcode-lite-browser-support/mdd-browser-robot';
import { createMddBrowserRobotEffect as createProvider, type MddBrowserRobotEffectOptions } from 'halfcode-lite-browser-support/mdd-browser-robot';
import type { BrowserProviderEffect } from 'halfcode-lite-cli-contract';
export const MDD_BROWSER_ROBOT_SESSION = 'codument-runtime';
export function createMddBrowserRobotEffect(options: MddBrowserRobotEffectOptions = {}): BrowserProviderEffect {
  return createProvider({ ...options, session: options.session ?? MDD_BROWSER_ROBOT_SESSION });
}
