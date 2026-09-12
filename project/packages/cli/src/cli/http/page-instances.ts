import { createPageInstanceHub as createHub } from 'halfcode-cli-lite-live-host-capsule/page-instances';
import { createPageChannelPlatform } from 'halfcode-cli-lite-skill-app-support/page-channels';
export type { PageInstanceHub, PageInstanceSocket, PageInstanceSummary } from 'halfcode-cli-lite-skill-app-contract/page-channels';
export function createPageInstanceHub(options: { timeoutMs?: number } = {}) {
  return createHub({ ...options, platform: createPageChannelPlatform() });
}
