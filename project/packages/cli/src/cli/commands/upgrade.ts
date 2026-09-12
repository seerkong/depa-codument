import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { upgradeGlobalCommand } from './upgrade-global';
import { upgradeWorkspaceCommand } from './upgrade-workspace';

export async function upgradeCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0 || Object.keys(context.options).some(key => key !== 'agent')) {
    return { code: 1, data: { command: 'upgrade' }, message: `Usage: ${BIN} upgrade [--agent <names>]` };
  }

  const global = await upgradeGlobalCommand(context);
  if (global.code !== 0) return global;
  const workspace = await upgradeWorkspaceCommand({ ...context, options: {} });
  if (workspace.code !== 0) return workspace;

  return {
    code: 0,
    data: {
      command: 'upgrade',
      status: 'upgraded',
      global: global.data,
      workspace: workspace.data,
    },
    message: `${BIN} upgraded global and workspace state.\n\n${global.message}\n\n${workspace.message}`,
  };
}
