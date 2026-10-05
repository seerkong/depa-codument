import { createPageInstanceHub as createHub } from 'halfcode-lite-live-host-capsule/page-instances';
import { createPageChannelPlatform } from 'halfcode-lite-skill-app-support/page-channels';
export type { PageInstanceHub, PageInstanceSocket, PageInstanceSummary } from 'halfcode-lite-skill-app-contract/page-channels';
export function createPageInstanceHub(options: { timeoutMs?: number } = {}) {
  return createHub({ ...options, platform: createPageChannelPlatform() });
}
