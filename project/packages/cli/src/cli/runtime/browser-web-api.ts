import type { CommandRuntime } from '../contracts/command';
import { createProfiledBrowserWebApiEffect } from '../effects/profiled-browser-web-api';
import type { BrowserWebApiDefinition } from '../resources/definitions';
import { createBundleDefinitionCatalog, type BundleDefinitionCatalog } from '../resources/bundle-materializer';
import { resolveConfigurationProfile } from '../resources/profile-configuration';
import { invokeBrowserWebApiDefinition } from '../resources/schema-validator';

export async function invokeBrowserWebApi(options: {
  readonly runtime: CommandRuntime;
  readonly fqn: string;
  readonly input: unknown;
  readonly profile?: string;
  readonly session?: string;
}): Promise<Readonly<{ result: unknown; profile: string; endpointKey: string; transport: string }>> {
  const definitions: BundleDefinitionCatalog = options.runtime.definitionCatalog
    ?? (options.runtime.resourceCatalog ? createBundleDefinitionCatalog(options.runtime.resourceCatalog) : (() => { throw new Error('Bundle definition catalog is not configured'); })());
  const definition = await definitions.detail(options.fqn);
  if (definition.kind !== 'BrowserWebApi') throw new Error(`${options.fqn} is ${definition.kind}, not BrowserWebApi`);
  const catalog = options.runtime.configurationProfiles;
  if (!catalog) throw new Error('ConfigurationProfile catalog is not configured');
  const profile = await resolveConfigurationProfile(catalog, {
    selector: options.profile,
    defaultSelector: await options.runtime.defaultConfigurationProfile?.(),
  });
  const selection = await options.runtime.defaultBrowserSelection?.() ?? { transport: 'ego-browser' as const };
  const provider = options.runtime.browserProviderFor?.({ ...selection, session: options.session }) ?? options.runtime.browserProvider;
  if (!provider) throw new Error('Browser provider effect is not configured');
  const effect = createProfiledBrowserWebApiEffect({ profile, endpointKey: definition.endpointKey, provider });
  const result = await invokeBrowserWebApiDefinition(definition as BrowserWebApiDefinition, { browserWebApi: effect }, options.input);
  return Object.freeze({ result, profile: profile.profile, endpointKey: definition.endpointKey, transport: provider.transport });
}
