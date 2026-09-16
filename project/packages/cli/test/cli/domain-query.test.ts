import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const metadata = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const track = `<!-- keep -->\n<Track #example ${metadata} {status="in_progress" goal="Query" description="Read once" created_at="2026-09-06" updated_at="2026-09-06" commit_mode="manual" unknown={keep=true}} (
<TaskSpace #TS (<SubNodes [<TaskGroup #G1 (<SubNodes [<Task #T1 {status="DONE"}><Task #T2 {status="ACTIVE"}><Task #T3 {status="NOT_STARTED"}><Task #T4 {status="REFUSED"}>]>)>]>)>
)>`;
async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code, stdout, stderr };
}
it('list/show preserve original raw views, explicit content and recursive sources without activating config', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-query-cli-'));
  async function write(file: string, source: string) { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), source); }
  try {
    const absent = await invoke(root, ['list', '--json']);
    expect(absent.code).toBe(1); expect(absent.stdout).toBe(''); expect(absent.stderr).toContain('not initialized');
    await write('codument/config/attractor-profiles.xnl', 'invalid but irrelevant to query');
    expect((await invoke(root, ['list'])).stdout).toBe('No active tracks found.\n');
    const directory = 'codument/tracks/active/example';
    await write(directory + '/track.xnl', track);
    await write(directory + '/proposal.md', 'owned proposal');
    await write('codument/tracks/pending/pending/track.xnl', 'not in active projection');
    const listed = await invoke(root, ['list', '--json']);
    expect(listed.code).toBe(0); expect(listed.stderr).toBe('');
    expect(JSON.parse(listed.stdout)).toEqual([{ id: 'example', metadata: {
      track_id: 'example', track_name: 'Query', goal: 'Query', type: 'feature', status: 'in_progress', commit_mode: 'manual',
      created_at: '2026-09-06', updated_at: '2026-09-06', description: 'Read once',
    }, taskSummary: { total_phases: 1, total_tasks: 4, total_subtasks: 0, total_estimated_days: 0, completed: 1, in_progress: 1, todo: 1, blocked: 1, commit_mode: 'manual' } }]);
    expect((await invoke(root, ['list'])).stdout).toContain('1/4 (25%)');
    const shown = await invoke(root, ['show', 'example', '--json', '--include-content']);
    expect(shown.code).toBe(0);
    expect(JSON.parse(shown.stdout).files).toEqual(['proposal.md', 'track.xnl']);
    expect(JSON.parse(shown.stdout).contents['track.xnl']).toBe(track);
    expect(JSON.parse((await invoke(root, ['show', 'example', '--json'])).stdout)).not.toHaveProperty('contents');
    expect((await invoke(root, ['show', 'example'])).stdout).toContain('  ✗ design.md');
    await write('codument/decisions/nested/forest.xnl', `<decision #parent ${metadata} {status="accepted"} [<decision #child {status="pending" question="Choose?"}>]>`);
    const decision = await invoke(root, ['show', 'decision://child', '--json']);
    expect(decision.code).toBe(0);
    expect(JSON.parse(decision.stdout)).toMatchObject({ id: 'child', uri: 'decision://child', owner_file: 'nested/forest.xnl', status: 'pending', parent: { tag: 'decision', id: 'parent' }, ancestors: [{ tag: 'decision', id: 'parent' }] });
    expect((await invoke(root, ['show', 'decision://child'])).stdout).toContain('  - decision #parent');
    for (const args of [['show', 'missing', '--json'], ['show', '../escape', '--json'], ['show', 'example', '--type', 'unknown'], ['list', '--unknown']]) {
      const invalid = await invoke(root, args); expect(invalid.code).toBe(1); expect(invalid.stdout).toBe('');
    }
    expect(await fs.readFile(path.join(root, directory, 'track.xnl'), 'utf8')).toBe(track);
    expect(await fs.readdir(root)).toEqual(['codument']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);

it('query refuses legacy/ambiguous/symlink authorities instead of reporting a successful partial list', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-query-unsafe-'));
  const directory = path.join(root, 'codument/tracks/active/example');
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'track.xml'), '<Track/>');
    expect((await invoke(root, ['list', '--json'])).code).toBe(1);
    await fs.writeFile(path.join(directory, 'track.xnl'), track);
    expect((await invoke(root, ['list', '--json'])).code).toBe(1);
    await fs.rm(path.join(directory, 'track.xml'));
    await fs.symlink(path.join(directory, 'track.xnl'), path.join(directory, 'proposal.md'));
    const unsafe = await invoke(root, ['show', 'example', '--json', '--include-content']);
    expect(unsafe.code).toBe(1); expect(unsafe.stdout).toBe(''); expect(unsafe.stderr).toContain('symlink');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);
