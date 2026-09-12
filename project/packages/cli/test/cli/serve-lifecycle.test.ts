import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createWorkspaceEffect } from '../../src/cli/effects/workspace';
import type { CommandRuntime } from '../../src/cli/contracts/command';
import { dispatchCommand } from '../../src/cli/command-registry';
import {
  readPageControlRecord,
  runServeSupervisor,
  writePageControlRecord,
  type ServeProcessEffect,
} from '../../src/cli/runtime/serve-process';

function controlledEffect() {
  let nextPid = 100;
  const live = new Set<number>();
  const started: number[] = [];
  const stopped: number[] = [];
  const unhealthyUrls = new Set<string>();
  const effect: ServeProcessEffect = {
    async start({ host, port }) {
      const pid = ++nextPid;
      live.add(pid);
      started.push(pid);
      const actualPort = port || 9000 + pid;
      return { pid, host, port: actualPort, url: `http://${host}:${actualPort}/` };
    },
    async stop(pid) { live.delete(pid); stopped.push(pid); },
    isAlive: (pid) => live.has(pid),
    probeHealth: async (url) => !unhealthyUrls.has(url)
      && [...live].some((pid) => url.includes(String(9000 + pid)) || url.includes(':8787/')),
  };
  return { effect, live, started, stopped, unhealthyUrls };
}

describe('Serve lifecycle supervisor', () => {
  test('start reuses a healthy instance, stop is idempotent, and restart creates a fresh instance', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-serve-lifecycle-'));
    const workspace = createWorkspaceEffect(root);
    const control = controlledEffect();
    const first = await runServeSupervisor(workspace, { action: 'start', host: '127.0.0.1', port: 0 }, control.effect);
    expect(first).toMatchObject({ running: true, action: 'start', agent: 'codex' });
    const reused = await runServeSupervisor(workspace, { action: 'start', port: 8787 }, control.effect);
    expect(reused.pid).toBe(first.pid);
    expect(control.started).toHaveLength(1);
    expect((await runServeSupervisor(workspace, { action: 'status' }, control.effect)).running).toBe(true);

    const restarted = await runServeSupervisor(workspace, { action: 'restart', host: '127.0.0.1', port: 0 }, control.effect);
    expect(restarted).toMatchObject({ running: true, action: 'restart' });
    expect(restarted.pid).not.toBe(first.pid);
    expect(control.stopped).toContain(first.pid);
    expect(control.started).toHaveLength(2);

    expect((await runServeSupervisor(workspace, { action: 'stop' }, control.effect)).running).toBe(false);
    expect((await runServeSupervisor(workspace, { action: 'stop' }, control.effect)).message).toContain('not running');
    expect(await readPageControlRecord(workspace)).toBeUndefined();
  });

  test('an explicit current Codex task binds the started or reused Serve without changing the manual fallback', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-serve-lifecycle-'));
    const workspace = createWorkspaceEffect(root);
    const control = controlledEffect();
    const runtime = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => workspace,
      agent: 'codex' as const,
      serveProcess: control.effect,
    };

    const unbound = await runServeSupervisor(workspace, { action: 'start', port: 0 }, control.effect);
    expect(unbound).toMatchObject({ threadId: '', threadLocked: false });
    const reused = await dispatchCommand(['serve', 'start', '--port', '0', '--codex-thread-id', 'current-codex-task'], runtime, true);
    expect(reused).toMatchObject({ code: 0, data: { threadId: 'current-codex-task', threadLocked: true } });
    expect(await readPageControlRecord(workspace)).toMatchObject({
      threadId: 'current-codex-task',
      threadLocked: true,
    });
    expect(control.started).toHaveLength(1);
  });

  test('status distinguishes stopped and stale records without inventing health', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-serve-lifecycle-'));
    const workspace = createWorkspaceEffect(root);
    const control = controlledEffect();
    expect(await runServeSupervisor(workspace, { action: 'status' }, control.effect)).toMatchObject({ running: false, pid: 0 });
    await writePageControlRecord(workspace, {
      agent: 'codex', pid: 999, host: '127.0.0.1', port: 9999, url: 'http://127.0.0.1:9999/',
      threadId: null, workspaceId: null, threadLocked: false,
    });
    const stale = await runServeSupervisor(workspace, { action: 'status' }, control.effect);
    expect(stale).toMatchObject({ running: false, pid: 999, message: 'serve record is stale' });
  });

  test('start replaces an alive server with an incompatible health protocol', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-serve-lifecycle-'));
    const workspace = createWorkspaceEffect(root);
    const control = controlledEffect();
    const first = await runServeSupervisor(workspace, { action: 'start', host: '127.0.0.1', port: 0 }, control.effect);
    control.unhealthyUrls.add(first.url);
    const replacement = await runServeSupervisor(workspace, { action: 'start', host: '127.0.0.1', port: 0 }, control.effect);
    expect(replacement).toMatchObject({ running: true, action: 'start' });
    expect(replacement.pid).not.toBe(first.pid);
    expect(control.stopped).toContain(first.pid);
    expect(control.live.has(first.pid)).toBe(false);
  });

  test('registered subcommands and the bare compatibility entry preserve result codes and validation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-serve-lifecycle-'));
    const workspace = createWorkspaceEffect(root);
    const control = controlledEffect();
    const runtime = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => workspace,
      agent: 'codex' as const,
      serveProcess: control.effect,
    };
    expect(await dispatchCommand(['serve', 'start', '--port', '0'], runtime, true)).toMatchObject({ code: 0, data: { action: 'start', running: true } });
    expect(await dispatchCommand(['serve'], runtime, true)).toMatchObject({ code: 0, data: { action: 'start', running: true } });
    expect(await dispatchCommand(['serve', 'status'], runtime, true)).toMatchObject({ code: 0, data: { action: 'status', running: true } });
    expect(await dispatchCommand(['serve', 'restart', '--port', '0'], runtime, true)).toMatchObject({ code: 0, data: { action: 'restart', running: true } });
    expect((await dispatchCommand(['serve', 'stop', 'unexpected'], runtime, true)).code).toBe(1);
    expect((await dispatchCommand(['serve', 'restart', '--port', 'invalid'], runtime, true)).code).toBe(1);
    process.exitCode = 0;
    expect(await dispatchCommand(['serve', 'stop'], runtime, true)).toMatchObject({ code: 0, data: { action: 'stop', running: false } });
    await expect(dispatchCommand(['serve', 'status', '--host', '127.0.0.1'], runtime, true)).rejects.toThrow('Unknown option');
    expect(await dispatchCommand(['serve', 'start', '--codex-thread-id', '   '], runtime, true)).toMatchObject({
      code: 1,
      message: 'Invalid --codex-thread-id. Expected a non-empty Codex task id.',
    });
    process.exitCode = 0;
  });
});
