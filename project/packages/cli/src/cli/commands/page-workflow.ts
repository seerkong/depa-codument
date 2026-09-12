import { BIN } from '../../identity';
import { invokePageWorkflowGet, invokePageWorkflowStart, invokeServeLifecycle } from '../app/invoke';
import type { CommandContext, CommandResult } from '../contracts/command';
import type { PageWorkflowSelector } from '../resources/definitions';
import { optionString, parseJsonInput } from './runtime-flags';
import { admitResourceDefinition, normalizePageWorkflowSelector, validateResourceValue } from '../resources/schema-validator';

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function pageWorkflowStartCommand(context: CommandContext): Promise<CommandResult> {
  const fqn = optionString(context.options.fqn)?.trim();
  if (!fqn || context.positional.length > 0) {
    return {
      code: 1,
      data: { command: 'PageWorkflow.start', accepted: false },
      message: `Usage: ${BIN} PageWorkflow start --fqn <FQN> [--selector <json>] [--input <json>]`,
    };
  }
  if (context.options.input === true) {
    return {
      code: 1,
      data: { command: 'PageWorkflow.start', accepted: false },
      message: '--input requires a JSON object.',
    };
  }
  const input = parseJsonInput(context.options.input);
  if (!input.ok) {
    return { code: 1, data: { command: 'PageWorkflow.start', accepted: false }, message: input.message };
  }
  if (!isJsonObject(input.value)) {
    return {
      code: 1,
      data: { command: 'PageWorkflow.start', accepted: false },
      message: '--input must be a JSON object.',
    };
  }
  const selector = parseJsonInput(context.options.selector, 'selector');
  if (!selector.ok) {
    return { code: 1, data: { command: 'PageWorkflow.start', accepted: false }, message: selector.message };
  }

  try {
    const definitions = context.runtime.definitionCatalog;
    if (!definitions) throw new Error('PageWorkflow definition catalog is not configured');
    const definition = await definitions.detail(fqn);
    if (definition.kind !== 'PageWorkflow') throw new Error(`${fqn} is not a PageWorkflow`);
    admitResourceDefinition(definition);
    validateResourceValue(fqn, 'input', 'inputSchema', definition.inputSchema, input.value);
    normalizePageWorkflowSelector(fqn, context.options.selector === undefined ? definition.defaultSelector : selector.value);
  } catch (error) {
    return { code: 1, data: { command: 'PageWorkflow.start', accepted: false }, message: error instanceof Error ? error.message : String(error) };
  }

  const serve = await invokeServeLifecycle(context.runtime, { action: 'start' });
  if (serve.code !== 0) {
    return {
      code: serve.code,
      data: { command: 'PageWorkflow.start', accepted: false },
      message: serve.message ?? 'serve failed to start',
    };
  }
  return invokePageWorkflowStart(context.runtime, {
    fqn,
    workflowInput: input.value,
    selector: context.options.selector === undefined ? undefined : selector.value as PageWorkflowSelector,
  });
}

export async function pageWorkflowGetCommand(context: CommandContext): Promise<CommandResult> {
  const runId = optionString(context.options['run-id'])?.trim();
  if (!runId || context.positional.length > 0) {
    return {
      code: 1,
      data: { command: 'PageWorkflow.get', ok: false },
      message: `Usage: ${BIN} PageWorkflow get --run-id <runId>`,
    };
  }
  const result = await invokePageWorkflowGet(context.runtime, runId);
  if (result.code !== 0 && result.message === 'serve is not running. Start it with serve_start first.') {
    return {
      ...result,
      message: 'PageWorkflow Serve is not running for the current workspace and agent; the in-memory receipt is unavailable.',
    };
  }
  return result;
}
