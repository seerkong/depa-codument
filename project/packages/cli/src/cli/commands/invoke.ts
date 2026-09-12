import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { collectSkillsDirs } from '../runtime/registry';
import { invokeCompiledFunction } from '../runtime/invoke';
import { summarizeWebApiResult } from '../runtime/web-api';
import {
  optionString,
  parseJsonInput,
  resolveBrowserSelection,
  selectedOpenCliSubtransport,
} from './runtime-flags';

export async function invokeCommand(context: CommandContext): Promise<CommandResult> {
  const fqn = optionString(context.options.fqn) ?? context.positional[0];
  if (!fqn || context.positional.length > 1) {
    return {
      code: 1,
      data: { command: 'invoke' },
      message: `Usage: ${BIN} invoke --fqn <FQN> --skills-dir <path> [--input <json>]`,
    };
  }
  let selection;
  try {
    selection = await resolveBrowserSelection(context.options.transport, context.options['opencli-transport'], context.runtime);
  } catch (error) {
    return { code: 1, data: { command: 'invoke' }, message: error instanceof Error ? error.message : String(error) };
  }
  if (!selection) {
    return { code: 1, data: { command: 'invoke' }, message: 'Invalid browser selection. Expected --transport ego-browser|opencli|mdd-browser-robot; --opencli-transport applies only to OpenCLI.' };
  }
  const { transport } = selection;
  const opencliSubtransport = selectedOpenCliSubtransport(selection);
  const input = parseJsonInput(context.options.input);
  if (!input.ok) return { code: 1, data: { command: 'invoke' }, message: input.message };

  try {
    const provider = context.runtime.browserProviderFor?.({
      ...selection,
      session: optionString(context.options.session),
    }) ?? context.runtime.browserProvider;
    if (!provider) throw new Error('Browser provider effect is not configured');
    const executed = await invokeCompiledFunction({
      cwd: context.runtime.workspace().root,
      skillsDirs: collectSkillsDirs(context.args),
      capsule: optionString(context.options.capsule),
      registry: optionString(context.options.registry),
      fqn,
      input: input.value,
      transport,
      session: optionString(context.options.session),
      provider,
    });
    return {
      code: 0,
      data: {
        command: 'invoke',
        fqn,
        category: executed.entry.category,
        module: executed.entry.module,
        transport,
        ...(opencliSubtransport ? { opencliSubtransport } : {}),
        fetchCount: executed.calls.length,
        lastUrl: executed.calls.at(-1)?.url ?? '',
        lastStatus: executed.calls.at(-1)?.status ?? 0,
        result: executed.result,
      },
      message: summarizeWebApiResult(executed.result, executed.calls),
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'invoke', fqn },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
