import {
  createBunBundleMaterializer as createMaterializer,
  createBundleDefinitionCatalog as createCatalog,
  createBundleMaterializerRegistry as createRegistry,
  type BundleMaterializer, type BundleMaterializerRegistry,
} from 'halfcode-cli-lite-skill-app-support/resources/bundle-materializer';
import type { HostResourceContractRuntime } from 'halfcode-cli-lite-skill-app-contract/resource-runtime';
import type { WorkspaceResourceSnapshot, WorkspaceResourceCatalog } from 'halfcode-cli-lite-skill-app-contract/catalog';
import { installHostResourceDefinitionGlobals } from './definitions';
import { CODUMENT_AUTHORING_PACKAGE_POLICY } from 'depa-codument-product-capsule/authoring-policy';
import { createHostResourceContractRuntime } from './host-resource-contracts';
export * from 'halfcode-cli-lite-skill-app-support/resources/bundle-materializer';
export function createBunBundleMaterializer(runtime: HostResourceContractRuntime = createHostResourceContractRuntime()) {
  return createMaterializer(runtime, () => { installHostResourceDefinitionGlobals(); }, CODUMENT_AUTHORING_PACKAGE_POLICY);
}
export function createBundleMaterializerRegistry(materializers: readonly BundleMaterializer[] = [createBunBundleMaterializer()]) {
  return createRegistry(materializers);
}
export function createBundleDefinitionCatalog(
  source: WorkspaceResourceSnapshot | WorkspaceResourceCatalog, registry?: BundleMaterializerRegistry,
) {
  return createCatalog(source, registry ?? createRegistry([createBunBundleMaterializer(source.contractRuntime)]));
}
