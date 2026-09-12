import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { collectSkillsDirs, locateRegistryFile, parseRegistry, resolveModulePath } from '../runtime/registry';
import { runDebugCode } from '../runtime/exec-code';
import { summarizeWebApiResult } from '../runtime/web-api';
import {
  createTrackedClientFetch,
  optionString,
  resolveBrowserSelection,
  selectedOpenCliSubtransport,
} from './runtime-flags';

export async function execCodeCommand(context: CommandContext): Promise<CommandResult> {
  const code = optionString(context.options.code) ?? context.positional[0];
  if (!code || context.positional.length > 1) {
    return {
      code: 1,
      data: { command: 'exec' },
      message: `Usage: ${BIN} exec --code '<expression>' --skills-dir <path>`,
    };
  }

  let selection;
  try {
    selection = await resolveBrowserSelection(context.options.transport, context.options['opencli-transport'], context.runtime);
  } catch (error) {
    return { code: 1, data: { command: 'exec' }, message: error instanceof Error ? error.message : String(error) };
  }
  if (!selection) {
    return { code: 1, data: { command: 'exec' }, message: 'Invalid browser selection. Expected --transport ego-browser|opencli|mdd-browser-robot; --opencli-transport applies only to OpenCLI.' };
  }
  const { transport } = selection;
  const opencliSubtransport = selectedOpenCliSubtransport(selection);

  let registryFile: string;
  try {
    registryFile = locateRegistryFile({
      cwd: context.runtime.workspace().root,
      skillsDirs: collectSkillsDirs(context.args),
      capsule: optionString(context.options.capsule),
      registry: optionString(context.options.registry),
    });
  } catch (error) {
    return { code: 1, data: { command: 'exec' }, message: error instanceof Error ? error.message : String(error) };
  }

  try {
    const session = optionString(context.options.session);
    const provider = context.runtime.browserProviderFor?.({ ...selection, session }) ?? context.runtime.browserProvider;
    if (!provider) throw new Error('Browser provider effect is not configured');
    const registry = parseRegistry(await Bun.file(registryFile).text());
    const bundleRef = registry.bundle?.module ?? './bundle.js';
    const bundlePath = resolveModulePath(registryFile, bundleRef);
    const { clientFetch, calls } = createTrackedClientFetch({
      transport,
      session,
      provider,
    });
    const result = await runDebugCode({ code, bundlePath, clientFetch });
    return {
      code: 0,
      data: {
        command: 'exec',
        transport,
        ...(opencliSubtransport ? { opencliSubtransport } : {}),
        fetchCount: calls.length,
        lastUrl: calls.at(-1)?.url ?? '',
        lastStatus: calls.at(-1)?.status ?? 0,
        result,
      },
      message: summarizeWebApiResult(result, calls),
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'exec' },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
