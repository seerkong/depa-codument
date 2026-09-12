import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { initGlobalCommand } from './init-global';
import { initWorkspaceCommand, workspaceInstallOptions } from './init-workspace';

export async function initCommand(context: CommandContext): Promise<CommandResult> {
  workspaceInstallOptions(context);

  const global = await initGlobalCommand({ ...context, positional: [], options: context.options.agent ? { agent: context.options.agent } : {} });
  if (global.code !== 0) return global;
  const workspace = await initWorkspaceCommand(context);
  if (workspace.code !== 0) return workspace;

  return {
    code: 0,
    data: {
      command: 'init',
      status: 'initialized',
      global: global.data,
      workspace: workspace.data,
    },
    message: `${BIN} initialized global and workspace state.\n\n${global.message}\n\n${workspace.message}`,
  };
}
