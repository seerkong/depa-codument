import type { HostResourceDefinitionApi } from 'halfcode-cli-lite-skill-app-logic/resources/definitions';
import { installCodumentDefinitionGlobals } from 'depa-codument-product-capsule/definition-globals';
export * from 'halfcode-cli-lite-skill-app-logic/resources/definitions';
declare global { var Codument: HostResourceDefinitionApi | undefined; }
/** Product-only adapter for historical script bundles. Portable apps use package imports. */
export function installHostResourceDefinitionGlobals(): HostResourceDefinitionApi {
  return installCodumentDefinitionGlobals();
}
