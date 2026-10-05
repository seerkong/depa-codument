import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(import.meta.dir, '../../../..');
const scanRoots = [
  'packages/cli/src',
  'packages/skill-app-contract/src',
  'packages/host-adapter/src',
  'packages/product-capsule/src',
  'packages/mcp-app/src',
  'packages/cli/test/fixtures',
  'scripts',
] as const;
const textExtensions = new Set(['.ts', '.js', '.md', '.xnl', '.json', '.d.ts']);
const legacyPattern = /ApplicationSOP|ApplicationSop|application[_-]sop|application_sop_get/g;

function filesBelow(relativeRoot: string): string[] {
  const absoluteRoot = path.join(repoRoot, relativeRoot);
  return fs.readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) return filesBelow(relative);
    return entry.isFile() && textExtensions.has(path.extname(entry.name)) ? [relative] : [];
  });
}

describe('canonical SOP delivery residuals', () => {
  test('keeps the removed Kind rejection in the installed public Host, not product copies', () => {
    const findings = scanRoots.flatMap(filesBelow).flatMap((file) => {
      const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      return [...text.matchAll(legacyPattern)].map((match) => ({ file, token: match[0] }));
    });
    expect(findings).toEqual([]);
    const publicCatalog = Bun.resolveSync('halfcode-lite-skill-app-support/resources/workspace-resource-catalog', import.meta.dir);
    const publicSource = fs.readFileSync(publicCatalog, 'utf8');
    expect([...publicSource.matchAll(legacyPattern)].map(match => match[0])).toEqual(['ApplicationSOP']);
    expect(publicSource).toContain("has been removed; migrate the resource to kind 'SOP'.");
  });
});
