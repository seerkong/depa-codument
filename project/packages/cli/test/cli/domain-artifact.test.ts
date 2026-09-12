import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { commandExecutionPolicy } from '../../src/cli/command-registry';
async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, ...args], {stdout: 'pipe', stderr: 'pipe'});
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return {code, stdout, stderr};
}
it('artifact sync preserves real CLI JSON/text and exit 2 conflicts without initializing a workspace or Serve', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-artifact-cli-'));
  const args = ['artifact', 'sync', '--source', 'source', '--target', 'target'];
  try {
    await fs.mkdir(path.join(root, 'source')); await fs.mkdir(path.join(root, 'target'));
    await fs.writeFile(path.join(root, 'source/guide.md'), 'new\n'); await fs.writeFile(path.join(root, 'target/guide.md'), 'old\n');
    const details = {source: path.join(root, 'source'), target: path.join(root, 'target'), changes: [{path: 'guide.md', status: 'update'}]};
    const dryRun = await invoke(root, [...args, '--dry-run', '--json']);
    expect(dryRun).toEqual({code: 0, stdout: JSON.stringify({status: 'dry-run', ...details}, null, 2) + '\n', stderr: ''});
    const conflict = await invoke(root, [...args, '--json']);
    expect(conflict).toEqual({code: 2, stdout: JSON.stringify({status: 'conflict', ...details}, null, 2) + '\n', stderr: ''});
    expect(await fs.readFile(path.join(root, 'target/guide.md'), 'utf8')).toBe('old\n');
    const delivered = await invoke(root, [...args, '--force']);
    expect(delivered).toEqual({code: 0, stdout: `artifact sync: ${JSON.stringify({status: 'synced', ...details})}\n`, stderr: ''});
    expect(await fs.readFile(path.join(root, 'target/guide.md'), 'utf8')).toBe('new\n');
    expect(JSON.parse((await invoke(root, [...args, '--json'])).stdout).changes).toEqual([{path: 'guide.md', status: 'unchanged'}]);
    expect((await invoke(root, [...args, '--target', 'source'])).code).toBe(1);
    for (const invalid of [['artifact', 'sync'], [...args, 'unexpected'], [...args, '--unknown']]) expect((await invoke(root, invalid)).code).toBe(1);
    expect((await fs.readdir(root)).sort()).toEqual(['source', 'target']);
    expect(commandExecutionPolicy(args)).toEqual({placement: 'local', runtimeProfile: 'domain-registry'});
  } finally {await fs.rm(root, {recursive: true, force: true});}
}, 30_000);
