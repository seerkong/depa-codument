import type { BrowserProviderSelection } from 'halfcode-cli-lite-cli-host-contract';
import { resolveOneShotBrowserBinding } from 'halfcode-cli-lite-browser-support';

/** Compatibility assertion delegates to the same public mapping that constructs the provider. */
export function assertLocalBrowserBinding(selection: BrowserProviderSelection): void {
  resolveOneShotBrowserBinding(selection);
}
