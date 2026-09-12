import { afterEach, describe, expect, test } from 'bun:test';

const installed = new Map();
function installGlobal(name, value) {
  installed.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
afterEach(() => {
  for (const [name, descriptor] of installed) descriptor
    ? Object.defineProperty(globalThis, name, descriptor)
    : delete globalThis[name];
  installed.clear();
});

describe('Page Runner Shell integration', () => {
  test('re-registers one shared PageBundle frame when its active Page identity changes', async () => {
    let socket;
    class FakeWebSocket {
      constructor(url) { this.url = url; this.listeners = new Map(); this.sent = []; socket = this; }
      addEventListener(type, listener) { this.listeners.set(type, listener); }
      send(value) { this.sent.push(JSON.parse(value)); }
      emit(type, value = {}) { this.listeners.get(type)?.(value); }
      close() {}
    }
    installGlobal('location', { protocol: 'http:', host: '127.0.0.1:8787' });
    installGlobal('WebSocket', FakeWebSocket);
    const { connectPage } = await import(`../../src/templates/web/page-runner.js?connection=${Date.now()}`);
    const connection = connectPage('overview');
    socket.emit('open');
    expect(socket.sent).toEqual([{ type: 'page.register', pageName: 'overview' }]);
    socket.emit('message', { data: JSON.stringify({ type: 'page.registered', pageName: 'overview', targetRef: 'target-overview' }) });
    expect(await connection.ready).toBe('target-overview');
    expect(connection.targetRef).toBe('target-overview');

    const liveReady = connection.register('live');
    expect(connection.targetRef).toBe('');
    expect(socket.sent.at(-1)).toEqual({ type: 'page.register', pageName: 'live' });
    socket.emit('message', { data: JSON.stringify({ type: 'page.registered', pageName: 'overview', targetRef: 'stale-target' }) });
    expect(connection.targetRef).toBe('');
    socket.emit('message', { data: JSON.stringify({ type: 'page.registered', pageName: 'live', targetRef: 'target-live' }) });
    expect(await liveReady).toBe('target-live');
    expect(connection.targetRef).toBe('target-live');
  });

  test('signals the parent Shell when Agent task delivery requires binding', async () => {
    const messages = [];
    const parent = { postMessage(message, origin) { messages.push({ message, origin }); } };
    installGlobal('window', { parent });
    installGlobal('location', { origin: 'http://127.0.0.1:8787' });
    installGlobal('fetch', async () => ({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, bindingRequired: true, message: 'binding required' }),
    }));
    const { sendAgentTask } = await import(`../../src/templates/web/page-runner.js?shell=${Date.now()}`);
    await expect(sendAgentTask({ targetRef: 'target', action: 'Demo.Action' })).rejects.toThrow('binding required');
    expect(messages).toEqual([{
      message: { type: 'codument.session-required' },
      origin: 'http://127.0.0.1:8787',
    }]);
  });

  test('unwraps a Page-allowlisted Local Function result for typed UI hydration', async () => {
    const requests = [];
    const typedResult = { ok: true, value: 'ready', count: 2 };
    installGlobal('document', { documentElement: { dataset: { pageName: 'demo-page' } } });
    installGlobal('location', { pathname: '/page-content/ignored/' });
    installGlobal('fetch', async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({
        ok: true, fqn: 'Codument.Test.LocalFunction.Echo', result: typedResult,
      }) };
    });
    const { invokeLocalFunction } = await import(`../../src/templates/web/page-runner.js?local-function=${Date.now()}`);
    const result = await invokeLocalFunction({
      fqn: 'Codument.Test.LocalFunction.Echo', input: { value: 'ready' }, config: null,
    });
    expect(result).toBe(typedResult);
    expect(requests[0].url).toBe('/api/pages/demo-page/local-functions/invoke');
  });
});
