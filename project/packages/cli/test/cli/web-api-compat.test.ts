import { afterEach, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runWebApiModule } from '../../src/cli/runtime/web-api';
import { runCompiledEntry } from '../../src/cli/runtime/exec-code';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });

test('product compatibility scopes preserve explicit global fetch scripts and restore the previous descriptor', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'web-api-compat-'));
  roots.push(root);
  const file = path.join(root, 'legacy.js');
  await fs.writeFile(file, 'export default async () => (await globalThis.client_fetch("https://notes.test/")).text();');
  const before = Object.getOwnPropertyDescriptor(globalThis, 'client_fetch');
  expect(await Promise.all([
    runWebApiModule({ modulePath: file, input: {}, clientFetch: async () => new Response('first') }),
    runCompiledEntry({ modulePath: file, input: {}, clientFetch: async () => new Response('second') }),
  ])).toEqual(['first', 'second']);
  await expect(runWebApiModule({ modulePath: file, input: {}, clientFetch: async () => { throw new Error('provider failed'); } })).rejects.toThrow('provider failed');
  expect(Object.getOwnPropertyDescriptor(globalThis, 'client_fetch')).toEqual(before);
});
