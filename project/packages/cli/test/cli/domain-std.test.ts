import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, 'std', 'lint', ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code, stdout, stderr };
}
it('std lint defaults to global bundled standards and retains explicit directory validation without writes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-std-cli-'));
  const docs = path.join(root, 'src/templates/codument/std');
  try {
    const bundled = await invoke(root, []);
    expect(bundled.code).toBe(0); expect(bundled.stdout).toContain('resource:depa-codument/references/std');
    const absent = await invoke(root, [docs]);
    expect(absent.code).toBe(1); expect(absent.stderr).toContain(`std directory does not exist: ${docs}`);
    await fs.mkdir(docs, { recursive: true });
    for (const file of ['compat/bad.md', 'spec/bad.md', 'operations/migrate.md']) {
      const target = path.join(docs, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, new Uint8Array([255, 254]));
    }
    await fs.writeFile(path.join(docs, 'ignored.MD'), 'std/actions');
    const clean = await invoke(root, [docs]);
    expect(clean).toEqual({ code: 0, stdout: `✓ std lint: no issues in ${docs}\n`, stderr: '' });
    expect((await invoke(root, ['--json'])).stdout).toBe('[]\n');
    const source = 'safe\r\nstd/actions cdt:Task\r\n';
    await fs.writeFile(path.join(docs, 'live.md'), source);
    const dirty = await invoke(root, [docs, '--json']);
    expect(dirty.code).toBe(1); expect(dirty.stderr).toBe('');
    expect(JSON.parse(dirty.stdout).map((item: { line: number; rule: string }) => [item.line, item.rule])).toEqual([[2, 'std.legacy.actions-path'], [2, 'std.legacy.cdt-authoring']]);
    expect((await invoke(root, ['src/templates/codument/std'])).stdout).toStartWith('live.md:2 [std.legacy.actions-path]');
    expect((await invoke(root, [docs, 'extra'])).code).toBe(1);
    expect((await invoke(root, ['--unknown'])).code).toBe(1);
    expect(await fs.readFile(path.join(docs, 'live.md'), 'utf8')).toBe(source);
    expect(await fs.readdir(root)).toEqual(['src']);
    await fs.writeFile(path.join(docs, 'live.md'), new Uint8Array([255]));
    const invalid = await invoke(root, [docs, '--json']);
    expect(invalid.code).toBe(1); expect(invalid.stdout).toBe('');
    await fs.rm(path.join(docs, 'live.md'));
    await fs.symlink(path.join(docs, 'ignored.MD'), path.join(docs, 'live.md'));
    const linked = await invoke(root, [docs, '--json']);
    expect(linked.code).toBe(1); expect(linked.stderr).toContain('symlink');
    expect(linked.stdout).toBe('');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);
