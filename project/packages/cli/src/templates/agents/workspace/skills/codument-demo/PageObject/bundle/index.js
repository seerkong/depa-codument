// Stable source-import compatibility shim. Runtime authority lives in modules/*/host HostBundles.
import { resourceDefinitions as googleDefinitions } from '../../modules/google-search/host/entry.ts';
import { resourceDefinitions as owidDefinitions } from '../../modules/owid-open-data-export/host/entry.ts';

export * from '../../modules/google-search/host/logic/search.ts';
export * from '../../modules/owid-open-data-export/host/logic/owid.ts';

export const resourceDefinitions = [...googleDefinitions, ...owidDefinitions]
  .filter((definition) => definition.kind === 'PageObject');
