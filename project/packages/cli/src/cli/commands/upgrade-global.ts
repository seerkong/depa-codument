import * as path from 'node:path';
import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { applyGlobalInstall, resolveInstallHome } from '../global-install';

export async function upgradeGlobalCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0 || Object.keys(context.options).some(key => key !== 'agent')) {
    return { code: 1, data: { command: 'upgrade-global' }, message: `Usage: ${BIN} upgrade-global [--agent <names>]` };
  }

  const homeRoot = resolveInstallHome();
  const receipt = await applyGlobalInstall(
    context.runtime.resources,
    (root) => context.runtime.workspace(path.join(homeRoot, root ?? '.')),
    homeRoot,
    'upgrade-global',
    typeof context.options.agent === 'string' ? context.options.agent : undefined,
  );

  return {
    code: 0,
    data: {
      command: 'upgrade-global',
      status: 'upgraded',
      home: homeRoot,
      backupRoot: receipt.backupRoot,
      skillsWritten: receipt.skills.reduce((sum, item) => sum + item.written, 0),
      agents: receipt.skills.map(({ agent }) => agent).join(','),
    },
    message: [
      `${BIN} global installation upgraded.`,
      `- backup: ${receipt.backupRoot}`,
      ...receipt.skills.map((skill) => `- skills: ${skill.written} → ~/${skill.directory} (${skill.agent})`),
    ].join('\n'),
  };
}
