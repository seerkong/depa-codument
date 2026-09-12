import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { createCodumentWorkspaceMigrator } from 'depa-codument-product-capsule/workspace-migration';
import { createCodumentWorkspaceGuidanceUpdater } from 'depa-codument-product-capsule/workspace-install';
import { workspaceInstallOptions } from './init-workspace';

export async function upgradeWorkspaceCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length) throw new Error(`Usage: ${BIN} upgrade-workspace [--agent <names>] [--skills-dir <path>]`);
  const options = workspaceInstallOptions(context);
  const workspace = context.runtime.workspace();
  if (!await workspace.exists('codument')) return { code: 1, data: { command: 'upgrade-workspace', initialized: false },
    message: `Codument is not initialized. Run ${BIN} init first.` };
  const migrator = createCodumentWorkspaceMigrator(workspace.root, options);
  const plan = await migrator.plan();
  const app = await migrator.apply(plan);
  const committed = app.status !== 'review-required';
  const plannedResources = { upgraded: plan.resources.filter(resource => resource.status === 'planned').length,
    unchanged: plan.resources.filter(resource => resource.status === 'noop').length,
    removed: plan.changes.filter(change => change.source === null).length };
  const receipt = {
    command: 'upgrade-workspace', status: app.status === 'review-required' ? 'review-required' : 'upgraded',
    backupRoot: app.backupPath, planDigest: app.planDigest, phase: 'app', appStatus: app.status,
    managedFiles: { written: app.status === 'review-required' ? 0 : plan.changes.length, kept: 0 },
    resources: committed ? plannedResources : { upgraded: 0, unchanged: plan.resources.length, removed: 0 },
    plannedResources,
    reviewRequired: [...app.diagnostics], semanticReviewRecommended: plan.resources.filter(resource => resource.status === 'planned').map(resource => resource.path),
    skills: [] as { agent: string; directory: string; written: number; removed: number }[],
    cliToolsUpdated: app.status !== 'review-required' && plan.changes.some(change => change.path === 'codument/config/cli-tools.json'),
    agentsBlockRefreshed: false, instructionFilesRefreshed: [] as string[],
    guidanceBackupRoot: undefined as string | undefined,
  };
  if (app.status === 'review-required') return { code: 2, data: receipt, message: app.diagnostics.join('\n') };
  try {
    const guidance = await createCodumentWorkspaceGuidanceUpdater(workspace.root).upgrade(options);
    receipt.phase = 'complete';
    receipt.guidanceBackupRoot = guidance.backupPath;
    receipt.agentsBlockRefreshed = true;
    receipt.instructionFilesRefreshed = guidance.writtenFiles.filter(file => file === 'AGENTS.md' || file === 'CLAUDE.md');
    receipt.skills = [{ agent: 'stored-project-targets', directory: 'workspace-local', written: 0,
      removed: guidance.writtenFiles.filter(file => file !== 'AGENTS.md' && file !== 'CLAUDE.md').length }];
    return { code: 0, data: receipt, message: `${BIN} workspace upgraded.\nApp backup: ${app.backupPath ?? '(noop)'}\nGlobal guidance is managed separately by upgrade-global; project assets remain in codument/.` };
  } catch (error) {
    // The App and auxiliary publications have separate guarded owners. A later
    // guidance failure does not roll back an already verified App or claim full success.
    receipt.status = 'review-required';
    receipt.phase = 'guidance';
    receipt.reviewRequired.push(error instanceof Error ? error.message : String(error));
    return { code: 2, data: receipt, message: receipt.reviewRequired.join('\n') };
  }
}
