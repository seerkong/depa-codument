import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { optionString } from './runtime-flags';

export async function sopNotebookInitCommand(context: CommandContext): Promise<CommandResult> {
  try {
    const fqn = optionString(context.options.fqn)?.trim();
    if (!fqn || context.positional.length > 0) {
      throw new Error(`Usage: ${BIN} SOP notebook init --fqn <FQN> [--reset]`);
    }
    const sop = context.runtime.sop;
    if (!sop) throw new Error('SOP runtime is not configured');
    const result = await sop.initNotebook(fqn, { reset: context.options.reset === true });
    return {
      code: 0,
      data: { command: 'SOP.notebook.init', kind: 'SOP', ...result },
      message: `${result.action}: ${result.notebookPath}`,
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'SOP.notebook.init', kind: 'SOP' },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
