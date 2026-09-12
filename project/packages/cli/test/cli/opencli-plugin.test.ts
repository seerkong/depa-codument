import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  executeBrowserFetch,
  parseBrowserFetchRequest,
} from '../../src/templates/private/global/opencli-browser-fetch/request.js';

describe('generic OpenCLI browser-fetch plugin', () => {
  test('ships a self-contained capsule owned by the current template identity', async () => {
    const root = path.resolve(import.meta.dir, '../../src/templates/private/global/opencli-browser-fetch');
    const files = await fs.readdir(root);
    expect(files.sort()).toEqual(['browser-fetch.js', 'opencli-plugin.json', 'package.json', 'request.d.ts', 'request.js']);
    const contents = await Promise.all(files.map((file) => fs.readFile(path.join(root, file), 'utf8')));
    expect(contents.join('\n')).toContain('codument-opencli');
  });

  test('normalizes a bounded HTTP request', () => {
    expect(parseBrowserFetchRequest(JSON.stringify({
      url: 'https://example.test/api/items?limit=2',
      method: 'post',
      headers: { 'x-demo': 'one' },
      body: '{"name":"demo"}',
      timeoutMs: 2_000,
    }))).toEqual({
      url: 'https://example.test/api/items?limit=2',
      origin: 'https://example.test',
      method: 'POST',
      headers: { 'x-demo': 'one' },
      body: '{"name":"demo"}',
      hasBody: true,
      timeoutMs: 2_000,
    });
  });

  test('rejects malformed or unsafe requests before browser access', () => {
    for (const input of [
      '',
      '[]',
      '{}',
      '{"url":"file:///tmp/secret"}',
      '{"url":"javascript:alert(1)"}',
      '{"url":"https://example.test","headers":[]}',
      '{"url":"https://example.test","body":{"not":"serialized"}}',
      '{"url":"https://example.test","timeoutMs":0}',
      '{"url":"https://example.test","timeoutMs":60001}',
    ]) expect(() => parseBrowserFetchRequest(input)).toThrow();
  });

  test('navigates to the exact origin before evaluating fetch', async () => {
    const calls: Array<{ kind: string; value: unknown }> = [];
    const page = {
      async goto(url: string) { calls.push({ kind: 'goto', value: url }); },
      async evaluateWithArgs(_script: string, args: unknown) {
        calls.push({ kind: 'eval', value: args });
        return {
          ok: true, status: 200, statusText: 'OK',
          url: 'https://example.test/api/items', contentType: 'application/json', text: '{"ok":true}',
        };
      },
    };
    const result = await executeBrowserFetch(page, JSON.stringify({ url: 'https://example.test/api/items' }));
    expect(calls[0]).toEqual({ kind: 'goto', value: 'https://example.test/' });
    expect(calls[1]?.kind).toBe('eval');
    expect(result).toMatchObject({ ok: true, status: 200 });
  });
});
