import {afterEach, expect, it} from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {commandExecutionPolicy} from '../../src/cli/command-registry';
const roots: string[] = [];
afterEach(async () => {for (const root of roots.splice(0)) await fs.rm(root, {recursive: true, force: true});});
const at = '2026-09-06T10:03:00.000Z';
async function fixture(kind: 'Track' | 'Mission' = 'Track', completed = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-archive-cli-')); roots.push(root);
  const directory = `codument/${kind.toLowerCase()}s/active/work`;
  await fs.mkdir(path.join(root, 'codument'));
  const created = await invoke(root, [kind.toLowerCase(), 'create', 'work', '--stage', 'active']);
  if (created.code !== 0) throw new Error(created.stderr);
  const file = kind.toLowerCase() + '.xnl';
  let source = (await fs.readFile(path.join(root, directory, file), 'utf8')).replace('<SubNodes []>', '<SubNodes [<TaskGroup #G1 {status="DONE"} (<SubNodes [<Task #T1 {status="DONE"}>]>)>]>').replace(/(created_at|updated_at) = "[^"]+"/g, `$1 = "${at}"`);
  if (completed) source = source.replace(/status = "[^"]+"/, 'status = "completed"');
  await fs.writeFile(path.join(root, directory, file), source);
  return {root, directory, source};
}
async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, ...args], {env: {...process.env, TZ: 'UTC'}, stdout: 'pipe', stderr: 'pipe'});
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return {code, stdout, stderr};
}
it('exposes the original root archive command with local-only placement and stable source-date naming', async () => {
  const test = await fixture();
  const result = await invoke(test.root, ['archive', 'work']);
  expect(result.code).toBe(0); expect(result.stderr).toBe('');
  expect(result.stdout).toContain('Destination: codument/tracks/archived/2026-09/2026-09-06-1003-work');
  expect(result.stdout).toContain('✓ Track "work" archived successfully!');
  expect(await fs.readFile(path.join(test.root, 'codument/tracks/archived/2026-09/2026-09-06-1003-work/track.xnl'), 'utf8')).toBe(test.source);
  expect(commandExecutionPolicy(['archive', 'work'])).toEqual({placement: 'local', runtimeProfile: 'domain'});
  expect((await fs.readdir(test.root)).sort()).toEqual(['codument']);
  expect((await fs.readdir(path.join(test.root, 'codument'))).sort()).toEqual(['tracks']);
}, 30_000);
it('requires confirmation and supports -y with JSON receipts', async () => {
  const test = await fixture('Track');
  const result = await invoke(test.root, ['archive', 'work', '-y', '--json']);
  expect(result.code).toBe(0); expect(result.stderr).toBe('');
  const receipt = JSON.parse(result.stdout);
  expect(receipt.kind).toBe('track');
  expect(receipt.directory).toBe('codument/tracks/archived/2026-09/2026-09-06-1003-work');
}, 30_000);
it('binds mission archive and the Mission alias to the same local owner without merging paused commands', async () => {
  for (const group of ['mission', 'Mission']) {
    const test = await fixture('Mission');
    const result = await invoke(test.root, [group, 'archive', 'work', '--json']);
    expect(result.code).toBe(0);
    const receipt = JSON.parse(result.stdout);
    expect(receipt.kind).toBe('mission');
    expect(receipt.directory).toMatch(/^codument\/missions\/archived\/\d{4}-\d{2}-\d{2}-work$/);
    expect(await fs.readFile(path.join(test.root, receipt.directory, 'mission.xnl'), 'utf8')).toContain('archived');
    expect(commandExecutionPolicy([group, 'archive', 'work'])).toEqual({placement: 'local', runtimeProfile: 'domain'});
    expect((await fs.readdir(test.root)).sort()).toEqual(['codument']);
  }
  const test = await fixture('Mission');
  for (const args of [['archive'], ['archive', 'work', 'extra'], ['archive', 'work', '--unknown']]) expect((await invoke(test.root, args)).code).toBe(1);
  expect(commandExecutionPolicy(['init'])).not.toEqual({placement: 'local', runtimeProfile: 'domain'});
}, 30_000);
