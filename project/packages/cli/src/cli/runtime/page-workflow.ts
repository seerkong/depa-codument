import type { PageTargetPort } from 'halfcode-lite-skill-app-contract/page-target';
import type { PageObjectSelector } from 'halfcode-lite-skill-app-contract/runtime-host';
import type { PageAutomationCatalog, PageAutomationRuntime } from 'halfcode-lite-skill-app-contract/page-automation';
import type { CommandRuntime } from '../contracts/command';
import type { BundleDefinitionCatalog } from '../resources/bundle-materializer';
import { createBundleDefinitionCatalog } from '../resources/bundle-materializer';
import { createWorkspaceResourceCatalog } from '../resources/workspace-resource-catalog';
import { createPageAutomationCatalog as createCatalog } from 'halfcode-lite-skill-app-logic/page-automation';
import { createPageWorkflowCoordinator as createCoordinator, invokeInstalledPageObjectAction as invokeAction } from 'halfcode-lite-live-host-capsule/page-automation';
import { createPageAutomationPlatform } from 'halfcode-lite-skill-app-support/page-automation-platform';
export type * from 'halfcode-lite-skill-app-contract/page-automation';

export function createPageAutomationCatalog(definitions: BundleDefinitionCatalog): PageAutomationCatalog;
export function createPageAutomationCatalog(workspaceRoot: string, skillsDirs: readonly string[]): PageAutomationCatalog;
export function createPageAutomationCatalog(source: BundleDefinitionCatalog | string, skillsDirs: readonly string[] = ['.agents/skills']): PageAutomationCatalog {
  return createCatalog(typeof source === 'string' ? createBundleDefinitionCatalog(createWorkspaceResourceCatalog(source, skillsDirs)) : source);
}
function bindings(runtime: CommandRuntime): PageAutomationRuntime {
  return {
    catalog() {
      if (!runtime.page?.automation) throw new Error('Page automation catalog is not configured');
      return runtime.page.automation;
    },
    browser: () => runtime.page?.supervisor,
    workspace: () => runtime.workspace(),
    platform: createPageAutomationPlatform(),
  };
}
export async function listPageAutomationRegistry(runtime: CommandRuntime) {
  return bindings(runtime).catalog().list();
}
export function invokeInstalledPageObjectAction(runtime: CommandRuntime, request: { operationRef: string; input: unknown; selector?: PageObjectSelector }, pages?: PageTargetPort) {
  return invokeAction(bindings(runtime), request, pages);
}
export function createPageWorkflowCoordinator(runtime: CommandRuntime) {
  return createCoordinator(bindings(runtime));
}
