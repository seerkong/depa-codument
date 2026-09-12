import * as path from 'node:path';
import { createResourceHostRuntime } from 'halfcode-cli-lite-skill-app-capsule';
import { createPageHostRuntime, type PageProjectionRuntime } from 'halfcode-cli-lite-live-host-capsule/pages';
import { createRuntimeLifetime } from 'halfcode-cli-lite-cli-host-capsule/runtime-lifetime';
import { createOneShotBrowserProvider } from 'halfcode-cli-lite-browser-support';
import type { CommandExecutionPolicy } from 'halfcode-cli-lite-cli-host-contract';
import { createPageBuildPlatform } from 'halfcode-cli-lite-skill-app-support/page-build-platform';
import { createPageAutomationPlatform } from 'halfcode-cli-lite-skill-app-support/page-automation-platform';
import { WORKSPACE_DIR } from '../identity';
import type { CommandRuntime } from './contracts/command';
import { createCodexEffect } from './effects/codex';
import { createResourceEffect } from './effects/resource';
import { createWorkspaceEffect } from './effects/workspace';
import {
  DEFAULT_PAGE_CONTROL_AGENT,
  createServeProcessEffect,
  type PageControlAgent,
} from './runtime/serve-process';
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

/** Selects the exact command's capability closure. A parent policy is never inherited. */
export function createCliCommandRuntime(
  root: string,
  policy: CommandExecutionPolicy,
  options: RuntimeOptions & { serveChild?: boolean } = {},
): CommandRuntime {
  if (!Object.hasOwn(PROFILE_PLACEMENTS, policy.runtimeProfile)
    || PROFILE_PLACEMENTS[policy.runtimeProfile as keyof typeof PROFILE_PLACEMENTS] !== policy.placement) {
    throw new Error(`Unsupported command execution policy: ${policy.placement}/${policy.runtimeProfile}`);
  }
  const profile = policy.runtimeProfile as Exclude<RuntimeProfile, 'serve-host'>;
  return composeCommandRuntime(root, options, options.serveChild && profile === 'serve-manager' ? 'serve-host' : profile);
}

/** Explicit full host composition for HTTP embedders; ordinary CLI uses createCliCommandRuntime. */
export function createCommandRuntime(
  root = process.cwd(),
  options: RuntimeOptions = {},
): CommandRuntime {
  return composeCommandRuntime(root, options, 'serve-host');
}

