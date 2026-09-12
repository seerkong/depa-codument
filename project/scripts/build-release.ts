#!/usr/bin/env bun
import { chmodSync, mkdirSync, rmSync } from 'node:fs';
import { stageReleaseBuilder } from './release-builder';
import { stageReleaseVersion } from './release-version';
import { resolve } from 'node:path';
import {
  RELEASE_TARGETS,
  releaseTargetById,
  type ReleaseTarget,
} from './release-targets';

const repoRoot = resolve(import.meta.dir, '..');
const targetArg = process.argv.find((arg) => arg.startsWith('--target='))?.slice('--target='.length);
const architectureArg = process.argv.find((arg) => arg.startsWith('--arch='))?.slice('--arch='.length);

function selectedTargets(): readonly ReleaseTarget[] {
  if (targetArg && architectureArg) {
    throw new TypeError('Use either --target or the Darwin compatibility option --arch, not both');
  }
  if (targetArg) return [releaseTargetById(targetArg)];
  if (architectureArg) {
    if (architectureArg !== 'arm64' && architectureArg !== 'x64') {
      throw new TypeError(`Unsupported Darwin release architecture: ${architectureArg}`);
    }
    return [releaseTargetById(`darwin-${architectureArg}`)];
  }
  return RELEASE_TARGETS;
}

for (const target of selectedTargets()) {
  const packageRoot = resolve(repoRoot, 'packages', target.packageDirectory);
  const builderRoot = resolve(packageRoot, 'builder-vue');
  rmSync(builderRoot, { recursive: true, force: true });
  stageReleaseBuilder(resolve(repoRoot, 'packages', 'page-builder-vue'), builderRoot);
  const outfile = resolve(packageRoot, 'bin', target.binaryName);
  mkdirSync(resolve(packageRoot, 'bin'), { recursive: true });
  const child = Bun.spawn([
    process.execPath,
    'run',
    resolve(repoRoot, 'scripts', 'build.ts'),
    `--target=${target.bunTarget}`,
    `--outfile=${outfile}`,
  ], { cwd: repoRoot, stdout: 'inherit', stderr: 'inherit' });
  const exitCode = await child.exited;
  if (exitCode !== 0) process.exit(exitCode);
  if (target.platform === 'darwin') chmodSync(outfile, 0o755);
  stageReleaseVersion(repoRoot, packageRoot);
}
