import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite/node_modules/typescript';

const upstream = '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const depa = '/Users/kongweixian/infra-dev/depa-codument/project';
type Manifest = { name: string; version: string; halfcodeClone?: { identity: string };
  exports?: Record<string, unknown>; dependencies?: Record<string, string> };
const packages = new Map<string, { root: string; manifest: Manifest }>();
for (const root of [upstream, depa]) {
  for (const entry of readdirSync(join(root, 'packages'))) {
    const directory = join(root, 'packages', entry);
    if (!existsSync(join(directory, 'package.json'))) continue;
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as Manifest;
    assert.ok(!packages.has(manifest.name), 'Duplicate package identity: ' + manifest.name);
    packages.set(manifest.name, { root: directory, manifest });
  }
}
const shared = [...packages.values()].filter(p => p.manifest.halfcodeClone?.identity === 'shared');
assert.equal(shared.length, 21);
const verified = new Set<string>();
function visit(name: string, ancestors: string[] = []): void {
  assert.ok(!ancestors.includes(name), 'Dependency cycle: ' + [...ancestors, name].join(' -> '));
  if (verified.has(name)) return;
  for (const dependency of Object.keys(packages.get(name)?.manifest.dependencies ?? {})) {
    if (packages.has(dependency)) visit(dependency, [...ancestors, name]);
  }
  verified.add(name);
}
for (const name of packages.keys()) visit(name);
function files(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = join(root, entry.name);
    if (entry.isDirectory()) return entry.name === 'templates' ? [] : files(file);
    return /\.[cm]?tsx?$/.test(file) ? [file] : [];
  });
}
let importCount = 0;
const missingDependencies = new Set<string>();
for (const { root, manifest } of packages.values()) {
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    assert.ok(!/^halfcode-(?:app|cli)-lite-/.test(dependency), 'Old canonical dependency: ' + dependency);
    assert.ok(!dependency.startsWith('halfcode-lite-lite-'));
  }
  for (const file of files(join(root, 'src'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function check(node: ts.Node): void {
      let specifier: string | undefined;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      if (specifier) {
        assert.ok(!/^(?:halfcode-(?:app|cli)-lite-|.*infra-dev\/halfcode-(?:cli|lite)\/)/.test(specifier), file + ': old/sibling import ' + specifier);
        if (specifier.startsWith('halfcode-lite-')) {
          importCount++;
          const [name, ...parts] = specifier.split('/');
          if (name !== manifest.name && !manifest.dependencies?.[name]) missingDependencies.add(manifest.name + ' -> ' + name);
          const target = packages.get(name)?.manifest;
          assert.ok(target, 'Missing package: ' + name);
          assert.ok(target.exports?.[parts.length ? './' + parts.join('/') : '.'], file + ': private import ' + specifier);
        }
      }
      ts.forEachChild(node, check);
    }
    check(source);
  }
}
for (const { manifest } of shared) {
  assert.match(manifest.name, /^halfcode-lite-.+-(?:contract|logic|support|adapter|capsule|shell)$/);
  assert.ok(!Object.keys(manifest.exports ?? {}).some(key => key.includes('*')), 'Wildcard exports');
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    assert.ok(!name.startsWith('depa-codument') && name !== 'halfcode-lite-product-capsule' && name !== 'halfcode-lite-cli-shell', 'Shared -> product dependency');
  }
}
assert.deepEqual([...missingDependencies], [], 'Undeclared direct dependencies');
console.log(JSON.stringify({ packages: packages.size, shared: shared.length, checkedPublicImports: importCount,
  dependencyDAG: true, noProductBackedge: true, declaredDependencies: true, finiteExports: true,
  roleNaming: true, limits: 'Static boundaries only; behavior and semantic ownership require separate tests/review.' }, null, 2));
