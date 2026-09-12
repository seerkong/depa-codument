import { describe, expect, test } from 'bun:test';
import type { BrowserProviderEffect } from '../../src/cli/effects/browser-provider';
import { verifyMddBrowserRobotProvider } from '../../../../scripts/verify-mdd-browser-robot-provider';

describe('MDD Browser Robot provider verifier', () => {
  test('runs two calls through one environment-bound provider session and emits bounded evidence', async () => {
    const requests: string[] = [];
    let constructed: { binary: string; session: string } | undefined;
    const receipt = await verifyMddBrowserRobotProvider({
      binary: '/session-binding/mdd-browser-robot',
      url: 'https://example.com/path',
      session: 'same-session',
      createEffect(options) {
        constructed = options;
        return {
          transport: 'mdd-browser-robot',
          session: options.session,
          async browserFetch(request) {
            requests.push(request.url);
            return {
              ok: true,
              status: 200,
              statusText: 'OK',
              url: request.url,
              contentType: 'text/html',
              text: '<private-page-content-is-not-evidence>',
            };
          },
        } satisfies BrowserProviderEffect;
      },
    });

    expect(constructed).toEqual({ binary: '/session-binding/mdd-browser-robot', session: 'same-session' });
    expect(requests).toEqual(['https://example.com/path', 'https://example.com/path']);
    expect(receipt).toMatchObject({
      evidence: 'real-browser',
      transport: 'mdd-browser-robot',
      session: 'same-session',
      attempts: [
        { status: 200, url: 'https://example.com/path' },
        { status: 200, url: 'https://example.com/path' },
      ],
    });
    expect(JSON.stringify(receipt)).not.toContain('private-page-content');
  });

  test('rejects missing bindings and non-HTTP verification URLs before constructing effects', async () => {
    await expect(verifyMddBrowserRobotProvider({ binary: ' ', url: 'https://example.com' })).rejects.toThrow(
      'MDD_BROWSER_ROBOT_BIN is required',
    );
    await expect(verifyMddBrowserRobotProvider({ binary: '/mdd', url: 'file:///private' })).rejects.toThrow(
      'must use HTTP(S)',
    );
  });
});
