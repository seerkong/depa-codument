import { describe, expect, test } from 'bun:test';
import { createMcpPageTargetStore } from '../src/support/page-target-store';

describe('MCP App page target authority', () => {
  test('registers unpredictable isolated targets and preserves exact state/result ownership', async () => {
    const store = createMcpPageTargetStore({ ttlMs: 1_000 });
    const first = store.register('google-search', { query: 'supplier risk' });
    const second = store.register('google-search', { query: 'market analytics' });
    expect(first.targetRef).toMatch(/^page_target_/);
    expect(second.targetRef).not.toBe(first.targetRef);
    expect(await store.request(first.targetRef, 'getState')).toEqual({ query: 'supplier risk' });
    await store.request(first.targetRef, 'setResult', { run: { status: 'completed', count: 14 } });
    expect(await store.request(first.targetRef, 'getResult')).toEqual({ run: { status: 'completed', count: 14 } });
    expect(await store.request(second.targetRef, 'getResult')).toBeUndefined();
  });

  test('rejects unknown, released and TTL-expired targetRefs without fallback', async () => {
    let current = 100;
    const store = createMcpPageTargetStore({ ttlMs: 10, now: () => current });
    await expect(store.request('page_target_unknown', 'getState')).rejects.toThrow('unknown or stale');
    const released = store.register('google-search', { query: 'one' });
    store.release(released.targetRef);
    await expect(store.request(released.targetRef, 'getState')).rejects.toThrow('unknown or stale');
    const expired = store.register('google-search', { query: 'two' });
    current = 111;
    expect(store.get(expired.targetRef)).toBeUndefined();
    await expect(store.request(expired.targetRef, 'setResult', {})).rejects.toThrow('unknown or stale');
    expect(store.list()).toEqual([]);
  });

  test('validates page identity and supported page methods', async () => {
    const store = createMcpPageTargetStore();
    expect(() => store.register('  ')).toThrow('pageName is required');
    const target = store.register('google-search');
    await expect(store.request(target.targetRef, 'unknown')).rejects.toThrow('Unsupported page target method');
  });

  test('never resurrects a released or expired targetRef when UUID generation collides', async () => {
    const generated = ['same', 'same', 'fresh'];
    let current = 0;
    const store = createMcpPageTargetStore({
      ttlMs: 10,
      now: () => current,
      randomUUID: () => generated.shift() ?? 'fresh',
    });
    const released = store.register('google-search');
    store.release(released.targetRef);
    const replacement = store.register('google-search');
    expect(replacement.targetRef).toBe('page_target_fresh');
    expect(replacement.targetRef).not.toBe(released.targetRef);
    await expect(store.request(released.targetRef, 'getState')).rejects.toThrow('unknown or stale');

    current = 11;
    expect(store.get(replacement.targetRef)).toBeUndefined();
    const exhausted = createMcpPageTargetStore({ randomUUID: () => 'same' });
    exhausted.register('google-search');
    expect(() => exhausted.register('google-search')).toThrow('Unable to allocate a unique page target reference');
  });
});
