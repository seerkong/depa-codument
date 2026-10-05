import { completeRuntimeProfile, type ProductionRuntime } from './runtime-profiles';
import * as path from 'node:path';
import { createResourceHostRuntime } from 'halfcode-lite-skill-app-capsule';
import { createPageHostRuntime, type PageProjectionRuntime } from 'halfcode-lite-live-host-capsule/pages';
import { createRuntimeLifetime } from 'halfcode-lite-cli-capsule/runtime-lifetime';
import { createOneShotBrowserProvider } from 'halfcode-lite-browser-support';
import type { CommandExecutionPolicy } from 'halfcode-lite-cli-contract';
import { createPageBuildPlatform } from 'halfcode-lite-skill-app-support/page-build-platform';
import { createPageAutomationPlatform } from 'halfcode-lite-skill-app-support/page-automation-platform';
import { WORKSPACE_DIR } from '../identity';
import type { CommandRuntime } from './contracts/command';
import { createCodexEffect } from './effects/codex';
import { createResourceEffect } from './effects/resource';
import { createWorkspaceEffect } from './effects/workspace';
import { DEFAULT_PAGE_CONTROL_AGENT, createServeProcessEffect, type PageControlAgent, } from './runtime/serve-process';
import { createEgoBrowserSupervisor } from './runtime/ego-supervisor';
import type { BrowserProviderFactory } from './effects/browser-provider';
import { materializeOpenCliPlugin } from './effects/opencli-plugin';
import { createServeHttpEffect } from './http/serve-effect';
import { createEgoEffect } from './effects/ego';
import { readWorkspaceConfig } from './install';
import { createLocalFunctionCatalog } from './runtime/local-functions';
import { invokeServeLocalFunction } from './runtime/local-function-execution';
import { createPageAutomationCatalog } from './runtime/page-workflow';
import { createPageResourceCatalog } from './runtime/page-registry';
import { createSiteResourceCatalog } from './runtime/site-registry';
import { createFilePageGenerationStore } from './runtime/page-build';
import { createVuePageBuilderPort } from './runtime/vue-page-builder';
import { createHostResourceContractRuntime } from './resources/host-resource-contracts';
import { createBundleMaterializerRegistry, createBunBundleMaterializer } from './resources/bundle-materializer';
import { CODUMENT_AUTHORING_PACKAGE_POLICY } from 'depa-codument-product-capsule/authoring-policy';
import { createCodumentDomainRuntime, type CodumentDomainBindings } from 'depa-codument-product-capsule';
const PAGE_SKILLS_DIRS: Record<PageControlAgent, string> = {
    codex: '.agents/skills',
};
interface RuntimeOptions {
    json?: boolean;
    domainContext?: CodumentDomainBindings['context'];
    agent?: PageControlAgent;
    resolveRequestRuntime?: () => Promise<CommandRuntime>;
}
type RuntimeProfile = 'basic' | 'domain' | 'domain-registry' | 'catalog' | 'page-catalog' | 'local-function' | 'browser' | 'serve-client' | 'serve-client-preflight' | 'serve-manager' | 'mcp-connection' | 'serve-host';
const PROFILE_PLACEMENTS = {
    basic: 'local', domain: 'local', 'domain-registry': 'local', catalog: 'local', 'page-catalog': 'local',
    'local-function': 'dynamic', browser: 'dynamic',
    'serve-client': 'serve-required', 'serve-manager': 'entrypoint', 'mcp-connection': 'entrypoint',
    'serve-client-preflight': 'serve-required',
} as const;
export type ProductExecutionPolicy = {
    [K in keyof typeof PROFILE_PLACEMENTS]: {
        readonly placement: typeof PROFILE_PLACEMENTS[K];
        readonly runtimeProfile: K;
    };
}[keyof typeof PROFILE_PLACEMENTS];
/** Admission of dynamic registry/legacy data; static producers use ProductExecutionPolicy directly. */
export function admitProductExecutionPolicy(policy: CommandExecutionPolicy): ProductExecutionPolicy {
    for (const [runtimeProfile, placement] of Object.entries(PROFILE_PLACEMENTS)) {
        if (policy.runtimeProfile === runtimeProfile && policy.placement === placement)
            return policy as ProductExecutionPolicy;
    }
    throw new Error('Unsupported command execution policy: ' + policy.placement + '/' + policy.runtimeProfile);
}
/** Selects the exact command's capability closure. A parent policy is never inherited. */
export function createProductionCommandRuntime(root: string, policy: ProductExecutionPolicy, options: RuntimeOptions & {
    serveChild?: boolean;
} = {}): ProductionRuntime {
    if (!Object.hasOwn(PROFILE_PLACEMENTS, policy.runtimeProfile)
        || PROFILE_PLACEMENTS[policy.runtimeProfile as keyof typeof PROFILE_PLACEMENTS] !== policy.placement) {
        throw new Error(`Unsupported command execution policy: ${policy.placement}/${policy.runtimeProfile}`);
    }
    const profile = policy.runtimeProfile as Exclude<RuntimeProfile, 'serve-host'>;
    return composeCommandRuntime(root, options, options.serveChild && profile === 'serve-manager' ? 'serve-host' : profile);
}
/** Borrowed legacy embedder facade; CLI production routes through required profiles. */
export function createCliCommandRuntime(root: string, policy: CommandExecutionPolicy, options: RuntimeOptions & {
    serveChild?: boolean;
} = {}): CommandRuntime {
    return createProductionCommandRuntime(root, admitProductExecutionPolicy(policy), options);
}
/** Explicit full host composition for HTTP embedders; ordinary CLI uses createCliCommandRuntime. */
export function createCommandRuntime(root = process.cwd(), options: RuntimeOptions = {}): CommandRuntime {
    return composeCommandRuntime(root, options, 'serve-host');
}
function composeCommandRuntime(root: string, options: RuntimeOptions, profile: RuntimeProfile): ProductionRuntime {
    const workspaceRoot = path.resolve(root);
    const agent = options.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
    const resources = createResourceEffect();
    const basic = { resources, workspace: (dir?: string) => createWorkspaceEffect(dir ? path.resolve(workspaceRoot, dir) : workspaceRoot), agent };
    if (profile === 'basic')
        return completeRuntimeProfile(profile, basic);
    if (profile === 'domain' || profile === 'domain-registry')
        return completeRuntimeProfile(profile, { ...basic, ...createCodumentDomainRuntime(workspaceRoot, {
                validation: { file: 'codument', profileNames: [] }, context: options.domainContext, json: options.json,
                clock: { nowIso: () => new Date().toISOString() }, env: { ...process.env }, output: { write: bytes => { process.stderr.write(bytes); } },
            }) });
    if (profile === 'serve-client' || profile === 'serve-manager')
        return completeRuntimeProfile(profile, { ...basic, httpFetch: fetch, serveProcess: createServeProcessEffect() });
    const resourceContracts = createHostResourceContractRuntime();
    const materializers = createBundleMaterializerRegistry([createBunBundleMaterializer(resourceContracts)]);
    const resourceHost = createResourceHostRuntime({
        workspaceRoot, privateDirectory: WORKSPACE_DIR,
        sources: [{ root: 'codument', scope: 'root', origin: 'workspace' }, { root: '.', scope: 'root', origin: 'direct-app' }, { root: PAGE_SKILLS_DIRS[agent], scope: 'children', origin: 'installed' }],
    }, { resourceContracts, authoringPackagePolicy: CODUMENT_AUTHORING_PACKAGE_POLICY, materializers, releaseMaterializers: () => materializers.close!() });
    const { resourceCatalog, definitionCatalog, configurationProfiles, sop } = resourceHost;
    const localFunctions = createLocalFunctionCatalog(definitionCatalog);
    const catalog = { ...basic, resourceCatalog, definitionCatalog, configurationProfiles, sop, localFunctions,
        async inspectWorkspaceApp() {
            if (await basic.workspace().kind('codument') === undefined)
                return undefined;
            return createCodumentWorkspaceInspector(workspaceRoot).inspect();
        },
        defaultConfigurationProfile: async () => (await readWorkspaceConfig(basic.workspace())).configuration?.defaultProfile,
    };
    const catalogLifetime = () => {
        const lifetime = createRuntimeLifetime({ execution: [localFunctions], live: [], providers: [], resources: [resourceHost] });
        return { ...catalog, close: () => lifetime.close() };
    };
    if (profile === 'catalog')
        return completeRuntimeProfile(profile, catalogLifetime());
    if (profile === 'serve-client-preflight')
        return completeRuntimeProfile(profile, { ...catalogLifetime(), httpFetch: fetch, serveProcess: createServeProcessEffect() });
    if (profile === 'local-function')
        return completeRuntimeProfile(profile, { ...catalogLifetime(),
            invokeServeLocalFunction: (input: Parameters<typeof invokeServeLocalFunction>[1]) => invokeServeLocalFunction({ ...basic, httpFetch: fetch, serveProcess: createServeProcessEffect() }, input),
        });
    if (profile === 'page-catalog') {
        const automation = createPageAutomationCatalog(definitionCatalog);
        const pages = createPageResourceCatalog(resourceCatalog, automation);
        return completeRuntimeProfile(profile, { ...catalogLifetime(), page: { skillsDirs: [PAGE_SKILLS_DIRS[agent]], automation, pages, sites: createSiteResourceCatalog(resourceCatalog, pages) } });
    }
    const browserProviderFor: BrowserProviderFactory = selection => createOneShotBrowserProvider({ ...selection, session: selection.session ?? 'codument-runtime' }, { opencli: { pluginSite: 'codument-opencli', pluginDir: () => materializeOpenCliPlugin({ resources }) } }).provider;
    const defaultBrowserSelection: NonNullable<CommandRuntime['defaultBrowserSelection']> = async () => {
        const browser = (await readWorkspaceConfig(basic.workspace())).browser;
        return { transport: browser?.transport ?? 'ego-browser',
            ...(browser?.transport === 'opencli' ? { backend: { transport: browser.opencli?.transport ?? 'plugin' } } :
                browser?.transport === 'mdd-browser-robot' ? { backend: { transport: browser['mdd-browser-robot']?.transport ?? 'chrome-extension' } } : {}) };
    };
    const browser = { ...catalog, browserProviderFor, defaultBrowserSelection };
    if (profile === 'browser')
        return completeRuntimeProfile(profile, { ...catalogLifetime(), ...browser });
    const egoTaskSpace = process.env.CODUMENT_EGO_TASK_SPACE?.trim();
    const egoSupervisor = egoTaskSpace ? createEgoBrowserSupervisor({ taskSpace: egoTaskSpace }) : undefined;
    const codex = profile === 'serve-host' ? createCodexEffect({ cwd: workspaceRoot }) : undefined;
    let pageBinding: Pick<CommandRuntime, 'page'> = {};
    const pageHost = createPageHostRuntime({
        resources: resourceCatalog, definitions: definitionCatalog, buildPlatform: createPageBuildPlatform(), builder: createVuePageBuilderPort(),
        generationStore: createFilePageGenerationStore(workspaceRoot), workspace: () => basic.workspace(), browser: () => pageBinding.page?.supervisor,
        automationPlatform: createPageAutomationPlatform(),
    });
    const lifetime = createRuntimeLifetime({ execution: [localFunctions], live: [pageHost, ...(codex ? [codex] : [])], providers: egoSupervisor ? [egoSupervisor] : [], resources: [resourceHost] });
    const live = {
        ...browser, resolveRequestRuntime: options.resolveRequestRuntime,
        page: { ...pageHost, skillsDirs: [PAGE_SKILLS_DIRS[agent]], transport: 'ego-browser' as const, session: egoTaskSpace ?? 'codument-runtime',
            ...(egoSupervisor ? { browserProvider: egoSupervisor, supervisor: egoSupervisor } : {}) },
        close: () => lifetime.close(),
    };
    pageBinding = live;
    if (profile === 'mcp-connection')
        return completeRuntimeProfile(profile, live);
    return completeRuntimeProfile(profile, { ...live, httpFetch: fetch, serveProcess: createServeProcessEffect(), httpServer: createServeHttpEffect(), ego: createEgoEffect(), codex });
}
import { createCodumentWorkspaceInspector } from 'depa-codument-product-capsule/workspace-app';
