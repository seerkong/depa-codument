import { createCodumentResourceContracts } from 'depa-codument-host-adapter/resources';
import { createFileWorkspaceAppSourcePort } from 'depa-codument-domain-support';
import { inspectCodumentWorkspaceApp, lifecycleSourceCodec, renderCodumentAppManifest } from 'depa-codument-domain-logic';
import { createWorkspaceResourceCatalog } from 'halfcode-lite-skill-app-support/resources/workspace-resource-catalog';
import { CODUMENT_APP_CATALOGS, CODUMENT_APP_DIRECTORIES, CODUMENT_APP_DIRECTORY, type WorkspaceAppInspection } from 'depa-codument-domain-contract';
import { CODUMENT_AUTHORING_PACKAGE_POLICY } from './authoring-policy';
export type { WorkspaceAppInspection } from 'depa-codument-domain-contract';

/** Public product construction data; does not write or install the workspace. */
export function createCodumentWorkspaceBlueprint(appId?: string) {
  return Object.freeze({ directory: CODUMENT_APP_DIRECTORY, directories: CODUMENT_APP_DIRECTORIES,
    catalogs: CODUMENT_APP_CATALOGS, manifest: renderCodumentAppManifest(appId) });
}

/** Internal product API; does not register or bypass paused CLI commands. */
export function createCodumentWorkspaceInspector(workspaceRoot: string) {
  const source = createFileWorkspaceAppSourcePort(workspaceRoot, lifecycleSourceCodec);
  const catalog = createWorkspaceResourceCatalog(workspaceRoot, [{ root: 'codument', scope: 'root', origin: 'workspace' }],
    createCodumentResourceContracts(), CODUMENT_AUTHORING_PACKAGE_POLICY);
  return Object.freeze({ async inspect(): Promise<WorkspaceAppInspection> {
    try {
      const before = await source.observe();
      const resources = await catalog.snapshot();
      const after = await source.observe();
      return inspectCodumentWorkspaceApp({ before, after, catalog: resources });
    } catch (error) {
      return { ready: false, memberFiles: [], ownedFiles: [], findings: [{ file: 'codument', severity: 'error',
        rule: 'workspace.source', message: String(error) }] };
    }
  } });
}
