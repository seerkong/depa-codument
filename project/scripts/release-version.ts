import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Project package.json owns the product version; native manifests are release projections. */
export function stageReleaseVersion(repoRoot: string, packageRoot: string): void {
  const product = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
  const path = resolve(packageRoot, 'package.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.version === product.version) return;
  manifest.version = product.version;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
