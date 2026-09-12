import { createSopNotebookStore as createStore } from 'halfcode-cli-lite-skill-app-support/sop';
import { WORKSPACE_DIR } from '../../identity';
export { renderSopNotebook } from 'halfcode-cli-lite-skill-app-logic/sop/notebook';
export type { SopNotebookBinding, SopNotebookReceipt, SopNotebookStore } from 'halfcode-cli-lite-skill-app-contract/sop';
export function createSopNotebookStore(workspaceRoot: string) {
  return createStore(workspaceRoot, WORKSPACE_DIR);
}
