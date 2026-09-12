import { withFileBackup, FileBackupFailure } from 'halfcode-cli-lite-cli-host-support/file-backup';
import * as os from 'node:os';
import * as path from 'node:path';
import { BIN } from '../identity';
import type { ResourceEffect } from './effects/resource';
import type { WorkspaceEffect } from './effects/workspace';
import { globalInstallTargets, installGlobalSkills, type SkillInstallReceipt } from './install';

export interface GlobalInstallReceipt {
  backupRoot: string;
  skills: SkillInstallReceipt[];
}

export function resolveInstallHome(environment: NodeJS.ProcessEnv = process.env): string {
  const override = environment.CODUMENT_HOME?.trim();
  return path.resolve(override || os.homedir());
}

export function resolveGlobalBin(homeRoot: string = resolveInstallHome()): string {
  return path.join(homeRoot, '.bun', 'bin', BIN);
}

export async function applyGlobalInstall(
  resources: ResourceEffect,
  workspaceOf: (root?: string) => WorkspaceEffect,
  homeRoot: string,
  operation: 'init-global' | 'upgrade-global',
  agent?: string,
): Promise<GlobalInstallReceipt> {
  const targets = globalInstallTargets(agent);
  try {
    const result = await withFileBackup({
      root: homeRoot, backupParent: '.tmp/' + BIN, prefix: operation,
      managedPaths: targets.map(({skillsDir}) => skillsDir + '/' + BIN),
    }, () => installGlobalSkills(resources, workspaceOf, targets));
    return {backupRoot: result.backupRoot, skills: result.value};
  } catch (error) {
    if (!(error instanceof FileBackupFailure)) throw error;
    const message = error.original instanceof Error ? error.original.message : String(error.original);
    if (error.rollbackErrors.length) {
      throw new AggregateError([error.original, ...error.rollbackErrors], `Global install rollback was incomplete: ${message}`);
    }
    throw new Error(`Global install failed; prior managed skills restored: ${message}`, {cause: error.original});
  }
}
