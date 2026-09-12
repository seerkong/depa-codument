import type { CodexEffect } from '../effects/codex';
import type { EgoEffect } from '../effects/ego';
import type {
  BrowserProviderEffect,
  BrowserProviderFactory,
  BrowserProviderSelection,
  BrowserTransport,
} from '../effects/browser-provider';
import type { ResourceEffect } from '../effects/resource';
import type { WorkspaceEffect } from '../effects/workspace';
import type { PageControlAgent, ServeProcessEffect } from '../runtime/serve-process';
import type { EgoBrowserSupervisor } from '../runtime/ego-supervisor';
import type { PageWorkflowCoordinator, PageAutomationCatalog } from 'halfcode-cli-lite-skill-app-contract/page-automation';
import type { PageResourceCatalog } from 'halfcode-cli-lite-skill-app-contract/page-registry';
import type { SiteResourceCatalog } from 'halfcode-cli-lite-skill-app-contract/site-registry';
import type { ServeHttpEffect } from '../http/serve-effect';
import type { LocalFunctionCatalog } from '../runtime/local-functions';
import type { PageBuildRuntime } from 'halfcode-cli-lite-skill-app-contract/page-build';
import type { WorkspaceResourceCatalog } from '../resources/workspace-resource-catalog';
import type { BundleDefinitionCatalog } from '../resources/bundle-materializer';
import type { ConfigurationProfileCatalog } from '../resources/profile-configuration';
import type { SopRuntime } from '../sop';

import type { CodumentDomainCommandRuntime } from 'depa-codument-host-adapter';
import type { WorkspaceAppInspection } from 'depa-codument-product-capsule/workspace-app';

export interface CommandRuntime extends CodumentDomainCommandRuntime {
  /** Product aggregate validation; undefined means no formal Codument directory. */
  inspectWorkspaceApp?: () => Promise<WorkspaceAppInspection | undefined>;
  close?(): Promise<void>;
  resources: ResourceEffect;
  resourceCatalog?: WorkspaceResourceCatalog;
  definitionCatalog?: BundleDefinitionCatalog;
  configurationProfiles?: ConfigurationProfileCatalog;
  defaultConfigurationProfile?: () => Promise<string | undefined>;
  sop?: SopRuntime;
  workspace(root?: string): WorkspaceEffect;
  resolveRequestRuntime?: () => Promise<CommandRuntime>;
  agent?: PageControlAgent;
  browserProvider?: BrowserProviderEffect;
  browserProviderFor?: BrowserProviderFactory;
  defaultBrowserSelection?: () => Promise<BrowserProviderSelection>;
  httpFetch?: typeof fetch;
  httpServer?: ServeHttpEffect;
  page?: {
    close?(): Promise<void>;
    skillsDirs: readonly string[];
    transport?: BrowserTransport;
    session?: string;
    browserProvider?: BrowserProviderEffect;
    supervisor?: EgoBrowserSupervisor;
    workflows?: PageWorkflowCoordinator;
    pages?: PageResourceCatalog;
    sites?: SiteResourceCatalog;
    builds?: PageBuildRuntime;
    automation?: PageAutomationCatalog;
  };
  serveProcess?: ServeProcessEffect;
  localFunctions?: LocalFunctionCatalog;
  /** Lazy, typed long-lived invocation port; ordinary local calls never acquire its transport. */
  invokeServeLocalFunction?: (input: {
    fqn: string; input: unknown; config: unknown; profile: string | null; admissionDigest: string;
  }) => Promise<unknown>;
  codex?: CodexEffect;
  ego?: EgoEffect;
}


import type {
  CommandContext as HostCommandContext, CommandSchema as HostCommandSchema,
  CommandRun as HostCommandRun,
} from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema as createHostArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
export type { CommandResult, CommandDoc, CommandOption } from 'halfcode-cli-lite-cli-host-contract';
export { argvSchema } from 'halfcode-cli-lite-cli-host-logic';
export type CommandContext = HostCommandContext<CommandRuntime>;
export type CommandSchema = HostCommandSchema<CommandRuntime>;
export type CommandRun = HostCommandRun<CommandRuntime>;
export const createArgvSchema = createHostArgvSchema<CommandRuntime>;
