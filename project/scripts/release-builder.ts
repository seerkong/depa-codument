import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const publicBuilderName = 'halfcode-lite-page-builder-vue-support';

/** Product distribution metadata, not another builder implementation. */
export function stageReleaseBuilder(sourceRoot: string, destination: string): void {
  const manifest = JSON.parse(readFileSync(join(sourceRoot, 'package.json'), 'utf8'));
  const entry = Bun.resolveSync(publicBuilderName, sourceRoot);
  const publicManifest = JSON.parse(readFileSync(join(dirname(entry), '..', 'package.json'), 'utf8'));
  if (publicManifest.name !== publicBuilderName || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(publicManifest.version)) {
    throw new Error('Unresolved public builder release identity');
  }
  const dependencies = { ...manifest.dependencies, [publicBuilderName]: publicManifest.version };
  for (const version of Object.values(dependencies)) {
    if (typeof version !== 'string' || /^(workspace:|file:|link:|\/)/.test(version)) {
      throw new Error('Release builder contains a source dependency');
    }
  }
  const { devDependencies: _dev, scripts: _scripts, ...production } = manifest;
  mkdirSync(destination, { recursive: true });
  cpSync(join(sourceRoot, 'src'), join(destination, 'src'), { recursive: true });
  cpSync(join(sourceRoot, 'README.md'), join(destination, 'README.md'));
  writeFileSync(join(destination, 'package.json'), JSON.stringify({ ...production, dependencies }, null, 2) + '\n');
}
