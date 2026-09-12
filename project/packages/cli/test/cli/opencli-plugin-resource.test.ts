import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSourceResourceEffect, type ResourceEffect } from '../../src/cli/effects/resource';
import {
  OPENCLI_PLUGIN_RESOURCE_PATH,
  materializeOpenCliPlugin,
} from '../../src/cli/effects/opencli-plugin';

describe('OpenCLI plugin resource materializer', () => {
  test('materializes the fixed source resource inventory and reuses its digest directory', async () => {
    const cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opencli-plugin-test-'));
    try {
      const resources = createSourceResourceEffect();
      const first = await materializeOpenCliPlugin({ resources, cacheRoot });
      const second = await materializeOpenCliPlugin({ resources, cacheRoot });
      expect(second).toBe(first);
      expect(path.dirname(first)).toBe(cacheRoot);
      expect((await fs.readdir(first)).sort()).toEqual([
        'browser-fetch.js', 'opencli-plugin.json', 'package.json', 'request.d.ts', 'request.js',
      ]);
      expect(await fs.readFile(path.join(first, 'opencli-plugin.json'), 'utf8'))
        .toContain('codument-opencli');
    } finally {
      await fs.rm(cacheRoot, { recursive: true, force: true });
    }
  });

  test('concurrent first-use materializations converge on the same verified directory', async () => {
    const cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opencli-plugin-test-'));
    try {
      const resources = createSourceResourceEffect();
      const directories = await Promise.all(Array.from(
        { length: 12 },
        () => materializeOpenCliPlugin({ resources, cacheRoot }),
      ));
      expect(new Set(directories).size).toBe(1);
      expect((await fs.readdir(directories[0]!)).sort()).toEqual([
        'browser-fetch.js', 'opencli-plugin.json', 'package.json', 'request.d.ts', 'request.js',
      ]);
    } finally {
      await fs.rm(cacheRoot, { recursive: true, force: true });
    }
  });

  test('fails closed when an embedded resource is missing', async () => {
    const resources: ResourceEffect = {
      stat: async () => undefined,
      readDirectory: async () => undefined,
      readText: async (resourcePath) => resourcePath.endsWith('request.js') ? undefined : 'present',
      readBytes: async () => undefined,
    };
    await expect(materializeOpenCliPlugin({ resources }))
      .rejects.toThrow(`${OPENCLI_PLUGIN_RESOURCE_PATH}/request.js`);
  });

  test('rejects an existing digest directory whose inventory was modified', async () => {
    const cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opencli-plugin-test-'));
    try {
      const resources = createSourceResourceEffect();
      const directory = await materializeOpenCliPlugin({ resources, cacheRoot });
      await fs.writeFile(path.join(directory, 'package.json'), '{"tampered":true}\n');
      await expect(materializeOpenCliPlugin({ resources, cacheRoot })).rejects.toThrow('content mismatch');
    } finally {
      await fs.rm(cacheRoot, { recursive: true, force: true });
    }
  });
});
