import { installResourceDefinitionGlobals } from 'halfcode-cli-lite-skill-app-support/resources/definition-globals';

/** Historical scripts share the public definition API, with product-owned global naming only. */
export function installCodumentDefinitionGlobals(target: object = globalThis) {
  return installResourceDefinitionGlobals({ target }, {}, { names: ['Codument'] });
}
