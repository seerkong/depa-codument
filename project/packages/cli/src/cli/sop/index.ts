import { createSopRuntime as createRuntime } from 'halfcode-cli-lite-skill-app-capsule/sop';
import type { WorkspaceResourceCatalog } from 'halfcode-cli-lite-skill-app-contract/catalog';
import type { SopRuntime } from 'halfcode-cli-lite-skill-app-contract/sop';
import { WORKSPACE_DIR } from '../../identity';
export type * from 'halfcode-cli-lite-skill-app-contract/sop';
export { renderSopMermaid } from 'halfcode-cli-lite-skill-app-logic/sop/mermaid';
export { validateSopSnapshot } from 'halfcode-cli-lite-skill-app-logic/sop/catalog';

export function createSopRuntime(input: { resources: WorkspaceResourceCatalog; workspaceRoot: string }): SopRuntime {
  return createRuntime({ ...input, privateDirectory: WORKSPACE_DIR });
}
