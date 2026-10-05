import {runInstallationStages} from 'halfcode-lite-management-capsule';
import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { initGlobalCommand } from './init-global';
import { initWorkspaceCommand, workspaceInstallOptions } from './init-workspace';

export async function initCommand(context: CommandContext): Promise<CommandResult> {
  return runInstallationStages({bin:BIN,command:'init',preflight:()=>{
  workspaceInstallOptions(context);


},global:()=>initGlobalCommand({ ...context, positional: [], options: context.options.agent ? { agent: context.options.agent } : {} }),workspace:()=>initWorkspaceCommand(context)});
}