function composeCommandRuntime(
  root: string,
  options: RuntimeOptions,
  profile: RuntimeProfile,
): CommandRuntime {
  const workspaceRoot = path.resolve(root);
  const agent = options.agent ?? DEFAULT_PAGE_CONTROL_AGENT;
  const live = profile === 'serve-host' || profile === 'mcp-connection';
  const serveClient = profile === 'serve-client' || profile === 'serve-manager';
  const resources = createResourceEffect();
  const basic = { resources, workspace: (dir?: string) => createWorkspaceEffect(dir ? path.resolve(workspaceRoot, dir) : workspaceRoot), agent };
  if (profile === 'basic') return basic;
  if (profile === 'domain' || profile === 'domain-registry') return { ...basic, ...createCodumentDomainRuntime(workspaceRoot, {
    validation: { file: 'codument', profileNames: [] }, context: options.domainContext, json: options.json,
    clock: { nowIso: () => new Date().toISOString() }, env: { ...process.env },
    output: { write: bytes => { process.stderr.write(bytes); } },
  }) };
  if (serveClient) return { ...basic, httpFetch: fetch, serveProcess: createServeProcessEffect() };
  const egoTaskSpace = process.env.CODUMENT_EGO_TASK_SPACE?.trim();
  const egoSupervisor = live && egoTaskSpace ? createEgoBrowserSupervisor({ taskSpace: egoTaskSpace }) : undefined;
  const codex = profile === 'serve-host' ? createCodexEffect({ cwd: workspaceRoot }) : undefined;
  const resourceContracts = createHostResourceContractRuntime();
  const materializers = createBundleMaterializerRegistry([createBunBundleMaterializer(resourceContracts)]);
  const resourceHost = createResourceHostRuntime({
    workspaceRoot, privateDirectory: WORKSPACE_DIR,
    sources: [
      { root: 'codument', scope: 'root', origin: 'workspace' },
      // Standalone non-Codument Skill Apps remain readable; initialization owns only codument/.
      { root: '.', scope: 'root', origin: 'direct-app' },
      { root: PAGE_SKILLS_DIRS[agent], scope: 'children', origin: 'installed' },
    ],
  }, { resourceContracts, authoringPackagePolicy: CODUMENT_AUTHORING_PACKAGE_POLICY,
    materializers, releaseMaterializers: () => materializers.close!() });
  const { resourceCatalog, definitionCatalog, configurationProfiles, sop } = resourceHost;
  const browserProviderFor: BrowserProviderFactory = selection => createOneShotBrowserProvider(
    { ...selection, session: selection.session ?? 'codument-runtime' },
    { opencli: { pluginSite: 'codument-opencli', pluginDir: () => materializeOpenCliPlugin({ resources }) } },
  ).provider;
  const runtime: CommandRuntime = {
    resources,
    async inspectWorkspaceApp() {
      if (await basic.workspace().kind('codument') === undefined) return undefined;
      return createCodumentWorkspaceInspector(workspaceRoot).inspect();
    },
    resourceCatalog,
    definitionCatalog,
    configurationProfiles,
    sop,
    resolveRequestRuntime: options.resolveRequestRuntime,
    workspace(dir?: string) {
      return createWorkspaceEffect(dir ? path.resolve(workspaceRoot, dir) : workspaceRoot);
    },
    agent,
    browserProviderFor,
    async defaultBrowserSelection() {
      const browser = (await readWorkspaceConfig(createWorkspaceEffect(workspaceRoot))).browser;
      return {
        transport: browser?.transport ?? 'ego-browser',
        ...(browser?.transport === 'opencli'
          ? { backend: { transport: browser.opencli?.transport ?? 'plugin' } }
          : browser?.transport === 'mdd-browser-robot'
            ? { backend: { transport: browser['mdd-browser-robot']?.transport ?? 'chrome-extension' } }
          : {}),
      };
    },
    async defaultConfigurationProfile() {
      return (await readWorkspaceConfig(createWorkspaceEffect(workspaceRoot))).configuration?.defaultProfile;
    },
    ...(profile === 'serve-client-preflight' || profile === 'serve-host' ? { httpFetch: fetch, serveProcess: createServeProcessEffect() } : {}),
    ...(profile === 'serve-host' ? { httpServer: createServeHttpEffect(), ego: createEgoEffect(), codex } : {}),
  };
  let pageHost: PageProjectionRuntime | undefined;
  if (live) {
    const pageBindings = {
      resources: resourceCatalog, definitions: definitionCatalog,
      buildPlatform: createPageBuildPlatform(), builder: createVuePageBuilderPort(),
      generationStore: createFilePageGenerationStore(workspaceRoot),
    };
    const pageRuntime = createPageHostRuntime({
      ...pageBindings, workspace: () => runtime.workspace(), browser: () => runtime.page?.supervisor,
      automationPlatform: createPageAutomationPlatform(),
    });
    pageHost = pageRuntime;
    runtime.page = {
      ...pageRuntime,
      skillsDirs: [PAGE_SKILLS_DIRS[agent]],
      transport: 'ego-browser',
      session: egoTaskSpace ?? 'codument-runtime',
      ...(egoSupervisor ? { transport: 'ego-browser' as const, session: egoTaskSpace, browserProvider: egoSupervisor, supervisor: egoSupervisor } : {}),
    };
  }
  if (profile === 'page-catalog') {
    const automation = createPageAutomationCatalog(definitionCatalog);
    const pages = createPageResourceCatalog(resourceCatalog, automation);
    runtime.page = { skillsDirs: [PAGE_SKILLS_DIRS[agent]], automation, pages,
      sites: createSiteResourceCatalog(resourceCatalog, pages) };
  }
  runtime.localFunctions = createLocalFunctionCatalog(definitionCatalog);
  if (profile === 'local-function') {
    runtime.invokeServeLocalFunction = (input) => invokeServeLocalFunction({
      resources, workspace: runtime.workspace, agent, httpFetch: fetch, serveProcess: createServeProcessEffect(),
    }, input);
  }
  const lifetime = createRuntimeLifetime({ execution: [runtime.localFunctions],
    live: [...(pageHost ? [pageHost] : []), ...(codex ? [codex] : [])],
    providers: egoSupervisor ? [egoSupervisor] : [], resources: [resourceHost] });
  runtime.close = () => lifetime.close();
  return runtime;
}
import { createCodumentWorkspaceInspector } from 'depa-codument-product-capsule/workspace-app';
