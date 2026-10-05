import type { PageRegistryOptions, PageRegistryEntry, PageAsset, PageAgentWorkflowCatalog, PageResourceCatalog } from 'halfcode-lite-skill-app-contract/page-registry';
import type { PageBuildStateProvider } from 'halfcode-lite-skill-app-contract/page-build';
import { createPageResourceCatalog as createCatalog, inspectPageRegistry, inspectPageAsset } from 'halfcode-lite-skill-app-support/page-registry';
import { createWorkspaceResourceCatalog, type WorkspaceResourceCatalog } from '../resources/workspace-resource-catalog';
export type * from 'halfcode-lite-skill-app-contract/page-registry';

export function createPageResourceCatalog(
  resources: WorkspaceResourceCatalog,
  workflows?: PageAgentWorkflowCatalog,
  buildStates?: PageBuildStateProvider,
): PageResourceCatalog;
export function createPageResourceCatalog(
  workspaceRoot: string,
  skillsDirs?: readonly string[],
  workflows?: PageAgentWorkflowCatalog,
  buildStates?: PageBuildStateProvider,
): PageResourceCatalog;
export function createPageResourceCatalog(
  source: WorkspaceResourceCatalog | string,
  skillsOrWorkflows?: readonly string[] | PageAgentWorkflowCatalog,
  workflowsOrBuildStates?: PageAgentWorkflowCatalog | PageBuildStateProvider,
  legacyBuildStates?: PageBuildStateProvider,
): PageResourceCatalog {
  const resources = typeof source === 'string'
    ? createWorkspaceResourceCatalog(source, Array.isArray(skillsOrWorkflows) ? skillsOrWorkflows : ['.agents/skills'])
    : source;
  const workflows = typeof source === 'string'
    ? workflowsOrBuildStates as PageAgentWorkflowCatalog | undefined
    : skillsOrWorkflows as PageAgentWorkflowCatalog | undefined;
  const buildStates = typeof source === 'string'
    ? legacyBuildStates
    : workflowsOrBuildStates as PageBuildStateProvider | undefined;
  return createCatalog(resources, workflows, buildStates);
}

function resources(workspaceRoot: string, options: PageRegistryOptions) {
  return createWorkspaceResourceCatalog(workspaceRoot, options.includeSkillPages === false ? [] : options.skillsDirs ?? ['.agents/skills']);
}
export async function listPageRegistry(workspaceRoot: string, options: PageRegistryOptions = {}): Promise<PageRegistryEntry[]> {
  return inspectPageRegistry(resources(workspaceRoot, options));
}
export async function getPageRegistryEntry(workspaceRoot: string, name: string, options: PageRegistryOptions = {}): Promise<PageRegistryEntry | undefined> {
  return (await inspectPageRegistry(resources(workspaceRoot, options))).find(entry => entry.name === name);
}
export function resolvePageAsset(workspaceRoot: string, name: string, assetPath: string, options: PageRegistryOptions = {}): Promise<PageAsset | undefined> {
  return inspectPageAsset(resources(workspaceRoot, options), name, assetPath);
}
