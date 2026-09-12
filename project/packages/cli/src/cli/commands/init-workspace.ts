import * as path from 'node:path';
import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { createCodumentWorkspaceInstaller, CODUMENT_AGENT_SKILL_DIRECTORIES, type CodumentInstallAgent, type WorkspaceInstallOptions } from 'depa-codument-product-capsule/workspace-install';

export function workspaceInstallOptions(context: CommandContext): WorkspaceInstallOptions {
  if (context.positional.length > 1) throw new Error(`Usage: ${BIN} init-workspace [path] [--agent <names>] [--skills-dir <path>]`);
  if (context.options.force) throw new Error('init --force cannot overwrite workspace authorities; use upgrade-workspace for a backed-up migration.');
  const agent = context.options.agent;
  const agents = typeof agent === 'string' ? [...new Set(agent.split(',').map(value => value.trim()))] : undefined;
  if (agents && (!agents.length || agents.some(value => !Object.hasOwn(CODUMENT_AGENT_SKILL_DIRECTORIES, value)))) throw new Error('Unsupported agent selection.');
  return { agents: agents as CodumentInstallAgent[] | undefined,
    skillsDirectory: typeof context.options['skills-dir'] === 'string' ? context.options['skills-dir'] : undefined };
}

export async function initWorkspaceCommand(context: CommandContext): Promise<CommandResult> {
  const options = workspaceInstallOptions(context);
  const base = context.runtime.workspace().root;
  const root = context.positional[0] ? path.resolve(base, context.positional[0]) : base;
  await context.runtime.workspace(root).makeDirectory('.');
  const receipt = await createCodumentWorkspaceInstaller(root).install(options);
  return { code: 0, data: { command: 'init-workspace', status: 'initialized', workspace: root,
    createdApp: receipt.createdApp, workspaceWritten: receipt.writtenFiles.length, skillsWritten: 0,
    guidance: 'global:depa-codument', inspection: receipt.inspection },
    message: `${BIN} workspace initialized at ${root}/codument.\nProject assets remain local; operations and std belong to the global depa-codument Skill.` };
}
