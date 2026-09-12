import * as fs from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { planResourceMigration } from '../../../../../project/packages/domain-logic/src/migration';

// Read-only analysis of the protected dogfood input. Not an installed consumer
// and not an upgrade: no business or verification source is written here.
const root = resolve(import.meta.dir, '../../../../..');
const files: string[] = [];
async function visit(directory: string): Promise<void> {
  for (const item of await fs.readdir(directory, {withFileTypes: true})) {
    if (item.isSymbolicLink()) throw new Error('Input contains a symlink: ' + join(directory, item.name));
    if (item.name.startsWith('.')) continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) await visit(path); else if (item.isFile()) files.push(relative(root, path));
  }
}
await visit(join(root, 'codument'));
const plans = [];
for (const file of files.sort()) {
  if (file.startsWith('codument/std/') || file === 'codument/manifest.xnl' || !/.(?:xnl|xml)$/.test(file)) continue;
  const source = await fs.readFile(join(root, file), 'utf8');
  const result = planResourceMigration({path: file, source});
  plans.push({file, status: result.status, kind: result.targetKind, sourceHash: createHash('sha256').update(source).digest('hex'), diagnostics: result.diagnostics});
}
const managed = [];
for (const file of files.filter(file => file.startsWith('codument/std/'))) {
  const candidate = join(root, 'src/templates', file);
  const template = await fs.readFile(candidate).catch(() => undefined);
  managed.push({file, knownCurrentTemplate: template?.equals(await fs.readFile(join(root, file))) ?? false});
}
console.log(JSON.stringify({scope: 'read-only protected dogfood migration planning observation', sourceFiles: files.length,
  counts: {planned: plans.filter(plan => plan.status === 'planned').length, noop: plans.filter(plan => plan.status === 'noop').length,
    review: plans.filter(plan => plan.status === 'review-required').length, managed: managed.length, knownManaged: managed.filter(item => item.knownCurrentTemplate).length},
  review: plans.filter(plan => plan.status === 'review-required'), unknownManaged: managed.filter(item => !item.knownCurrentTemplate),
  ...(process.argv.includes('--full') ? {plans} : {})}, null, 2));
