#!/usr/bin/env bun
import { createMddBrowserRobotEffect } from '../packages/cli/src/cli/effects/mdd-browser-robot';
import type { BrowserProviderEffect } from '../packages/cli/src/cli/effects/browser-provider';

export interface MddProviderVerificationOptions {
  readonly binary: string;
  readonly url: string;
  readonly session?: string;
  readonly createEffect?: (options: { binary: string; session: string }) => BrowserProviderEffect;
}

export interface MddProviderVerificationReceipt {
  readonly kind: 'mdd-browser-robot-provider-verification';
  readonly evidence: 'real-browser';
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly transport: 'mdd-browser-robot';
  readonly session: string;
  readonly attempts: readonly [
    { readonly status: number; readonly ok: boolean; readonly url: string; readonly contentType: string },
    { readonly status: number; readonly ok: boolean; readonly url: string; readonly contentType: string },
  ];
}

export async function verifyMddBrowserRobotProvider(
  options: MddProviderVerificationOptions,
): Promise<MddProviderVerificationReceipt> {
  const binary = options.binary.trim();
  if (!binary) throw new Error('MDD_BROWSER_ROBOT_BIN is required');
  const url = new URL(options.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('verification URL must use HTTP(S)');
  }
  const session = options.session?.trim() || `mdd-provider-verification-${process.platform}`;
  const effect = (options.createEffect ?? createMddBrowserRobotEffect)({ binary, session });
  const fetchOnce = async () => {
    const response = await effect.browserFetch({
      url: url.href,
      method: 'GET',
      headers: { Accept: 'text/html,application/json' },
      timeoutMs: 20_000,
    });
    if (response.status <= 0 || !response.url) {
      throw new Error(`real-browser verification failed: ${response.error || response.statusText || 'empty response'}`);
    }
    return {
      status: response.status,
      ok: response.ok,
      url: response.url,
      contentType: response.contentType,
    };
  };

  return {
    kind: 'mdd-browser-robot-provider-verification',
    evidence: 'real-browser',
    platform: process.platform,
    architecture: process.arch,
    transport: 'mdd-browser-robot',
    session,
    attempts: [await fetchOnce(), await fetchOnce()],
  };
}

if (import.meta.main) {
  const binary = process.env.MDD_BROWSER_ROBOT_BIN?.trim() || '';
  const url = process.env.MDD_BROWSER_ROBOT_VERIFY_URL?.trim() || 'https://example.com/';
  console.log(JSON.stringify(await verifyMddBrowserRobotProvider({ binary, url }), null, 2));
}
