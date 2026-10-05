import type { CommandRuntime } from './contracts/command';
type RequiredPorts<K extends keyof CommandRuntime> = Required<Pick<CommandRuntime, K>>;
type Basic = Pick<CommandRuntime, 'resources' | 'workspace' | 'agent' | 'domainJson'> & Pick<CommandRuntime, Extract<keyof CommandRuntime, 'dispose' | 'close'>>;
type Catalog = Basic & RequiredPorts<'resourceCatalog' | 'definitionCatalog' | 'configurationProfiles' | 'sop' | 'localFunctions' | 'defaultConfigurationProfile'>;
type Browser = Catalog & RequiredPorts<'browserProviderFor' | 'defaultBrowserSelection'>;
type PageCatalog = Catalog & {
    page: {
        skillsDirs: readonly string[];
    } & Required<Pick<NonNullable<CommandRuntime['page']>, 'pages' | 'sites' | 'automation'>>;
};
type Client = Basic & RequiredPorts<'httpFetch' | 'serveProcess'>;
type Live = Browser & PageCatalog & RequiredPorts<'httpFetch' | 'serveProcess' | 'httpServer'> & {
    page: PageCatalog['page'] & Required<Pick<NonNullable<CommandRuntime['page']>, 'workflows' | 'builds'>>;
};
export interface ProductRuntimeProfiles {
    basic: Basic;
    catalog: Catalog;
    'page-catalog': PageCatalog;
    browser: Browser;
    'serve-client': Client;
    'serve-manager': Client;
    'serve-host': Live;
    'mcp-connection': Browser & PageCatalog & {
        page: PageCatalog['page'] & Required<Pick<NonNullable<CommandRuntime['page']>, 'workflows' | 'builds'>>;
    };
    'local-function': Catalog & RequiredPorts<'invokeServeLocalFunction'>;
    domain: Basic & ReturnType<typeof import('depa-codument-product-capsule').createCodumentDomainRuntime>;
    'domain-registry': ProductRuntimeProfiles['domain'];
    'serve-client-preflight': Catalog & Client;
}
/** Every production branch must construct its declared required ports before routing.
 * The broad CommandRuntime remains only the borrowed/legacy embedder contract.
 */
export type ProductionRuntime = {
    [K in keyof ProductRuntimeProfiles]: ProductRuntimeProfiles[K] & {
        readonly profile: K;
    };
}[keyof ProductRuntimeProfiles];
export function completeRuntimeProfile<K extends keyof ProductRuntimeProfiles, R extends ProductRuntimeProfiles[NoInfer<K>]>(profile: K, runtime: R): R & {
    readonly profile: K;
} {
    return Object.assign(runtime, { profile });
}
export function resourceRuntime(runtime: ProductionRuntime) {
    if (!('resourceCatalog' in runtime))
        throw new Error('Selected profile has no resource capability: ' + runtime.profile);
    return runtime;
}
export function pageRuntime(runtime: ProductionRuntime) {
    if (!('page' in runtime))
        throw new Error('Selected profile has no Page capability: ' + runtime.profile);
    return runtime;
}
export function browserRuntime(runtime: ProductionRuntime) {
    if (!('browserProviderFor' in runtime))
        throw new Error('Selected profile has no browser capability: ' + runtime.profile);
    return runtime;
}
export function clientRuntime(runtime: ProductionRuntime) {
    if (!('serveProcess' in runtime))
        throw new Error('Selected profile has no live client capability: ' + runtime.profile);
    return runtime;
}
export function liveRuntime(runtime: ProductionRuntime) {
    if (runtime.profile !== 'serve-host' && runtime.profile !== 'mcp-connection')
        throw new Error('Selected profile has no live host capability: ' + runtime.profile);
    return runtime;
}
