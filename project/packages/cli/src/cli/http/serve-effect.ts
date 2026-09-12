import type { CommandRuntime } from '../contracts/command';
import type { HttpHostHandle } from 'halfcode-cli-lite-cli-host-contract/http';
import { createBunHttpListener } from 'halfcode-cli-lite-cli-host-support/http';
import { startHttpHost } from 'halfcode-cli-lite-live-host-capsule/http';
import { createPageChannelPlatform } from 'halfcode-cli-lite-skill-app-support/page-channels';
import { createHttpApp } from './app';

export interface ServeHttpStartInput {
  runtime: CommandRuntime;
  host: string;
  port: number;
  serverInstanceId: string;
}

export type ServeHttpHandle = HttpHostHandle;

export interface ServeHttpEffect {
  start(input: ServeHttpStartInput): ServeHttpHandle;
}

export function createServeHttpEffect(): ServeHttpEffect {
  return {
    start(input) {
      return startHttpHost({
        listener: createBunHttpListener(), platform: createPageChannelPlatform(),
        identity: { serverInstanceId: input.serverInstanceId, pid: process.pid, host: input.host, port: input.port },
        pageSocketPath: '/ws/pages',
        instructionChannels: [{ path: '/ws/duplex-codex', channel: 'duplex-codex' }],
        createHandler({ instructions, pages, identity }) {
          const app = createHttpApp(input.runtime, instructions, pages, { serveInstance: identity });
          return (request) => app.fetch(request);
        },
        async release() {
          if (input.runtime.close) await input.runtime.close();
          else if (input.runtime.page?.close) await input.runtime.page.close();
          else await input.runtime.page?.builds?.shutdown();
        },
      });
    },
  };
}
