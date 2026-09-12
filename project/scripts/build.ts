#!/usr/bin/env bun
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { BIN } from '../packages/cli/src/identity';

const repoRoot = resolve(import.meta.dir, '..');
const templatesRoot = resolve(repoRoot, 'packages', 'cli', 'src', 'templates');
const productTemplatesRoot = resolve(repoRoot, 'packages', 'product-capsule', 'src', 'templates');
const entrypointArg = process.argv.find((arg) => arg.startsWith('--entrypoint='));
const entrypoint = resolve(repoRoot, entrypointArg?.slice('--entrypoint='.length) || 'packages/cli/src/cli/index.ts');
const outfileArg = process.argv.find((arg) => arg.startsWith('--outfile='));
const outfile = resolve(repoRoot, outfileArg?.slice('--outfile='.length) || `dist/${BIN}`);
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetArg?.slice('--target='.length);
const supportedTargets = ['bun-darwin-arm64', 'bun-darwin-x64', 'bun-windows-x64'] as const;
if (target && !(supportedTargets as readonly string[]).includes(target)) {
  throw new TypeError(`Unsupported standalone target: ${target}`);
}

function collectFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new TypeError(`resource symlink is not supported: ${absolute}`);
    if (entry.isDirectory()) files.push(...collectFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
    else throw new TypeError(`unsupported resource entry: ${absolute}`);
  }
  return files.sort();
}

const resourceFiles = [...collectFiles(templatesRoot), ...collectFiles(productTemplatesRoot)];
if (resourceFiles.some((path) => path.endsWith('.'))) {
  throw new TypeError('BunFS resource filenames ending in a dot are not supported');
}

const resourceImports = resourceFiles
  .map((path) => `import ${JSON.stringify(path)} with { type: "file" };`)
  .join('\n');

const result = await Bun.build({
  entrypoints: [entrypoint],
  compile: {
    outfile,
    ...(target ? { target: target as typeof supportedTargets[number] } : {}),
  },
  plugins: [{
    name: 'resource-assets-entry',
    setup(builder) {
      builder.onResolve({ filter: /^resource-assets:embedded$/ }, () => ({
        path: 'resource-assets:embedded',
        namespace: 'resource-assets',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'resource-assets' }, () => ({
        contents: resourceImports,
        loader: 'ts',
      }));
      builder.onLoad({ filter: /\.ts$/ }, async ({ path }) => {
        if (path !== entrypoint) return;
        const source = await Bun.file(path).text();
        const shebangEnd = source.startsWith('#!') ? source.indexOf('\n') + 1 : 0;
        return {
          contents: `${source.slice(0, shebangEnd)}import "resource-assets:embedded";\n${source.slice(shebangEnd)}`,
          loader: 'ts',
        };
      });
    },
  }],
  naming: { asset: 'resource/[dir]/[name].[ext]' },
  root: repoRoot,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(
  `Built ${relative(repoRoot, outfile)}${target ? ` for ${target}` : ''} with ${resourceFiles.length} BunFS resources.`,
);
