#!/usr/bin/env bun
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BIN } from '../packages/cli/src/identity';
import {
  conflictingReleasePackageNames,
  resolveReleaseTarget,
  type ReleaseTarget,
} from './release-targets';

export { resolveReleaseTarget } from './release-targets';
export type { ReleaseTarget } from './release-targets';

const repoRoot = resolve(import.meta.dir, '..');
const bunBin = process.env.BUN_BIN?.trim() || process.execPath;

async function run(command: string[], options: { allowFailure?: boolean; capture?: boolean } = {}): Promise<string> {
  const child = Bun.spawn(command, {
    cwd: repoRoot,
    stdout: options.capture ? 'pipe' : 'inherit',
    stderr: options.capture ? 'pipe' : 'inherit',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    options.capture ? new Response(child.stdout).text() : '',
    options.capture ? new Response(child.stderr).text() : '',
  ]);
  if (exitCode !== 0 && !options.allowFailure) {
    const detail = (stderr || stdout).trim();
    throw new Error(`Command failed (${exitCode}): ${command.join(' ')}${detail ? `\n${detail}` : ''}`);
  }
  return stdout.trim();
}

export function installCommandPlan(
  target: ReleaseTarget,
  packageRoot: string,
  bunExecutable = bunBin,
): string[][] {
  const packageNames = [target.packageName, ...conflictingReleasePackageNames(target)];
  return [
    [process.execPath, 'run', resolve(repoRoot, 'scripts', 'build-release.ts'), `--target=${target.id}`],
    ...packageNames.map((packageName) => [bunExecutable, 'remove', '--global', packageName]),
    [bunExecutable, 'add', '--global', '--force', packageRoot],
  ];
}

export function installedBinaryCandidates(globalBin: string, target: ReleaseTarget): string[] {
  return target.platform === 'win32'
    ? [resolve(globalBin, `${BIN}.exe`), resolve(globalBin, BIN)]
    : [resolve(globalBin, BIN)];
}

async function main(): Promise<void> {
  const target = resolveReleaseTarget();
  const packageRoot = resolve(repoRoot, 'packages', target.packageDirectory);
  const commands = installCommandPlan(target, packageRoot);

  console.log(`Building ${target.packageName} from the current checkout...`);
  await run(commands[0]);

  console.log(`Removing conflicting runtime packages, if installed...`);
  for (const command of commands.slice(1, -1)) await run(command, { allowFailure: true });

  console.log(`Installing ${target.packageName} from ${packageRoot} with Bun...`);
  await run(commands.at(-1)!);

  const bunGlobalBin = await run([bunBin, 'pm', 'bin', '--global'], { capture: true });
  if (!bunGlobalBin) throw new Error('Bun did not return a global bin directory');
  const installedBinary = installedBinaryCandidates(bunGlobalBin, target).find(existsSync);
  if (!installedBinary) {
    throw new Error(`Bun installed ${target.packageName}, but no ${BIN} executable was created in ${bunGlobalBin}`);
  }

  await run([installedBinary, '--version']);
  await run([installedBinary, 'init-global']);
  console.log(`Installed ${target.packageName} locally and initialized global Codex integration.`);
  console.log(`Binary: ${installedBinary}`);
}

if (import.meta.main) await main();
