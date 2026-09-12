import { describe, expect, test } from 'bun:test';
import {
  createOpenCliEffect,
  OPENCLI_PLUGIN_SITE,
  parseJsonFromCliOutput,
  unwrapFetchEnvelope,
} from '../../src/cli/effects/opencli';
import {
  createBrowserProviderClientFetch,
  headerRecord,
  requestUrl,
  type BrowserFetchEnvelope,
} from '../../src/cli/effects/browser-provider';
import { parseTransport } from '../../src/cli/commands/runtime-flags';

const envelope: BrowserFetchEnvelope = {
  ok: true,
  status: 200,
  statusText: 'OK',
  url: 'https://example.test/api/items',
  contentType: 'application/json',
  text: '{"code":0,"data":[{"id":"one"}]}',
};

describe('OpenCLI fetch adapter', () => {
  test('keeps Ego as the default and accepts only explicit OpenCLI transports', () => {
    expect(parseTransport(undefined)).toBe('ego-browser');
    expect(parseTransport('opencli')).toBe('opencli');
    expect(parseTransport('plugin')).toBeUndefined();
    expect(parseTransport('unknown')).toBeUndefined();
  });

  test('normalizes OpenCLI output and Fetch inputs', async () => {
    expect(parseJsonFromCliOutput(`opencli note\n${JSON.stringify(envelope)}\n`)).toEqual(envelope);
    expect(unwrapFetchEnvelope([envelope])).toEqual(envelope);
    expect(requestUrl(new URL('https://example.test/a'))).toBe('https://example.test/a');
    expect(headerRecord(new Headers({ Accept: 'application/json' })).accept).toBe('application/json');

    const fetchImpl = createBrowserProviderClientFetch({
      transport: 'opencli',
      session: 'test',
      async browserFetch(request) {
        expect(request.method).toBe('POST');
        expect(request.body).toBe('{"name":"demo"}');
        return envelope;
      },
    });
    const response = await fetchImpl(envelope.url, { method: 'POST', body: '{"name":"demo"}' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ code: 0, data: [{ id: 'one' }] });
  });

  test('uses the named OpenCLI browser session and binds it to the request origin', async () => {
    const calls: string[][] = [];
    const effect = createOpenCliEffect({
      subtransport: 'browser-eval',
      session: 'session-one',
      run: async (args) => {
        calls.push(args);
        if (args[2] === 'get') return { code: 0, stdout: 'https://other.test/\n', stderr: '' };
        if (args[2] === 'open') return { code: 0, stdout: '', stderr: '' };
        return { code: 0, stdout: JSON.stringify(envelope), stderr: '' };
      },
    });
    expect((await effect.browserFetch({ url: envelope.url, method: 'GET', headers: {} })).status).toBe(200);
    expect(calls[0]).toEqual(['browser', 'session-one', 'get', 'url']);
    expect(calls[1]).toEqual(['browser', 'session-one', 'open', 'https://example.test/', '--window', 'foreground']);
    expect(calls[2]?.slice(0, 3)).toEqual(['browser', 'session-one', 'eval']);
  });

  test('installs the plugin once and reuses it for later requests', async () => {
    const calls: string[][] = [];
    let resolutions = 0;
    const effect = createOpenCliEffect({
      subtransport: 'plugin',
      pluginDir: async () => { resolutions += 1; return '/tmp/test opencli #plugin'; },
      run: async (args) => {
        calls.push(args);
        if (args[0] === 'plugin' && args[1] === 'list') return { code: 0, stdout: '', stderr: '' };
        if (args[0] === 'plugin' && args[1] === 'install') return { code: 0, stdout: '', stderr: '' };
        return { code: 0, stdout: JSON.stringify([envelope]), stderr: '' };
      },
    });
    await effect.browserFetch({ url: envelope.url, method: 'GET', headers: {} });
    await effect.browserFetch({ url: envelope.url, method: 'GET', headers: {} });
    expect(calls.filter((args) => args[0] === 'plugin' && args[1] === 'list')).toHaveLength(1);
    expect(calls.filter((args) => args[0] === 'plugin' && args[1] === 'install')).toEqual([
      ['plugin', 'install', 'file:///tmp/test%20opencli%20%23plugin'],
    ]);
    expect(resolutions).toBe(1);
    expect(calls.filter((args) => args[0] === 'codument-opencli')).toHaveLength(2);
  });

  test('shares plugin installation across concurrent first requests', async () => {
    const calls: string[][] = [];
    const effect = createOpenCliEffect({
      subtransport: 'plugin',
      pluginDir: '/tmp/test-opencli-plugin',
      run: async (args) => {
        calls.push(args);
        if (args[0] === 'plugin' && args[1] === 'list') {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { code: 0, stdout: '', stderr: '' };
        }
        if (args[0] === 'plugin' && args[1] === 'install') {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { code: 0, stdout: '', stderr: '' };
        }
        return { code: 0, stdout: JSON.stringify([envelope]), stderr: '' };
      },
    });
    await Promise.all(Array.from({ length: 12 }, () => (
      effect.browserFetch({ url: envelope.url, method: 'GET', headers: {} })
    )));
    expect(calls.filter((args) => args[0] === 'plugin' && args[1] === 'list')).toHaveLength(1);
    expect(calls.filter((args) => args[0] === 'plugin' && args[1] === 'install')).toHaveLength(1);
    expect(calls.filter((args) => args[0] === OPENCLI_PLUGIN_SITE)).toHaveLength(12);
  });

  test('fails closed when the installed plugin inventory cannot be read', async () => {
    const calls: string[][] = [];
    const effect = createOpenCliEffect({
      subtransport: 'plugin',
      pluginDir: '/tmp/test-opencli-plugin',
      run: async (args) => {
        calls.push(args);
        return { code: 9, stdout: '', stderr: 'plugin registry unavailable' };
      },
    });
    await expect(effect.browserFetch({ url: envelope.url, method: 'GET', headers: {} }))
      .rejects.toThrow('OpenCLI plugin list failed (exit 9)\nplugin registry unavailable');
    expect(calls).toEqual([['plugin', 'list']]);
  });

  test('surfaces OpenCLI failures without selecting another backend', async () => {
    const effect = createOpenCliEffect({
      subtransport: 'browser-eval',
      run: async () => ({ code: 7, stdout: '', stderr: 'browser unavailable' }),
    });
    await expect(effect.browserFetch({ url: envelope.url, method: 'GET', headers: {} }))
      .rejects.toThrow('browser unavailable');
  });
});
