import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Buffer } from 'node:buffer';
import { egoTaskSpaceName } from '../../src/cli/runtime/ego-scope';
import {
  browserDownloadOperationExpression,
  createEgoBrowserSupervisor,
  type BrowserDownloadRequest,
} from '../../src/cli/runtime/ego-supervisor';

async function runDownloadOperation(input: {
  request?: BrowserDownloadRequest;
  eventBatches: unknown[][];
  fileName?: string;
  bytes?: Uint8Array;
  writeFile?: boolean;
}) {
  let downloadPath = '';
  let call = 0;
  const operation = new Function(
    'request', 'fs', 'os', 'path', 'Buffer', 'cdp', 'drainEvents', 'js',
    `return ${browserDownloadOperationExpression()};`,
  ) as (...args: unknown[]) => Promise<Record<string, unknown>>;
  const result = await operation(
    input.request ?? { expression: 'clickExport()', timeoutMs: 1000, maxBytes: 1024, expectedExtensions: ['.zip'] },
    fs,
    os,
    path,
    Buffer,
    async (_method: string, params: { downloadPath?: string }) => { downloadPath = params.downloadPath ?? downloadPath; },
    async () => input.eventBatches[call++] ?? [],
    async () => {
      if (input.writeFile !== false) {
        await fs.writeFile(path.join(downloadPath, input.fileName ?? 'report.zip'), input.bytes ?? new Uint8Array([1, 2, 3]));
      }
    },
  );
  return { result, downloadPath };
}

describe('Ego supervisor scope and lifecycle', () => {
  test('task spaces isolate workspace and serve instance', () => {
    const base = egoTaskSpaceName('a1b2c3d4', 'codex', '11111111aaaaaaaa');
    expect(egoTaskSpaceName('different', 'codex', '11111111aaaaaaaa')).not.toBe(base);
    expect(egoTaskSpaceName('a1b2c3d4', 'codex', '22222222bbbbbbbb')).not.toBe(base);
  });

  test('one server-owned bridge is prepared once, reused, serialized and closed', async () => {
    const events: string[] = [];
    const supervisor = createEgoBrowserSupervisor({
      taskSpace: 'codument-fixture',
      bridgeFactory: () => ({
        prepare: async () => { events.push('prepare'); },
        request: async () => ({ ok: true, status: 200, statusText: 'OK', url: '', contentType: '', headers: {}, text: '' }),
        evaluate: async (expression: string) => { events.push(expression); return expression; },
        listTabs: async () => [],
        selectTab: async () => ({}),
        navigate: async (url: string) => { events.push(url); return {}; },
        download: async ({ expression }) => {
          events.push(`download:${expression}`);
          return { guid: 'guid-1', suggestedFilename: 'report.zip', fileName: 'report.zip', mimeType: 'application/zip', size: 3, base64: 'AQID' };
        },
        close: async () => { events.push('close'); },
      }),
    });
    await Promise.all([supervisor.evaluate('first'), supervisor.evaluate('second')]);
    await supervisor.navigate('https://www.google.com.hk/');
    const artifact = await supervisor.download({ expression: 'clickExport()', expectedExtensions: ['.zip'] });
    expect(artifact).toMatchObject({ guid: 'guid-1', suggestedFilename: 'report.zip', size: 3 });
    expect([...artifact.bytes]).toEqual([1, 2, 3]);
    await supervisor.close();
    expect(events).toEqual(['prepare', 'first', 'second', 'https://www.google.com.hk/', 'download:clickExport()', 'close']);
    await expect(supervisor.evaluate('after-close')).rejects.toThrow('closed');
  });

  test('correlates one Chromium guid, ignores drained history and cleans the request directory', async () => {
    const { result, downloadPath } = await runDownloadOperation({
      eventBatches: [
        [{ method: 'Page.downloadWillBegin', params: { guid: 'history', suggestedFilename: 'old.zip' } }],
        [
          { method: 'Page.downloadWillBegin', params: { guid: 'guid-1', suggestedFilename: 'report.zip' } },
          { method: 'Page.downloadProgress', params: { guid: 'unrelated', state: 'completed' } },
          { method: 'Page.downloadProgress', params: { guid: 'guid-1', state: 'completed' } },
        ],
      ],
    });
    expect(result).toMatchObject({ guid: 'guid-1', fileName: 'report.zip', size: 3, base64: 'AQID' });
    expect(await fs.stat(downloadPath).then(() => true).catch(() => false)).toBe(false);
  });

  test('fails closed for canceled, ambiguous, wrong-extension and oversized downloads', async () => {
    const base = [{ method: 'Page.downloadWillBegin', params: { guid: 'guid-1', suggestedFilename: 'report.zip' } }];
    await expect(runDownloadOperation({
      eventBatches: [[], [...base, { method: 'Page.downloadProgress', params: { guid: 'guid-1', state: 'canceled' } }]],
    })).rejects.toThrow('canceled');
    await expect(runDownloadOperation({
      eventBatches: [[], [...base, { method: 'Page.downloadWillBegin', params: { guid: 'guid-2', suggestedFilename: 'other.zip' } }]],
    })).rejects.toThrow('Multiple browser downloads');
    await expect(runDownloadOperation({
      eventBatches: [[], [...base, { method: 'Page.downloadProgress', params: { guid: 'guid-1', state: 'completed' } }]],
      request: { expression: 'clickExport()', timeoutMs: 1000, maxBytes: 1024, expectedExtensions: ['.csv'] },
    })).rejects.toThrow('extension');
    await expect(runDownloadOperation({
      eventBatches: [[], [...base, { method: 'Page.downloadProgress', params: { guid: 'guid-1', state: 'completed' } }]],
      bytes: new Uint8Array(5),
      request: { expression: 'clickExport()', timeoutMs: 1000, maxBytes: 4, expectedExtensions: ['.zip'] },
    })).rejects.toThrow('maxBytes');
  });

  test('fails closed for timeout and a completed event without its correlated file', async () => {
    await expect(runDownloadOperation({
      eventBatches: [[], []],
      request: { expression: 'clickExport()', timeoutMs: 1, maxBytes: 1024, expectedExtensions: ['.zip'] },
    })).rejects.toThrow('timed out');
    await expect(runDownloadOperation({
      eventBatches: [[], [
        { method: 'Page.downloadWillBegin', params: { guid: 'guid-1', suggestedFilename: 'report.zip' } },
        { method: 'Page.downloadProgress', params: { guid: 'guid-1', state: 'completed' } },
      ]],
      writeFile: false,
    })).rejects.toThrow('without its correlated file');
  });
});
