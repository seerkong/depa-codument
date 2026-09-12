import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const cliRoot = path.resolve(import.meta.dir, '../../src/cli');
const sopRoot = path.join(cliRoot, 'sop');
const DEEP_SOP_IMPORT = /(?:from\s+|import\s*\()\s*['"]([^'"]*\/sop\/[^'"]+)['"]/gu;

async function sourceFiles(root: string): Promise<readonly string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(absolute) : entry.name.endsWith('.ts') ? [absolute] : [];
  }));
  return files.flat().sort();
}

describe('SOP capsule boundary', () => {
  test('routes every outer production import through the single public entry', async () => {
    const violations: string[] = [];
    for (const file of await sourceFiles(cliRoot)) {
      if (file.startsWith(`${sopRoot}${path.sep}`)) continue;
      const source = await fs.readFile(file, 'utf8');
      for (const match of source.matchAll(DEEP_SOP_IMPORT)) {
        violations.push(`${path.relative(cliRoot, file)} -> ${match[1]}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
