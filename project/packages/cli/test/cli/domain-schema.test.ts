import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { renderKindSchema } from 'depa-codument-domain-logic';

async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code, stdout, stderr };
}

it('schema prints Kind XNL fragments and rejects unknown kinds without writing files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-schema-cli-'));
  try {
    const printed = await invoke(root, ['schema', 'track']);
    expect(printed.code).toBe(0);
    expect(printed.stderr).toBe('');
    expect(printed.stdout).toBe(renderKindSchema('track'));
    const json = await invoke(root, ['schema', 'decision', '--json']);
    expect(json.code).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ kind: 'decision', schema: renderKindSchema('decision') });
    const unknown = await invoke(root, ['schema', 'behavior']);
    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toContain('schema <track|mission|decision>');
    const missing = await invoke(root, ['schema']);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('schema <track|mission|decision>');
    expect(await fs.readdir(root)).toEqual([]);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);
