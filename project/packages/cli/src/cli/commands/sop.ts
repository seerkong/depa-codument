import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { renderSopMermaid, type SopDocument, type SopRuntime } from '../sop';
import { optionString } from './runtime-flags';

function sops(context: CommandContext): SopRuntime {
  if (!context.runtime.sop) throw new Error('SOP runtime is not configured');
  return context.runtime.sop;
}

function exactFqn(context: CommandContext, operation: string): string {
  const fqn = optionString(context.options.fqn)?.trim();
  if (!fqn || context.positional.length > 0) throw new Error(`Usage: ${BIN} SOP ${operation} --fqn <FQN>`);
  return fqn;
}

function summary(document: SopDocument): Record<string, unknown> {
  return Object.freeze({
    kind: 'SOP',
    fqn: document.fqn,
    description: document.description,
    profile: document.profile,
    packageId: document.packageId,
    sourceRoot: document.sourceRoot,
    logicalPath: document.logicalPath,
    contentDigest: document.contentDigest,
  });
}

export async function sopListCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0) return { code: 1, message: `Usage: ${BIN} SOP list` };
  try {
    const resources = (await sops(context).list()).map(summary);
    return {
      code: 0,
      data: { command: 'SOP.list', kind: 'SOP', count: resources.length, resources },
      message: resources.length
        ? resources.map((resource) => `${String(resource.fqn)}\t${String(resource.logicalPath)}`).join('\n')
        : 'No SOP resources found.',
    };
  } catch (error) {
    return { code: 1, data: { command: 'SOP.list', kind: 'SOP', count: 0, resources: [] }, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function sopDetailCommand(context: CommandContext): Promise<CommandResult> {
  try {
    const fqn = exactFqn(context, 'detail');
    const document = await sops(context).get(fqn);
    const resource = Object.freeze({ ...summary(document), markdown: document.markdown, diagnostics: document.diagnostics });
    return { code: 0, data: { command: 'SOP.detail', kind: 'SOP', resource }, message: `${fqn}\n${document.description}\n${document.logicalPath}` };
  } catch (error) {
    return { code: 1, data: { command: 'SOP.detail', kind: 'SOP' }, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function sopValidateCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0) return { code: 1, message: `Usage: ${BIN} SOP validate [--fqn <FQN>]` };
  try {
    const fqn = optionString(context.options.fqn)?.trim();
    const result = await sops(context).validate(fqn);
    return {
      code: result.valid ? 0 : 1,
      data: { command: 'SOP.validate', kind: 'SOP', ...result },
      message: result.valid
        ? `${result.count} SOP resource(s) valid.`
        : `SOP validation failed with ${result.diagnostics.length} diagnostic(s).`,
    };
  } catch (error) {
    return { code: 1, data: { command: 'SOP.validate', kind: 'SOP', valid: false }, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function sopGraphCommand(context: CommandContext): Promise<CommandResult> {
  try {
    const fqn = exactFqn(context, 'graph');
    const document = await sops(context).get(fqn);
    if (document.profile !== 'typed-pipeline' || !document.graph) {
      throw new Error(`SOP graph requires a valid typed-pipeline SOP: ${fqn}`);
    }
    const mermaid = renderSopMermaid(document.graph);
    return {
      code: 0,
      data: {
        command: 'SOP.graph',
        kind: 'SOP',
        fqn,
        profile: document.profile,
        format: document.graph.format,
        contentDigest: document.contentDigest,
        mermaid,
      },
      message: mermaid,
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'SOP.graph', kind: 'SOP' },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
