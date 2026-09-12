import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import type { LocalFunctionOperation } from '../runtime/local-functions';
import { optionString, parseJsonInput } from './runtime-flags';
import { prepareLocalFunctionExecution } from '../runtime/local-function-execution';

function catalog(context: CommandContext) {
  if (!context.runtime.localFunctions) throw new Error('Local function catalog is not configured');
  return context.runtime.localFunctions;
}

function operation(value: string | undefined): LocalFunctionOperation | undefined {
  if (!value) return undefined;
  if (value === 'query' || value === 'detail' || value === 'action') return value;
  throw new Error('--operation must be query, detail, or action');
}

export async function localFunctionListCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length) return { code: 1, message: `Usage: ${BIN} LocalFunction list [--operation <kind>]` };
  try {
    const functions = await catalog(context).list(operation(optionString(context.options.operation)?.trim()));
    return {
      code: 0,
      data: { command: 'LocalFunction.list', count: functions.length, functions },
      message: functions.length
        ? functions.map((entry) => `${entry.operation}\t${entry.fqn}\t${entry.description}\t${entry.skillId}/${entry.relativePath}`).join('\n')
        : 'No local functions found.',
    };
  } catch (error) {
    return { code: 1, data: { command: 'LocalFunction.list', count: 0, functions: [] }, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function localFunctionDetailCommand(context: CommandContext): Promise<CommandResult> {
  const fqn = optionString(context.options.fqn)?.trim();
  if (!fqn || context.positional.length) return { code: 1, message: `Usage: ${BIN} LocalFunction detail --fqn <FQN>` };
  try {
    const descriptor = await catalog(context).detail(fqn);
    return { code: 0, data: { command: 'LocalFunction.detail', kind: 'LocalFunction', resource: descriptor }, message: `${descriptor.operation}\t${descriptor.fqn}\n${descriptor.description}\nRuntime: ${descriptor.runtimeCapabilities.join(', ') || 'none'}` };
  } catch (error) {
    return { code: 1, data: { command: 'LocalFunction.detail', kind: 'LocalFunction', fqn }, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function localFunctionInvokeCommand(context: CommandContext): Promise<CommandResult> {
  const fqn = optionString(context.options.fqn)?.trim();
  if (!fqn || context.positional.length) return { code: 1, data: { command: 'LocalFunction.invoke', accepted: false }, message: `Usage: ${BIN} LocalFunction invoke --fqn <FQN> [--input <json>] [--config <json>] [--profile <name>]` };
  const input = parseJsonInput(context.options.input);
  if (!input.ok) return { code: 1, data: { command: 'LocalFunction.invoke', accepted: false, fqn }, message: input.message };
  const config = context.options.config === undefined ? { ok: true as const, value: null } : parseJsonInput(context.options.config);
  if (!config.ok) return { code: 1, data: { command: 'LocalFunction.invoke', accepted: false, fqn }, message: config.message };
  try {
    const prepared = await prepareLocalFunctionExecution(context.runtime, fqn, optionString(context.options.profile)?.trim() || undefined);
    prepared.validate(input.value, config.value);
    let result: unknown;
    if (prepared.placement === 'local') result = await prepared.invoke(input.value, config.value);
    else {
      if (!context.runtime.invokeServeLocalFunction) throw new Error('LocalFunction requires the Serve invocation port; a CLI-private PageWorkflow coordinator is not allowed');
      result = await context.runtime.invokeServeLocalFunction({
        fqn, input: input.value, config: config.value,
        profile: prepared.profile, admissionDigest: prepared.admissionDigest,
      });
    }
    return { code: 0, data: { command: 'LocalFunction.invoke', accepted: true, fqn, result }, message: 'LocalFunction completed' };
  } catch (error) {
    return { code: 1, data: { command: 'LocalFunction.invoke', accepted: false, fqn }, message: error instanceof Error ? error.message : String(error) };
  }
}
