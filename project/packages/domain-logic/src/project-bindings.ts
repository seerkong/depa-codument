import { parseXnl, type DataElementNode } from 'xnl-core';
import { WORKSPACE_BINDINGS_PATH, type WorkspaceBindingCommand, type WorkspaceBindingResult, type WorkspaceBindingRuntime } from 'depa-codument-domain-contract';
import { isDataElement } from './registry';
import { patchLifecycleSource, patchRootBodySource } from './source-patch';

export async function applyWorkspaceBinding(runtime: WorkspaceBindingRuntime, request: WorkspaceBindingCommand): Promise<WorkspaceBindingResult> {
  const input = structuredClone(request);
  const snapshot = await runtime.source.read(WORKSPACE_BINDINGS_PATH);
  if (input.operation === 'bindings') return { bindings: bindingRows(readWorkspaceBindingSources(snapshot.source)) };
  const workspacePath = input.operation === 'bind' ? runtime.paths.resolve(input.workspacePath) : undefined;
  const proposed = proposeWorkspaceBinding(snapshot.source, input.projectRef, workspacePath);
  await runtime.privacy.ensureIgnored();
  const receipt = proposed === snapshot.source ? undefined : await runtime.source.commit(snapshot, proposed);
  const bindings = bindingRows(readWorkspaceBindingSources(proposed));
  return { bindings, binding: bindings.find(binding => binding.projectRef === input.projectRef),
    ...(receipt?.maintenanceWarnings ? { maintenanceWarnings: receipt.maintenanceWarnings } : {}) };
}

function bindingRows(bindings: Readonly<Record<string, string>>) {
  return Object.entries(bindings).map(([projectRef, workspacePath]) => ({ projectRef, workspacePath }));
}

export function proposeWorkspaceBinding(source: string | undefined, projectRef: string, workspacePath?: string): string {
  if (!projectRef.trim() || projectRef.includes('\0')) throw new Error('ProjectRef must be a nonempty local binding name.');
  if (workspacePath !== undefined && (!workspacePath || workspacePath.includes('\0'))) throw new Error('Workspace path must be nonempty.');
  const content = source ?? '<WorkspaceBindings []>\n';
  readWorkspaceBindingSources(content);
  const before = parseXnl(content, { textBlockStyle: true }).nodes[0] as DataElementNode;
  const after = structuredClone(before);
  const index = (after.body ?? []).findIndex(node => isDataElement(node) && node.tag === 'Binding' && node.attributes?.project_ref === projectRef);
  if (index >= 0) {
    if (workspacePath === undefined) {
      after.body!.splice(index, 1);
      return patchRootBodySource(content, before, after, { remove: index });
    }
    const node = after.body![index] as DataElementNode;
    node.attributes = { ...node.attributes, workspace_path: workspacePath };
    return patchLifecycleSource(content, before, after);
  }
  if (workspacePath === undefined) return content;
  const child = `<Binding {project_ref=${JSON.stringify(projectRef)} workspace_path=${JSON.stringify(workspacePath)}}>`;
  after.body = [...(after.body ?? []), parseXnl(child, { textBlockStyle: true }).nodes[0]];
  return patchRootBodySource(content, before, after, { insert: child });
}

/** Local machine bindings are not portable resource instances. Retain their
 * established WorkspaceBindings format; never smuggle local paths into TrackLink. */
export function readWorkspaceBindingSources(source: string | undefined): Readonly<Record<string, string>> {
  if (source === undefined) return {};
  const parsed = parseXnl(source, { textBlockStyle: true });
  const root = parsed.nodes[0];
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(root) || root.tag !== 'WorkspaceBindings') {
    throw new Error('Local workspace bindings require one unambiguous WorkspaceBindings root.');
  }
  const bindings: Record<string, string> = Object.create(null);
  if (root.extend && Object.keys(root.extend.children).length) throw new Error('Local workspace bindings require direct body entries; retain extended configuration for review.');
  for (const node of root.body ?? []) {
    if (!isDataElement(node) || node.tag !== 'Binding') throw new Error('Local workspace bindings require Binding entries.');
    const ref = node.attributes?.project_ref, target = node.attributes?.workspace_path;
    if (typeof ref !== 'string' || !ref.trim() || typeof target !== 'string' || !target.trim()) throw new Error('Local workspace binding requires project_ref and workspace_path.');
    if (Object.hasOwn(bindings, ref)) throw new Error(`Duplicate local ProjectRef binding: ${ref}`);
    bindings[ref] = target;
  }
  return bindings;
}
