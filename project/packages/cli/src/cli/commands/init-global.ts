import * as path from 'node:path';
import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { applyGlobalInstall, resolveInstallHome } from '../global-install';

export async function initGlobalCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0 || Object.keys(context.options).some(key => key !== 'agent')) {
    return { code: 1, data: { command: 'init-global' }, message: `Usage: ${BIN} init-global [--agent <names>]` };
  }

  const homeRoot = resolveInstallHome();
  const receipt = await applyGlobalInstall(
    context.runtime.resources,
    (root) => context.runtime.workspace(path.join(homeRoot, root ?? '.')),
    homeRoot,
    'init-global',
    typeof context.options.agent === 'string' ? context.options.agent : undefined,
  );
  const { skills } = receipt;

  return {
    code: 0,
    data: {
      command: 'init-global',
      status: 'initialized',
      home: homeRoot,
      backupRoot: receipt.backupRoot,
      skillsWritten: skills.reduce((sum, receipt) => sum + receipt.written, 0),
      agents: skills.map(({ agent }) => agent).join(','),
    },
    message: [
      `${BIN} global installation initialized.`,
      ...skills.map((skill) => `- skills: ${skill.written} → ~/${skill.directory} (${skill.agent})`),
    ].join('\n'),
  };
}
