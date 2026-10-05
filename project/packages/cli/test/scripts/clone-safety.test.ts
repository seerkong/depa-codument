import {describe, expect, test} from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {parseCloneArgs} from 'halfcode-lite-cli-logic/clone';
import {createConsumerScaffold} from 'halfcode-lite-cli-logic/clone-scaffold';
import {cloneWorkspace, sourceRoot, sourcePolicy} from '../../../../scripts/clone';

describe('clone producer safety and explicit boundaries', () => {
  test('parsing rejects ambiguous modes, unknown/repeated options and silent snapshot rebranding', () => {
    expect(parseCloneArgs(['/target', '--mode', 'full'])).toEqual({destination: '/target', mode: 'full', force: false});
    expect(parseCloneArgs(['/target', '--bin', 'notes']).mode).toBe('scaffold');
    for (const args of [
      ['/target'], ['/target', '--bin', 'Bad.Name'], ['/target', '--mode', 'unknown'],
      ['/target', '--mode', 'full', '--bin', 'notes'], ['/target', '--bin', 'notes', '--oops', 'value'],
      ['/target', '--bin', 'notes', '--bin', 'again'], ['/target', '--bin', 'notes', '/other'],
      ['/target', '--mode', 'full', '--force', '--force'],
    ]) expect(() => parseCloneArgs(args)).toThrow();
  });

  test('source policy is explicit, preserves bun.lock and is not the full inventory policy', () => {
    expect(sourcePolicy.roots).toContain('bun.lock');
    expect(sourcePolicy.roots).toContain('packages');
    expect(sourcePolicy.roots).not.toContain('codument');
    expect(sourcePolicy.excludedSegments).toContain('node_modules');
    expect(sourcePolicy.excludedPaths).toContain('packages/runtime-darwin-arm64/bin');
  });

  test('refuses source aliases, nonempty targets and existing empty targets without force', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-producer-safety-'));
    try {
      fs.symlinkSync(sourceRoot, path.join(temp, 'alias'));
      await expect(cloneWorkspace([path.join(temp, 'alias', 'nested'), '--bin', 'notes'])).rejects.toThrow('inside source');
      const destination = path.join(temp, 'existing'); fs.mkdirSync(destination);
      await expect(cloneWorkspace([destination, '--bin', 'notes'])).rejects.toThrow('destination exists');
      fs.writeFileSync(path.join(destination, 'user'), 'keep');
      await expect(cloneWorkspace([destination, '--bin', 'notes', '--force'])).rejects.toThrow('destination exists');
      expect(fs.readFileSync(path.join(destination, 'user'), 'utf8')).toBe('keep');
    } finally { fs.rmSync(temp, {recursive: true, force: true}); }
  });

  test('scaffold rejects unresolved or source-relative public versions', () => {
    const identity = {bin: 'notes', packageName: 'notes', displayName: 'Notes', description: 'Notes CLI'};
    expect(() => createConsumerScaffold(identity, {})).toThrow('exact public version');
    expect(() => createConsumerScaffold(identity, {'halfcode-lite-cli-contract': 'workspace:*'})).toThrow('exact public version');
  });

  test('explicit metadata rebrand preserves original bytes, lock and all semantic identities in separate receipts', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-metadata-'));
    try {
      const result = await cloneWorkspace([path.join(temp, 'snapshot'), '--mode', 'source-only', '--rebrand-metadata', '--bin', 'example', '--package', 'example-product']);
      if (!('rebrandReceiptPath' in result) || typeof result.rebrandReceiptPath !== 'string') throw new Error('Missing rebrand receipt');
      const receipt = JSON.parse(fs.readFileSync(result.rebrandReceiptPath, 'utf8'));
      expect(receipt.scope).toBe('product-metadata-only');
      expect(receipt.resolution).toBe('required-before-build');
      expect(receipt.runtimeCompatibility).toBe('review-required');
      expect(receipt.changes.map((change: {path: string}) => change.path)).toEqual(['package.json', 'packages/cli/src/identity.ts']);
      for (const change of receipt.changes) {
        expect(fs.readFileSync(path.join(result.destination, change.backup))).toEqual(fs.readFileSync(path.join(sourceRoot, change.path)));
      }
      const snapshot = JSON.parse(fs.readFileSync(result.receiptPath, 'utf8'));
      for (const file of snapshot.included) {
        if (file.kind === 'file' && !receipt.changes.some((change: {path: string}) => change.path === file.path)) {
          expect(fs.readFileSync(path.join(result.destination, file.path))).toEqual(fs.readFileSync(path.join(sourceRoot, file.path)));
        }
      }
      expect(JSON.parse(fs.readFileSync(path.join(result.destination, 'package.json'), 'utf8')).name).toBe('example-product');
      expect(fs.readFileSync(path.join(result.destination, 'packages/cli/src/identity.ts'), 'utf8')).toContain('export const BIN = "example"');
      expect(fs.readFileSync(path.join(result.destination, 'bun.lock'))).toEqual(fs.readFileSync(path.join(sourceRoot, 'bun.lock')));
    } finally { fs.rmSync(temp, {recursive: true, force: true}); }
  }, 30_000);
});
