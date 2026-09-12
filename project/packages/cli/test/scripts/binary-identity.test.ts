import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BIN, SKILL_DEMO, WORKSPACE_DIR } from '../../src/identity';
import { RELEASE_TARGETS } from '../../../../scripts/release-targets';
import { installedBinaryCandidates, installCommandPlan } from '../../../../scripts/install-local-release';

const root = resolve(import.meta.dir, '../../../..');

test('new distributions expose only depa-codument without renaming workspace resources', () => {
  expect(BIN).toBe('depa-codument');
  expect(WORKSPACE_DIR).toBe('.codument');
  expect(SKILL_DEMO).toBe('codument-demo');
  const manifest = (directory: string) => JSON.parse(readFileSync(resolve(root, directory, 'package.json'), 'utf8'));
  expect(manifest('packages/cli').bin).toEqual({ 'depa-codument': 'src/cli/index.ts' });
  expect(manifest('.').scripts.build).toBe('bun run scripts/build.ts');
  for (const target of RELEASE_TARGETS) {
    const binary = target.platform === 'win32' ? 'depa-codument.exe' : 'depa-codument';
    const pkg = manifest(`packages/${target.packageDirectory}`);
    expect(target.binaryName).toBe(binary);
    expect(pkg.bin).toEqual({ 'depa-codument': `bin/${binary}` });
    expect(pkg.files).toContain(`bin/${binary}`);
    expect(pkg.files.some((file: string) => /^bin\/codument(?:\.exe)?$/.test(file))).toBe(false);
    expect(installedBinaryCandidates('/isolated/bin', target)).toEqual(
      target.platform === 'win32'
        ? ['/isolated/bin/depa-codument.exe', '/isolated/bin/depa-codument']
        : ['/isolated/bin/depa-codument'],
    );
    const plan = installCommandPlan(target, '/isolated/package', '/isolated/bun');
    expect(plan.flat()).not.toContain('codument');
    expect(plan.flat()).not.toContain('depa-codument'); // Never uninstall the legacy root package.
  }
  const lock = readFileSync(resolve(root, 'bun.lock'), 'utf8');
  expect(lock).not.toMatch(/"codument":\s*"(?:src\/cli\/index\.ts|bin\/codument(?:\.exe)?)"/);
});
