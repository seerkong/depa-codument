import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CONFIG_FILE, readWorkspaceConfig, writeCliToolsConfig } from '../../src/cli/install';
import { createWorkspaceEffect } from '../../src/cli/effects/workspace';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function workspaceWith(config: unknown) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-browser-config-'));
  roots.push(root);
  const file = path.join(root, CONFIG_FILE);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(config)}\n`);
  return { workspace: createWorkspaceEffect(root), file };
}

describe('workspace browser transport config', () => {
  test('reads a configured OpenCLI transport and preserves it during workspace upgrades', async () => {
    const { workspace, file } = await workspaceWith({
      tools: ['codex'], browser: { transport: 'opencli', opencli: { transport: 'plugin' } }, updated_at: 'old',
    });
    expect((await readWorkspaceConfig(workspace)).browser).toEqual({ transport: 'opencli', opencli: { transport: 'plugin' } });
    await writeCliToolsConfig(workspace, ['codex']);
    expect(JSON.parse(await fs.readFile(file, 'utf8')).browser).toEqual({ transport: 'opencli', opencli: { transport: 'plugin' } });
  });

  test('keeps old workspaces compatible and rejects invalid configured transports', async () => {
    const legacy = await workspaceWith({ tools: ['codex'], updated_at: 'old' });
    expect((await readWorkspaceConfig(legacy.workspace)).browser).toBeUndefined();

    const invalid = await workspaceWith({ tools: ['codex'], browser: { transport: 'unknown' } });
    await expect(readWorkspaceConfig(invalid.workspace)).rejects.toThrow('browser.transport must be');
  });

  test('keeps backend-specific settings under the transport-named config block', async () => {
    const { workspace } = await workspaceWith({
      tools: ['codex'],
      browser: {
        transport: 'ego-browser',
        'ego-browser': { 'future-option': 'kept-opaque' },
        opencli: { transport: 'browser-eval' },
      },
    });
    expect((await readWorkspaceConfig(workspace)).browser).toEqual({
      transport: 'ego-browser',
      'ego-browser': { 'future-option': 'kept-opaque' },
      opencli: { transport: 'browser-eval' },
    });
  });

  test('reads and preserves the Chrome Extension-only MDD provider block', async () => {
    const { workspace, file } = await workspaceWith({
      tools: ['codex'],
      browser: {
        transport: 'mdd-browser-robot',
        'mdd-browser-robot': { transport: 'chrome-extension' },
      },
    });
    expect((await readWorkspaceConfig(workspace)).browser).toEqual({
      transport: 'mdd-browser-robot',
      'mdd-browser-robot': { transport: 'chrome-extension' },
    });
    await writeCliToolsConfig(workspace, ['codex']);
    expect(JSON.parse(await fs.readFile(file, 'utf8')).browser).toEqual({
      transport: 'mdd-browser-robot',
      'mdd-browser-robot': { transport: 'chrome-extension' },
    });
  });

  test('rejects missing or non-extension MDD provider config', async () => {
    const missing = await workspaceWith({ browser: { transport: 'mdd-browser-robot' } });
    await expect(readWorkspaceConfig(missing.workspace)).rejects.toThrow('browser.mdd-browser-robot');
    const invalid = await workspaceWith({
      browser: {
        transport: 'mdd-browser-robot',
        'mdd-browser-robot': { transport: 'ego' },
      },
    });
    await expect(readWorkspaceConfig(invalid.workspace)).rejects.toThrow('must be chrome-extension');
  });
});
