import { describe, expect, test } from 'bun:test';
import {
  createBrowserProviderClientFetch,
  type BrowserFetchEnvelope,
  type BrowserProviderEffect,
} from '../../src/cli/effects/browser-provider';
import { createEgoBrowserEffect } from '../../src/cli/effects/ego-browser';
import { createOpenCliEffect } from '../../src/cli/effects/opencli';

const envelope: BrowserFetchEnvelope = {
  ok: true,
  status: 200,
  statusText: 'OK',
  url: 'https://example.test/data',
  contentType: 'application/json',
  text: '{"ok":true}',
};

describe('browser provider runtime contract', () => {
  test('accepts Ego and OpenCLI through the same provider-neutral effect', () => {
    const providers: BrowserProviderEffect[] = [
      createEgoBrowserEffect({ taskSpace: 'contract' }),
      createOpenCliEffect({ subtransport: 'browser-eval', session: 'contract' }),
    ];
    expect(providers.map((provider) => provider.transport)).toEqual(['ego-browser', 'opencli']);
  });

  test('adapts any provider effect to client_fetch without dependency-specific naming', async () => {
    const calls: string[] = [];
    const provider: BrowserProviderEffect = {
      transport: 'ego-browser',
      session: 'neutral',
      async browserFetch(request) {
        calls.push(request.url);
        return envelope;
      },
    };
    const response = await createBrowserProviderClientFetch(provider)(envelope.url);
    expect(calls).toEqual([envelope.url]);
    expect(await response.json()).toEqual({ ok: true });
  });
});
