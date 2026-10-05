export * from 'halfcode-lite-browser-support/opencli';
import { createOpenCliEffect as createProvider, type OpenCliEffectOptions, type OpenCliProviderEffect } from 'halfcode-lite-browser-support/opencli';
import { materializeOpenCliPlugin } from './opencli-plugin';
import { createResourceEffect } from './resource';
export const OPENCLI_PLUGIN_SITE = 'codument-opencli';
export const OPENCLI_SESSION = 'codument-runtime';
export function createOpenCliEffect(options: OpenCliEffectOptions = {}): OpenCliProviderEffect {
  return createProvider({
    ...options, session: options.session ?? OPENCLI_SESSION,
    pluginSite: options.pluginSite ?? OPENCLI_PLUGIN_SITE,
    pluginDir: options.pluginDir ?? (() => materializeOpenCliPlugin({ resources: createResourceEffect() })),
  });
}
