#!/usr/bin/env bun
import * as fs from 'node:fs';
import * as path from 'node:path';
import {parseCloneArgs, cloneSnapshot} from 'halfcode-cli-lite-cli-host-logic/clone';
import {createConsumerScaffold} from 'halfcode-cli-lite-cli-host-logic/clone-scaffold';
import {createGitSnapshotClonePort, writeConsumerScaffold} from 'halfcode-cli-lite-cli-host-support/clone';

export const sourceRoot = path.resolve(import.meta.dir, '..');
export const sourcePolicy = {
  roots: ['.gitignore', 'eslint.config.js', 'package.json', 'bun.lock', 'bun.lockb', 'packages', 'scripts', 'tsconfig.json'],
  excludedSegments: ['node_modules', 'dist', '.git', '.tmp', '.agents', '.claude', '.codex', '.eidolon', '.opencode', '.code-review-graph', '.depa-analysis'],
  excludedPaths: ['packages/runtime-darwin-arm64/bin', 'packages/runtime-darwin-arm64/builder-vue', 'packages/runtime-darwin-x64/bin', 'packages/runtime-darwin-x64/builder-vue', 'packages/runtime-windows-x64/bin', 'packages/runtime-windows-x64/builder-vue'],
};

/** Codument binds source policy and its adopted public versions, never Halfcode private source. */
export async function cloneWorkspace(args: readonly string[]) {
  const options = parseCloneArgs(args);
  const destination = path.resolve(options.destination);
  if (options.mode !== 'scaffold') return cloneSnapshot({snapshots: createGitSnapshotClonePort()}, {...options, sourceRoot, destination, sourcePolicy,
    ...(options.metadataIdentity ? {metadataRebrand: {identityFile: 'packages/cli/src/identity.ts', identity: options.metadataIdentity}} : {}),
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'packages/cli/package.json'), 'utf8')) as {dependencies: Record<string, string>};
  const versions = manifest.dependencies;
  return writeConsumerScaffold(sourceRoot, destination, options.force, createConsumerScaffold(options.identity, versions));
}

if (import.meta.main) {
  try { console.log(JSON.stringify(await cloneWorkspace(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
