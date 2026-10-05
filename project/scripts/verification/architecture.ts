import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { WORKSPACE_APP_TEST_PATHS } from './workspace-app';

export const cliRoles = ['contract', 'logic', 'support', 'capsule', 'shell'] as const;
function filesAt(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesAt(file) : [file];
  });
}
export async function verifyCliArchitecture(root: string, withSkillApp = false, withBrowser = false, withVue = false, withMcp = false, withDomainCore = false): Promise<void> {
  const errors: string[] = [];
  const publicVersion = (name: string) => name === 'halfcode-lite-skill-app-contract' ? '0.1.1' : '0.1.0';
  const publicNames = ['cli-contract', 'cli-logic', 'cli-support', 'cli-capsule', 'cli-shell',
    'skill-app-contract', 'skill-app-logic', 'skill-app-support', 'skill-app-capsule', 'browser-support',
    'page-builder-vue-support', 'mcp-app-capsule', 'live-host-capsule', 'http-shell'].map(name => 'halfcode-lite-' + name);
  const domain = ['domain-contract', 'domain-logic', 'domain-support', 'domain-capsule'].map(name => 'depa-codument-' + name);
  const packages = [
    { directory: 'domain-contract', role: 'contract', allowed: ['xnl-core', 'halfcode-lite-skill-app-contract'] },
    { directory: 'domain-logic', role: 'logic', allowed: [domain[0], 'xnl-core', 'halfcode-lite-skill-app-contract'] },
    { directory: 'domain-support', role: 'support', allowed: [domain[0], 'halfcode-lite-skill-app-support'] },
    { directory: 'domain-capsule', role: 'capsule', allowed: domain.slice(0, 2) },
    { directory: 'host-adapter', role: 'adapter', allowed: [...domain.slice(0, 2), ...publicNames] },
    { directory: 'product-capsule', role: 'capsule', allowed: [...domain, 'depa-codument-host-adapter', ...publicNames] },
    // Product formatting consumes the public CommandResult type; no generic implementation is copied.
    { directory: 'cli-shell', role: 'shell', allowed: ['depa-codument-product-capsule', 'halfcode-lite-cli-shell', 'halfcode-lite-cli-contract'] },
    { directory: 'skill-app-contract', role: 'contract', allowed: ['halfcode-lite-skill-app-contract', 'halfcode-compiler.xnl'] },
    { directory: 'page-builder-vue', role: 'support', name: 'depa-codument-page-builder-vue-support', allowed: ['halfcode-lite-page-builder-vue-support'] },
    { directory: 'mcp-app', role: 'capsule', name: 'depa-codument-mcp-app-capsule', allowed: ['halfcode-lite-mcp-app-capsule'] },
    { directory: 'cli', role: 'shell', allowed: [...publicNames, ...domain, 'depa-codument-host-adapter', 'depa-codument-product-capsule',
      'depa-codument-cli-shell', 'depa-codument-skill-app-contract', 'depa-codument-page-builder-vue-support',
      'depa-codument-mcp-app-capsule', '@modelcontextprotocol/sdk', '@module-federation/runtime', 'ajv', 'halfcode-compiler.xnl', 'hono', 'yaml'] },
  ];
  for (const retired of [...cliRoles.map(role => 'cli-host-' + role), 'skill-app-logic', 'skill-app-support', 'browser-support']) {
    if (fs.existsSync(path.join(root, 'packages', retired, 'package.json'))) errors.push(retired + ': retired generic implementation is still a workspace package');
  }
  const graph = new Map<string, string[]>();
  for (const entry of packages) {
    const role = entry.role;
    const directory = path.join(root, 'packages', entry.directory);
    if (!fs.existsSync(path.join(directory, 'package.json'))) {
      errors.push(entry.directory + ': missing package manifest');
      continue;
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if ((manifest.private && entry.directory !== 'cli') || manifest.name !== (entry.name ?? 'depa-codument-' + entry.directory)) errors.push(entry.directory + ': invalid package identity');
    if (entry.directory !== 'cli' && !manifest.exports?.['.']) errors.push(role + ': missing public entrypoint');
    const declared = new Set(Object.keys(manifest.dependencies ?? {}));
    graph.set(manifest.name, [...declared]);
    for (const dependency of declared) if (publicNames.includes(dependency)) {
      if (manifest.dependencies[dependency] !== publicVersion(dependency)) errors.push(manifest.name + ': public dependency must use the verified exact version: ' + dependency);
      try {
        const resolved = fs.realpathSync(Bun.resolveSync(dependency, directory));
        if (!resolved.startsWith(fs.realpathSync(root) + path.sep) || !resolved.includes(path.sep + 'node_modules' + path.sep)) {
          errors.push(manifest.name + ': public dependency is not an installed artifact: ' + dependency);
        }
      } catch { errors.push(manifest.name + ': public package is not resolvable: ' + dependency); }
    }
    for (const dependency of declared) {
      if (!entry.allowed.includes(dependency)) {
        errors.push(role + ': forbidden dependency ' + dependency);
      }
    }
    for (const file of filesAt(path.join(directory, 'src')).filter((file) => file.endsWith('.ts') && !file.includes(path.sep + 'templates' + path.sep))) {
      const source = fs.readFileSync(file, 'utf8');
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const inspect = (node: ts.Node): void => {
        let specifier: string | undefined;
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          specifier = node.moduleSpecifier.text;
        }
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === 'require')) {
          const value = node.arguments[0];
          if (!value || !ts.isStringLiteral(value)) {
            if (role === 'logic' || role === 'contract') errors.push(file + ': opaque runtime import');
          }
          else specifier = value.text;
        }
        if (specifier) {
          if (specifier.startsWith('.')) {
            const resolved = path.resolve(path.dirname(file), specifier);
            if (!resolved.startsWith(directory + path.sep)) errors.push(file + ': private cross-package path ' + specifier);
          } else if (specifier.startsWith('node:') || specifier.startsWith('bun:')) {
            if (role === 'logic' || role === 'contract') errors.push(file + ': concrete IO in ' + role);
          } else {
            const segments = specifier.split('/');
            const packageName = segments.slice(0, specifier.startsWith('@') ? 2 : 1).join('/');
            if (!declared.has(packageName)) errors.push(file + ': undeclared import ' + specifier);
            if (specifier.includes('/src/') || specifier.includes('/dist/')) errors.push(file + ': private package import ' + specifier);
          }
        }
        if (role === 'contract' || role === 'logic') {
          const parent = node.parent;
          const propertyName = parent && (
            (ts.isPropertyAccessExpression(parent) && parent.name === node)
            || ((ts.isMethodSignature(parent) || ts.isPropertySignature(parent)
              || ts.isMethodDeclaration(parent) || ts.isPropertyAssignment(parent)) && parent.name === node)
          );
          if (ts.isIdentifier(node) && !propertyName && ['process', 'Bun', 'fetch', 'console', 'require'].includes(node.text)) {
            errors.push(file + ': ambient effect ' + node.text);
          }
        }
        ts.forEachChild(node, inspect);
      };
      inspect(ast);
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(name: string): void {
    if (visiting.has(name)) { errors.push('Package dependency cycle: ' + name); return; }
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of graph.get(name) ?? []) if (graph.has(dependency)) visit(dependency);
    visiting.delete(name); visited.add(name);
  }
  for (const name of graph.keys()) visit(name);
  if (errors.length) throw new Error(errors.join('\n'));
  const testPaths = ['packages/cli/test/cli/command-registry.test.ts', 'packages/cli/test/cli/serve-placement.test.ts',
    ...(withBrowser ? ['packages/cli/test/cli/opencli-command-integration.test.ts', 'packages/cli/test/cli/debug-runtime.test.ts'] : []),
    ...(withVue ? ['packages/page-builder-vue/test', 'packages/cli/test/cli/vue-page-builder.test.ts',
      'packages/cli/test/cli/page-bundle.test.ts', 'packages/cli/test/cli/package-page-site.test.ts',
      'packages/cli/test/cli/page-runtime.test.ts', 'packages/cli/test/cli/site-runtime.test.ts', 'packages/cli/test/cli/vue-page-integration.test.ts'] : []),
    ...(withMcp ? ['packages/mcp-app/test'] : []),
    ...(withDomainCore ? ['packages/domain-logic/test', 'packages/domain-support/test', 'packages/domain-capsule/test', ...WORKSPACE_APP_TEST_PATHS, 'packages/cli/test/cli/domain-commands.test.ts', 'packages/cli/test/cli/domain-query.test.ts', 'packages/cli/test/cli/domain-scaffold.test.ts', 'packages/cli/test/cli/domain-validate.test.ts', 'packages/cli/test/cli/domain-std.test.ts', 'packages/cli/test/cli/domain-knowledge.test.ts', 'packages/cli/test/cli/domain-artifact.test.ts', 'packages/cli/test/cli/domain-archive.test.ts'] : []),
    ...(withSkillApp ? ['packages/skill-app-contract/test', 'packages/cli/test/cli/host-resource-contracts.test.ts',
      'packages/cli/test/cli/workspace-resource-catalog.test.ts', 'packages/cli/test/cli/package-host-bundle.test.ts'] : [])];
  // Every original target still runs. Isolate scratch per target so a test that
  // leaves optional-worker material cannot accumulate it across this wide gate.
  for (const target of testPaths) {
    const child = Bun.spawn([process.execPath, path.join(root, 'scripts/test.ts'), target], {
      cwd: root, stdout: 'inherit', stderr: 'inherit',
    });
    if (await child.exited !== 0) throw new Error(`CLI behavior/lifecycle tests failed: ${target}`);
  }
}
