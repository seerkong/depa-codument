import type { BrowserProviderSelection } from 'halfcode-lite-cli-contract';
import { resolveOneShotBrowserBinding } from 'halfcode-lite-browser-support';

/** Compatibility assertion delegates to the same public mapping that constructs the provider. */
export function assertLocalBrowserBinding(selection: BrowserProviderSelection): void {
  resolveOneShotBrowserBinding(selection);
}
