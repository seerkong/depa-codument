import { expect, test } from 'bun:test';
import { serveMcpApp, createMcpAppConnection, createMcpPageTargetStore, type McpAppRuntime } from 'depa-codument-mcp-app-capsule';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

function runtime(): McpAppRuntime {
  return {
    hostSkill: 'notes', targets: createMcpPageTargetStore(),
    pages: { list: async () => [], renderApp: async () => '<html></html>' },
    automation: { list: async () => [] },
    sops: { get: async () => { throw new Error('not configured'); } },
    workflows: { start: async () => { throw new Error('not configured'); }, get: () => undefined },
  };
}

test('failed transport startup releases the capsule without writing diagnostics', async () => {
  let closed = 0;
  const logs: string[] = [];
  await expect(serveMcpApp(runtime(), { transport: {
    start: async () => { throw new Error('transport unavailable'); },
    send: async () => {}, close: async () => { closed++; },
  }, log: (message) => logs.push(message) })).rejects.toThrow('transport unavailable');
  expect(closed).toBe(1);
  expect(logs).toEqual([]);
});

test('managed MCP connection reports stop failure even if transport emits close first', async () => {
  let stops = 0;
  const transport: Transport = {
    start: async () => {}, send: async () => {},
    close: async () => { stops++; transport.onclose?.(); throw new Error('transport close failed'); },
  };
  const connection = await createMcpAppConnection(runtime(), {transport});
  const closing = connection.close();
  expect(connection.close()).toBe(closing);
  await expect(closing).rejects.toThrow('transport close failed');
  await expect(connection.closed).rejects.toThrow('transport close failed');
  expect(stops).toBe(1);
});
