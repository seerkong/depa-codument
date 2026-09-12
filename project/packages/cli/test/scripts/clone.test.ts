import {describe, expect, test} from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {cloneWorkspace, sourceRoot} from '../../../../scripts/clone';
import type {SnapshotCloneReceipt} from 'halfcode-cli-lite-cli-host-contract/clone';

describe('clone producer modes', () => {
  test('default produces only a public-package consumer with an unscoped product prefix', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'product-scaffold-'));
    try {
      const destination = path.join(temp, 'consumer');
      const result = await cloneWorkspace([destination, '--bin', 'notes', '--package', 'depa-codument-notes', '--name', 'Notes']);
      const read = (name: string) => JSON.parse(fs.readFileSync(path.join(destination, name), 'utf8'));
      expect(fs.readdirSync(path.join(destination, 'packages')).sort()).toEqual(['cli-shell', 'product-capsule']);
      expect(read('package.json').name).toBe('depa-codument-notes');
      expect(read('packages/product-capsule/package.json').name).toBe('depa-codument-notes-product-capsule');
      expect(read('packages/cli-shell/package.json').bin).toEqual({notes: 'src/index.ts'});
      expect(read('packages/cli-shell/package.json').dependencies['depa-codument-notes-product-capsule']).toBe('workspace:*');
      const receipt = JSON.parse(fs.readFileSync(result.receiptPath, 'utf8'));
      expect(receipt.installed).toBe(false);
      expect(receipt.identity.bin).toBe('notes');
      expect(Object.keys(receipt.dependencies)).toHaveLength(6);
      for (const [name, version] of Object.entries(receipt.dependencies)) {
        expect(name).toStartWith('halfcode-cli-lite-');
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      }
      expect(fs.readFileSync(path.join(destination, 'app/manifest.xnl'), 'utf8')).toContain('#Notes.App');
      expect(fs.existsSync(path.join(destination, 'app/SKILL.md'))).toBe(true);
      for (const absent of ['app/KindDefinitions', 'codument', '.agents', 'node_modules', 'bun.lock', 'packages/cli', 'packages/cli-host-logic']) expect(fs.existsSync(path.join(destination, absent))).toBe(false);
    } finally { fs.rmSync(temp, {recursive: true, force: true}); }
  });

  test.each(['source-only', 'full'])('%s retains exact selected source bytes and semantic identities', async mode => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'product-snapshot-'));
    try {
      const result = await cloneWorkspace([path.join(temp, 'snapshot'), '--mode', mode]);
      const receipt = JSON.parse(fs.readFileSync(result.receiptPath, 'utf8')) as SnapshotCloneReceipt;
      expect(receipt.mode).toBe(mode);
      expect(receipt.transformation).toBe('none');
      expect(receipt.lock).toBe('original-bytes');
      for (const file of receipt.included) {
        if (file.kind === 'file') expect(fs.readFileSync(path.join(result.destination, file.path))).toEqual(fs.readFileSync(path.join(sourceRoot, file.path)));
      }
      expect(fs.readFileSync(path.join(result.destination, 'packages/cli/src/identity.ts'), 'utf8')).toBe(fs.readFileSync(path.join(sourceRoot, 'packages/cli/src/identity.ts'), 'utf8'));
      expect(fs.existsSync(path.join(result.destination, '.git'))).toBe(false);
      if (mode === 'source-only') {
        expect(fs.existsSync(path.join(result.destination, 'README.md'))).toBe(false);
        expect(receipt.excluded.some(entry => entry.path === 'README.md')).toBe(true);
      } else {
        expect(fs.readFileSync(path.join(result.destination, 'README.md'))).toEqual(fs.readFileSync(path.join(sourceRoot, 'README.md')));
      }
    } finally { fs.rmSync(temp, {recursive: true, force: true}); }
  }, 30_000);
});
