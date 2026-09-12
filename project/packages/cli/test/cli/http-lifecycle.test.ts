import { expect, test } from 'bun:test';
import { createServeHttpEffect } from '../../src/cli/http/serve-effect';
import type { CommandRuntime } from '../../src/cli/contracts/command';
import { createCommandRuntime } from '../../src/cli/runtime';

test('product HTTP shutdown calls its explicit runtime owner once and closes the listener on cleanup failure', async () => {
  let closed = 0;
  const runtime = { resources: {}, workspace: () => ({ root: '/fixture' }),
    async close() { closed++; throw new Error('owned cleanup failed'); } } as unknown as CommandRuntime;
  const server = createServeHttpEffect().start({ runtime, host: '127.0.0.1', port: 0, serverInstanceId: 'fixture' });
  expect((await fetch(server.url + 'api/health')).status).toBe(200);
  const stopped = server.stop();
  expect(server.stop()).toBe(stopped);
  const failure = await stopped.catch(error => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect(closed).toBe(1);
  await expect(fetch(server.url)).rejects.toThrow();
});

test('an unused product runtime closes lazily and idempotently without opening Codex, browser or workspace files', async () => {
  const runtime = createCommandRuntime('/nonexistent-notes-lifecycle-fixture');
  const closed = runtime.close!();
  expect(runtime.close!()).toBe(closed);
  await closed;
  await expect(runtime.codex!.listThreads()).rejects.toThrow('closed');
  await expect(runtime.page!.workflows!.start({ fqn: 'never-loaded', input: {} })).rejects.toThrow('closed');
});
