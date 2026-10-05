import {runInstallationStages} from 'halfcode-lite-management-capsule';
import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { upgradeGlobalCommand } from './upgrade-global';
import { upgradeWorkspaceCommand } from './upgrade-workspace';

export async function upgradeCommand(context: CommandContext): Promise<CommandResult> {
  return runInstallationStages({bin:BIN,command:'upgrade',preflight:()=>{
  if (context.positional.length > 0 || Object.keys(context.options).some(key => key !== 'agent')) {
    return { code: 1, data: { command: 'upgrade' }, message: `Usage: ${BIN} upgrade [--agent <names>]` };
  }


},global:()=>upgradeGlobalCommand(context),workspace:()=>upgradeWorkspaceCommand({ ...context, options: {} })});
}
