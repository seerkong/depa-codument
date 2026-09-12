import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import product from '../../../../package.json';
import { VERSION } from '../../src/version';
import { stageReleaseVersion } from '../../../../scripts/release-version';

test('CLI version has one product manifest authority', () => {
  expect(VERSION).toBe(product.version);
});

test('release version follows product bumps without changing independent dependencies', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'depa-codument-version-'));
  const packageRoot = resolve(root, 'native');
  mkdirSync(packageRoot);
  const manifestPath = resolve(packageRoot, 'package.json');
  const manifest = { name: 'example-native', version: '0.1.0', dependencies: { contract: '0.1.1' } };
  try {
    writeFileSync(manifestPath, JSON.stringify(manifest));
    for (const version of ['0.6.0', '0.7.1', '0.8.0-rc.1']) {
      writeFileSync(resolve(root, 'package.json'), JSON.stringify({ version }));
      stageReleaseVersion(root, packageRoot);
      expect(JSON.parse(readFileSync(manifestPath, 'utf8'))).toEqual({ ...manifest, version });
      const bytes = readFileSync(manifestPath, 'utf8');
      stageReleaseVersion(root, packageRoot);
      expect(readFileSync(manifestPath, 'utf8')).toBe(bytes);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
