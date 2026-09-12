import { CODUMENT_AUTHORING_PACKAGE_POLICY } from 'depa-codument-product-capsule/authoring-policy';
import { createWorkspaceResourceCatalog as createCatalog } from 'halfcode-cli-lite-skill-app-support/resources/workspace-resource-catalog';
import { createHostResourceContractRuntime } from './host-resource-contracts';
export * from 'halfcode-cli-lite-skill-app-contract/catalog';
export function createWorkspaceResourceCatalog(workspaceRoot: string, sources: Parameters<typeof createCatalog>[1],
  contracts = createHostResourceContractRuntime()) {
  return createCatalog(workspaceRoot, sources, contracts, CODUMENT_AUTHORING_PACKAGE_POLICY);
}
