import { createCodumentResourceContracts } from 'depa-codument-host-adapter/resources';
import { createResourceHostRuntime } from 'halfcode-lite-skill-app-capsule';
import { CODUMENT_AUTHORING_PACKAGE_POLICY } from './authoring-policy';
import { installCodumentDefinitionGlobals } from './definition-globals';

/** Official authored App is codument/; .codument is only the Host's private state. */
export function createCodumentResourceHost(workspaceRoot: string) {
  return createResourceHostRuntime({ workspaceRoot, privateDirectory: '.codument',
    sources: [{ root: 'codument', scope: 'root', origin: 'workspace' }, { root: '.', scope: 'root', origin: 'direct-app' },
      { root: '.agents/skills', scope: 'children', origin: 'installed' }],
  }, { resourceContracts: createCodumentResourceContracts(), authoringPackagePolicy: CODUMENT_AUTHORING_PACKAGE_POLICY,
    beforeLoadDefinitions: () => { installCodumentDefinitionGlobals(); } });
}
