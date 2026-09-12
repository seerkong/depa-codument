#!/usr/bin/env bun
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { WORKSPACE_DIR } from '../packages/cli/src/identity';

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  const equals = process.argv.find((arg) => arg.startsWith(prefix));
  if (equals) return equals.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const workspace = path.resolve(option('workspace') ?? process.cwd());
const name = option('name');
const sourceOption = option('source') ?? option('entry');
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error('--name must be a kebab-case page name');
if (!sourceOption) throw new Error('--source is required');

const sourcePath = path.resolve(workspace, sourceOption);
const sourceStat = await fs.stat(sourcePath);
const sourceRoot = sourceStat.isDirectory() ? sourcePath : path.dirname(sourcePath);
const indexPath = sourceStat.isFile() ? sourcePath : path.join(sourceRoot, 'index.html');
if (path.basename(indexPath) !== 'index.html') throw new Error('--source file must be named index.html');
await fs.access(indexPath);

const pageRoot = path.join(workspace, WORKSPACE_DIR, 'pages', name);
if (path.relative(sourceRoot, pageRoot) === '') throw new Error('source and destination must differ');
await fs.rm(pageRoot, { recursive: true, force: true });
await fs.mkdir(path.dirname(pageRoot), { recursive: true });
await fs.cp(sourceRoot, pageRoot, { recursive: true, dereference: false });
process.stdout.write(`Staged workspace page ${name} -> ${pageRoot}\n`);
