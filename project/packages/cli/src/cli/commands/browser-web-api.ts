import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { invokeBrowserWebApi } from '../runtime/browser-web-api';
import { optionString, parseJsonInput } from './runtime-flags';

export async function browserWebApiInvokeCommand(context: CommandContext): Promise<CommandResult> {
  const fqn = optionString(context.options.fqn)?.trim();
  if (!fqn || context.positional.length) return { code: 1, message: `Usage: ${BIN} BrowserWebApi invoke --fqn <FQN> [--input <json>] [--profile <name>]` };
  const input = parseJsonInput(context.options.input);
  if (!input.ok) return { code: 1, message: input.message };
  try {
    const invocation = await invokeBrowserWebApi({
      runtime: context.runtime, fqn, input: input.value,
      profile: optionString(context.options.profile)?.trim() || undefined,
      session: optionString(context.options.session)?.trim() || undefined,
    });
    return {
      code: 0,
      data: { command: 'BrowserWebApi.invoke', accepted: true, fqn, profile: invocation.profile, endpointKey: invocation.endpointKey, transport: invocation.transport, result: invocation.result },
      message: `BrowserWebApi completed via ${invocation.transport}`,
    };
  } catch (error) {
    return { code: 1, data: { command: 'BrowserWebApi.invoke', accepted: false, fqn }, message: error instanceof Error ? error.message : String(error) };
  }
}
