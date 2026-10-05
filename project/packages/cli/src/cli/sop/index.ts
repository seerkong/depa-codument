import { createSopRuntime as createRuntime } from 'halfcode-lite-skill-app-capsule/sop';
import type { WorkspaceResourceCatalog } from 'halfcode-lite-skill-app-contract/catalog';
import type { SopRuntime } from 'halfcode-lite-skill-app-contract/sop';
import { WORKSPACE_DIR } from '../../identity';
export type * from 'halfcode-lite-skill-app-contract/sop';
export { renderSopMermaid } from 'halfcode-lite-skill-app-logic/sop/mermaid';
export { validateSopSnapshot } from 'halfcode-lite-skill-app-logic/sop/catalog';

export function createSopRuntime(input: { resources: WorkspaceResourceCatalog; workspaceRoot: string }): SopRuntime {
  return createRuntime({ ...input, privateDirectory: WORKSPACE_DIR });
}
