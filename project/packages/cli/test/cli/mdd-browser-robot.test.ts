import { describe, expect, test } from 'bun:test';
import {
  MDD_BROWSER_PROVIDER_PROTOCOL,
  createMddBrowserRobotEffect,
  resolveMddBrowserRobotBinary,
} from '../../src/cli/effects/mdd-browser-robot';
import type { BrowserFetchEnvelope } from '../../src/cli/effects/browser-provider';

const envelope: BrowserFetchEnvelope = {
  ok: true,
  status: 200,
  statusText: 'OK',
  url: 'https://example.test/api/items',
  contentType: 'application/json',
  text: '{"items":[1]}',
};

describe('MDD Browser Robot provider adapter', () => {
  test('resolves explicit, PATH and common user-local binaries', () => {
    expect(resolveMddBrowserRobotBinary('/custom/mdd', {})).toBe('/custom/mdd');
    expect(resolveMddBrowserRobotBinary(undefined, { which: () => '/path/mdd' })).toBe('/path/mdd');
    expect(resolveMddBrowserRobotBinary(undefined, {
      which: () => null,
      homeDir: '/home/demo',
      isExecutable: (candidate) => candidate === '/home/demo/.local/bin/mdd-browser-robot',
    })).toBe('/home/demo/.local/bin/mdd-browser-robot');
  });

  test('invokes only Chrome Extension RPC and unwraps return-by-value envelope', async () => {
    const calls: Array<{ command: string[]; stdin: string }> = [];
    const effect = createMddBrowserRobotEffect({
      binary: '/bin/mdd-browser-robot',
      session: 'host-session',
      async run(command, stdin) {
        calls.push({ command, stdin });
        const request = JSON.parse(stdin) as { id: string; input: { source: string } };
        expect(request.input.source).toContain('https://example.test');
        expect(request.input.source).toContain('browser.navigate');
        expect(request.input.source).toContain('browser.evaluate');
        return {
          code: 0,
          stdout: JSON.stringify({
            protocol: MDD_BROWSER_PROVIDER_PROTOCOL,
            id: request.id,
            ok: true,
            result: { result: { value: envelope } },
            outputs: [],
          }),
          stderr: '',
        };
      },
    });

    await expect(effect.browserFetch({ url: envelope.url, method: 'GET', headers: {} }))
      .resolves.toEqual(envelope);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toEqual([
      '/bin/mdd-browser-robot', '--transport', 'chrome', 'session', 'host-session', 'rpc',
    ]);
    expect(JSON.parse(calls[0]!.stdin)).toMatchObject({
      protocol: MDD_BROWSER_PROVIDER_PROTOCOL,
      operation: 'evaluate',
    });
  });

  test('surfaces typed provider errors exactly once without fallback', async () => {
    let calls = 0;
    const effect = createMddBrowserRobotEffect({
      async run(_command, stdin) {
        calls += 1;
        const request = JSON.parse(stdin) as { id: string };
        return {
          code: 0,
          stdout: JSON.stringify({
            protocol: MDD_BROWSER_PROVIDER_PROTOCOL,
            id: request.id,
            ok: false,
            error: { code: 'grant_missing', message: 'extension grant is missing' },
          }),
          stderr: '',
        };
      },
    });
    await expect(effect.browserFetch({ url: envelope.url, method: 'GET', headers: {} }))
      .rejects.toThrow('[grant_missing] extension grant is missing');
    expect(calls).toBe(1);
  });

  test('rejects non-zero exit and malformed protocol output', async () => {
    const failed = createMddBrowserRobotEffect({
      run: async () => ({ code: 7, stdout: '', stderr: 'native host unavailable' }),
    });
    await expect(failed.browserFetch({ url: envelope.url, method: 'GET', headers: {} }))
      .rejects.toThrow('native host unavailable');

    const malformed = createMddBrowserRobotEffect({
      run: async () => ({ code: 0, stdout: '{"ok":true}', stderr: '' }),
    });
    await expect(malformed.browserFetch({ url: envelope.url, method: 'GET', headers: {} }))
      .rejects.toThrow('invalid provider response');
  });
});
