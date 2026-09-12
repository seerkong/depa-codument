import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { planResourceMigration } from '../../../domain-logic/src/migration';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const track = `<Track #example ${envelope} {status="in_progress" goal="Validate" description="Preserve" created_at="2026-09-06" updated_at="2026-09-06" commit_mode="manual"} (
<Ports {scope="track"} [<MaterialBundle {name="docs" role="output" domain="docs" path="vfs://./docs/"}>]>
<TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE" child_mode="sequential"} (<SubNodes [<Task #T1 {status="DONE"} (<Acceptance [<Criterion #C1 {checked=false} ?>Keep gate</?>]>)>]>)>]>)>
<Schedule []><Hooks []>)>`;
const patch = `<BehaviorPatch #track.example.behavior_patch.cli ${envelope} {capability="cli"} (<Mutations [<Delete {selector="behavior://cli/requirements/old"}>]>)>`;
async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code, stdout, stderr };
}
function findings(stdout: string): { file: string; severity: string; rule: string }[] {
  // This intentionally asserts the historical mixed text + final JSON protocol.
  const start = stdout.lastIndexOf('\n[');
  expect(start).toBeGreaterThanOrEqual(0);
  return JSON.parse(stdout.slice(start + 1));
}
it('historical completion is visible in real CLI validation and show, never an unqualified current PASS', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-history-cli-'));
  const directory = 'codument/tracks/archived/2026-01/example', file = directory + '/track.xnl';
  try {
    await fs.mkdir(path.join(root, directory, 'behavior_deltas'), { recursive: true });
    const legacy = track.replace(envelope, 'apiVersion="codument.tech/v1alpha1"')
      .replace('status="in_progress"', 'status="completed"').replace('status="ACTIVE"', 'status="DONE"').replace('checked=false', '');
    const plan = planResourceMigration({ path: file, source: legacy });
    expect(plan.status).toBe('planned');
    await fs.writeFile(path.join(root, file), plan.proposal!.source!);
    for (const name of ['proposal.md', 'design.md']) await fs.writeFile(path.join(root, directory, name), 'Original material');
    await fs.writeFile(path.join(root, directory, 'behavior_deltas/delta.xnl'), patch);
    const result = await invoke(root, ['validate', 'archived/2026-01/example', '--strict', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('NOT reverified');
    expect(result.stdout).not.toContain('✓ example');
    expect(findings(result.stdout)).toContainEqual(expect.objectContaining({ rule: 'track.history.not-reverified', severity: 'notice' }));
    const shown = await invoke(root, ['show', 'archived/2026-01/example', '--json']);
    expect(shown.code, shown.stdout + shown.stderr).toBe(0);
    expect(shown.stdout).toContain('not-reverified');
    expect((await invoke(root, ['validate', 'archived/missing', '--strict'])).code).toBe(1);
    expect((await invoke(root, ['show', 'archived/../active/example'])).code).not.toBe(0);
    expect((await invoke(root, ['validate'])).stdout).toBe('No tracks or missions to validate.\n');
    expect(await fs.readFile(path.join(root, file), 'utf8')).toBe(plan.proposal!.source!);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);
it('validates complete process closures and preserves strict severity, text/JSON ordering and original sources', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-validate-cli-'));
  async function write(file: string, content: string) { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), content); }
  try {
    expect((await invoke(root, ['validate'])).code).toBe(1);
    await fs.mkdir(path.join(root, 'codument'));
    expect((await invoke(root, ['validate', '--json'])).stdout).toBe('No tracks or missions to validate.\n');
    const directory = 'codument/tracks/active/example';
    await write(directory + '/track.xnl', track);
    for (const file of ['proposal.md', 'design.md']) await write(directory + '/' + file, 'keep');
    await write(directory + '/behavior_deltas/nested/delta.xnl', patch);
    const decision = `<decision #same ${envelope} {status="accepted"}>`;
    await write(directory + '/decisions.xnl', decision);
    await write(directory + '/analysis/decision-tree.xnl', decision);
    const normal = await invoke(root, ['validate', 'example', '--json']);
    expect(normal.code).toBe(0); expect(normal.stderr).toBe('');
    expect(normal.stdout).toStartWith('✓ example: track.xnl OK + 1 behavior delta(s) (1 warning)\n');
    expect(findings(normal.stdout).map(finding => [finding.rule, finding.severity])).toEqual([['track.lifecycle.done-criterion', 'warning']]);
    const strict = await invoke(root, ['validate', 'example', '--strict', '--json']);
    expect(strict.code).toBe(1); expect(findings(strict.stdout)[0].severity).toBe('error');
    await fs.rm(path.join(root, directory, 'design.md'));
    const missing = await invoke(root, ['validate', 'example', '--json']);
    expect(missing.code).toBe(1); expect(findings(missing.stdout).map(finding => finding.rule)).toContain('track.required-file');
    await write(directory + '/design.md', 'keep');
    await write(directory + '/behavior_deltas/nested/delta.xnl', patch.replace('<Delete {selector="behavior://cli/requirements/old"}>', ''));
    const emptyPatch = await invoke(root, ['validate', 'example', '--json']);
    expect(emptyPatch.code).toBe(1); expect(findings(emptyPatch.stdout).map(finding => finding.rule)).toContain('behavior.patch.mutations');
    await write(directory + '/behavior_deltas/nested/delta.xnl', patch);
    await write(directory + '/analysis/decision-tree.xnl', '<decision #old>');
    expect((await invoke(root, ['validate', 'example', '--json'])).code).toBe(1);
    await write(directory + '/analysis/decision-tree.xnl', decision);
    await write('codument/behaviors/nested/feature.xnl', `<Behavior #feature ${envelope} (<Requirements [<Requirement #R1 (<Statement ?>Keep</?>)>]>)>`);
    const behavior = await invoke(root, ['validate', 'nested/feature', '--json']);
    expect(behavior.code).toBe(0); expect(findings(behavior.stdout)).toEqual([]);
    const created = await invoke(root, ['mission', 'create', 'unfinished', '--stage', 'pending']);
    expect(created.code).toBe(0);
    const draft = await invoke(root, ['validate', 'unfinished', '--json']);
    expect(draft.code).toBe(1); expect(findings(draft.stdout).map(finding => finding.rule)).toContain('mission.taskspace.phase-missing');
    expect(await fs.readFile(path.join(root, directory, 'track.xnl'), 'utf8')).toBe(track);
    expect(await fs.readdir(root)).toEqual(['codument']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);
it('validation reports malformed, historical, unsafe and invalid UTF-8 sources as errors, never partial PASS', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-validate-unsafe-'));
  const directory = path.join(root, 'codument/tracks/pending/unsafe');
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'track.xml'), '<Track/>');
    let result = await invoke(root, ['validate', '--json']);
    expect(result.code).toBe(1); expect(findings(result.stdout).map(finding => finding.rule)).toContain('track.kind');
    await fs.rm(path.join(directory, 'track.xml'));
    await fs.writeFile(path.join(directory, 'track.xnl'), new Uint8Array([255, 254]));
    result = await invoke(root, ['validate', '--json']);
    expect(result.code).toBe(1); expect(findings(result.stdout).map(finding => finding.rule)).toContain('source.read');
    await fs.rm(path.join(directory, 'track.xnl'));
    await fs.writeFile(path.join(directory, 'actual.xnl'), track);
    await fs.symlink(path.join(directory, 'actual.xnl'), path.join(directory, 'track.xnl'));
    result = await invoke(root, ['validate', '--json']);
    expect(result.code).toBe(1); expect(result.stdout).toContain('symlink');
    expect(await fs.readFile(path.join(directory, 'actual.xnl'), 'utf8')).toBe(track);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);
