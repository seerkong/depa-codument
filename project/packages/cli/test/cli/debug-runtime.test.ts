import { expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runDebugCode } from '../../src/cli/runtime/exec-code';

test('product debug adapter preserves and restores legacy global fetch on success and failure', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'notes-legacy-debug-'));
  const bundlePath = path.join(root, 'bundle.js');
  const before = Object.getOwnPropertyDescriptor(globalThis, 'client_fetch');
  try {
    await fs.writeFile(bundlePath, 'export async function run_web_api() { return (await globalThis.client_fetch("https://notes.test")).text(); }');
    expect(await runDebugCode({bundlePath, code: 'run_web_api()', clientFetch: async () => new Response('legacy')})).toBe('legacy');
    expect(Object.getOwnPropertyDescriptor(globalThis, 'client_fetch')).toEqual(before);
    await expect(runDebugCode({bundlePath, code: 'run_web_api()', clientFetch: async () => { throw new Error('provider unavailable'); }})).rejects.toThrow('provider unavailable');
    expect(Object.getOwnPropertyDescriptor(globalThis, 'client_fetch')).toEqual(before);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});
