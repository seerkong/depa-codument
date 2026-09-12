import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code, stdout, stderr };
}
it('actual creation commands publish only codument resource skeletons with aliases, stage and no-clobber semantics', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-scaffold-cli-'));
  try {
    expect((await invoke(root, ['track', 'create', 'example', '--stage', 'pending'])).code).toBe(1);
    await fs.mkdir(path.join(root, 'codument/config'), { recursive: true });
    await fs.writeFile(path.join(root, 'codument/config/attractor-profiles.xnl'), 'irrelevant during scaffold');
    for (const [command, id, stage, kind] of [
      ['track', 'pending-track', 'pending', 'Track'], ['Track', 'active-track', 'active', 'Track'],
      ['mission', 'pending-mission', 'pending', 'Mission'], ['Mission', 'active-mission', 'active', 'Mission'],
    ]) {
      const created = await invoke(root, [command, 'create', id, '--stage', stage, '--json']);
      expect(created.stderr).toBe(''); expect(created.code).toBe(0);
      const receipt = JSON.parse(created.stdout);
      expect(receipt).toMatchObject({ kind, id, stage, specVersion: 1, directory: `codument/${kind.toLowerCase()}s/${stage}/${id}` });
      expect(receipt.files).toEqual([kind.toLowerCase() + '.xnl', 'proposal.md', 'design.md']);
      const file = path.join(root, receipt.directory, kind.toLowerCase() + '.xnl');
      const source = await fs.readFile(file, 'utf8');
      expect(source).toContain('envelopeVersion="halfcode.resource-envelope/v1"');
      expect(source).toContain('<SubNodes []>');
      expect(source).not.toContain('apiVersion');
      expect((await invoke(root, [command, 'create', id, '--stage', stage, '--json'])).code).toBe(1);
      expect(await fs.readFile(file, 'utf8')).toBe(source);
    }
    const patch = await invoke(root, ['behavior-patch', 'create', 'pending-track', 'auth.login']);
    expect(patch.stderr).toBe(''); expect(patch.code).toBe(0);
    expect(patch.stdout).toContain("BehaviorPatch 'auth.login' created for Track 'pending-track'");
    expect(patch.stdout).toContain('  specVersion: 1');
    const alias = await invoke(root, ['BehaviorPatch', 'create', 'active-track', 'api', '--json']);
    expect(alias.code).toBe(0); expect(JSON.parse(alias.stdout).files).toEqual(['delta.xnl']);
    const source = await fs.readFile(path.join(root, 'codument/tracks/pending/pending-track/behavior_deltas/auth.login/delta.xnl'), 'utf8');
    expect(source).toContain('#track.pending-track.behavior_patch.auth.login');
    expect(source).toContain('<Mutations []>');
    for (const args of [['track', 'create', '../outside', '--stage', 'pending'], ['track', 'create', 'valid'], ['mission', 'create', 'valid', '--stage', 'archived'], ['behavior-patch', 'create', 'pending-track', '../outside']]) {
      const invalid = await invoke(root, [...args, '--json']); expect(invalid.code).toBe(1); expect(invalid.stdout).toBe('');
    }
    await fs.rm(path.join(root, 'codument/config/attractor-profiles.xnl'));
    const draft = await invoke(root, ['track', 'ready', 'active-track', '--json']);
    expect(draft.code).toBe(1); expect(draft.stderr).toContain('phase-missing');
    expect((await fs.readdir(path.join(root, 'codument'))).sort()).toEqual(['config', 'missions', 'tracks']);
    expect(await fs.readdir(root)).toEqual(['codument']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);
