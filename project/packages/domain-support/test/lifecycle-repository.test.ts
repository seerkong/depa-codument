import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  archiveMissionState, bindMissionTrack, lifecycleSourceCodec, setLifecycleGapRound, transitionLifecycleResource,
} from 'depa-codument-domain-logic';
import type { LifecycleKind, LifecycleUpdate } from 'depa-codument-domain-contract';
import { createFileLifecycleRepository } from '../src';

const metadata = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const at = '2026-09-05T12:00:00.000Z';
const archiveName = (update: LifecycleUpdate) => String(update.root.attributes?.updated_at).slice(0, 10) + '-' + update.id;
const bindings = { codec: lifecycleSourceCodec, archiveName };
const ref = { kind: 'track' as const, id: 'example' };
const lock = 'codument/.lifecycle-write.lock';

async function fixture(kind: LifecycleKind = 'track', stage = 'pending', extra = '') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-lifecycle-'));
  const directory = `codument/${kind}s/${stage}/example`;
  const file = directory + '/' + kind + '.xnl';
  const tag = kind === 'track' ? 'Track' : 'Mission';
  const status = kind === 'track' ? 'new' : 'pending';
  const source = `<!-- authored 中文 -->\r\n<${tag} #example ${metadata} { status='${status}' } ${extra}><!-- preserve tail -->`;
  await writeResource(root, file, source);
  const spec = { workspaceRoot: root, resourceDirectory: 'codument' };
  return { root, directory, file, source, spec, repo: createFileLifecycleRepository(spec, bindings) };
}

async function writeResource(root: string, file: string, source: string) {
  const directory = path.dirname(path.join(root, file));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(root, file), source);
  for (const required of ['proposal.md', 'design.md']) await fs.writeFile(path.join(directory, required), 'user-owned content');
}
async function exists(file: string) { return fs.lstat(file).then(() => true, (error) => { if (error.code === 'ENOENT') return false; throw error; }); }

describe('production lifecycle repository', () => {
  it('moves an entire resource and patches exact authored bytes without touching companion documents', async () => {
    const test = await fixture();
    const cwd = process.cwd();
    try {
      await fs.chmod(path.join(test.root, test.file), 0o666);
      await fs.mkdir(path.join(test.root, test.directory, 'analysis'));
      await fs.writeFile(path.join(test.root, test.directory, 'analysis/notes'), 'keep');
      const source = await test.repo.load(ref, { includeArchived: false });
      const update = transitionLifecycleResource(source, 'in_progress', at);
      const receipt = await test.repo.commit(source, update);
      expect(receipt).toEqual({ directory: 'codument/tracks/active/example' });
      const written = await fs.readFile(path.join(test.root, receipt.directory, 'track.xnl'), 'utf8');
      expect(written).toBe(lifecycleSourceCodec.patch(test.source, source.root, update.root));
      expect(written.endsWith('><!-- preserve tail -->')).toBe(true);
      expect(written).toContain('\r\n');
      expect((await fs.stat(path.join(test.root, receipt.directory, 'track.xnl'))).mode & 0o777).toBe(0o666);
      expect(await fs.readFile(path.join(test.root, receipt.directory, 'proposal.md'), 'utf8')).toBe('user-owned content');
      expect(await fs.readFile(path.join(test.root, receipt.directory, 'analysis/notes'), 'utf8')).toBe('keep');
      expect(await exists(path.join(test.root, test.directory))).toBe(false);
      expect(await exists(path.join(test.root, lock))).toBe(false);
      expect(process.cwd()).toBe(cwd);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('rejects edited sources, tokens from another instance and modified expected ASTs', async () => {
    const test = await fixture();
    try {
      const source = await test.repo.load(ref, { includeArchived: false });
      const update = setLifecycleGapRound(source, 1, at);
      const second = createFileLifecycleRepository(test.spec, bindings);
      await expect(second.commit(source, update)).rejects.toThrow('source changed');
      const altered = structuredClone(source);
      altered.root.attributes!.status = 'completed';
      await expect(test.repo.commit(altered, update)).rejects.toThrow('source changed');
      await fs.writeFile(path.join(test.root, test.file), test.source + '<!-- concurrent user note -->');
      await expect(test.repo.commit(source, update)).rejects.toThrow('source changed');
      expect(await fs.readFile(path.join(test.root, test.file), 'utf8')).toBe(test.source + '<!-- concurrent user note -->');
      expect(await exists(path.join(test.root, lock))).toBe(false);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('refuses competing process locks without stealing them and reports success separately from cleanup failure', async () => {
    const test = await fixture();
    try {
      const source = await test.repo.load(ref, { includeArchived: false });
      const update = setLifecycleGapRound(source, 1, at);
      await fs.mkdir(path.join(test.root, lock));
      await fs.writeFile(path.join(test.root, lock, 'owner'), 'other process');
      await expect(test.repo.commit(source, update)).rejects.toThrow('lock exists');
      await expect(test.repo.load(ref, { includeArchived: false })).rejects.toThrow('lock exists');
      expect(await fs.readFile(path.join(test.root, lock, 'owner'), 'utf8')).toBe('other process');
      await fs.rm(path.join(test.root, lock), { recursive: true });
      const faulty = createFileLifecycleRepository(test.spec, bindings, {
        ...fs, async rmdir() { throw new Error('injected lock cleanup fault'); },
      });
      const own = await faulty.load(ref, { includeArchived: false });
      const result = await faulty.commit(own, setLifecycleGapRound(own, 1, at));
      expect(result.maintenanceWarnings?.[0]).toContain('committed');
      expect(lifecycleSourceCodec.inspect(await fs.readFile(path.join(test.root, test.file), 'utf8'), 'track').root.attributes!.gap_round).toBe(1);
      expect(await exists(path.join(test.root, lock))).toBe(true);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('serializes two independent repository writers at the filesystem boundary', async () => {
    const test = await fixture();
    try {
      let entered!: () => void;
      let release!: () => void;
      const atRename = new Promise<void>((resolve) => { entered = resolve; });
      const blocked = new Promise<void>((resolve) => { release = resolve; });
      const first = createFileLifecycleRepository(test.spec, bindings, {
        ...fs, async rename(from, to) { entered(); await blocked; await fs.rename(from, to); },
      });
      const second = createFileLifecycleRepository(test.spec, bindings);
      const a = await first.load(ref, { includeArchived: false });
      const b = await second.load(ref, { includeArchived: false });
      const committing = first.commit(a, setLifecycleGapRound(a, 1, at));
      await atRename;
      try { await expect(second.commit(b, setLifecycleGapRound(b, 2, at))).rejects.toThrow('lock exists'); }
      finally { release(); }
      await committing;
      await expect(second.commit(b, setLifecycleGapRound(b, 2, at))).rejects.toThrow('source changed');
      expect((await second.load(ref, { includeArchived: false })).root.attributes!.gap_round).toBe(1);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('rolls the whole directory back when atomic file publication fails', async () => {
    const test = await fixture();
    try {
      const faulty = createFileLifecycleRepository(test.spec, bindings, {
        ...fs, async rename(from, to) { if (from.endsWith('.tmp')) throw new Error('injected publication fault'); await fs.rename(from, to); },
      });
      const source = await faulty.load(ref, { includeArchived: false });
      await expect(faulty.commit(source, transitionLifecycleResource(source, 'in_progress', at))).rejects.toThrow('publication fault');
      expect(await fs.readFile(path.join(test.root, test.file), 'utf8')).toBe(test.source);
      expect((await fs.readdir(path.join(test.root, test.directory))).sort()).toEqual(['design.md', 'proposal.md', 'track.xnl']);
      expect(await exists(path.join(test.root, 'codument/tracks/active/example'))).toBe(false);
      expect(await exists(path.join(test.root, lock))).toBe(false);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('preserves a manual edit observed after the directory moved and before file publication', async () => {
    const test = await fixture();
    try {
      let moved = false;
      const racing = createFileLifecycleRepository(test.spec, bindings, {
        ...fs, async rename(from, to) {
          await fs.rename(from, to);
          if (!moved) {
            moved = true;
            await fs.appendFile(path.join(to, 'track.xnl'), '<!-- concurrent edit -->');
          }
        },
      });
      const source = await racing.load(ref, { includeArchived: false });
      await expect(racing.commit(source, transitionLifecycleResource(source, 'in_progress', at))).rejects.toThrow('source changed before publication');
      expect(await fs.readFile(path.join(test.root, test.file), 'utf8')).toBe(test.source + '<!-- concurrent edit -->');
      expect(await exists(path.join(test.root, lock))).toBe(false);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('honors a lock held by a separate Bun process', async () => {
    const test = await fixture();
    const script = `import * as fs from 'node:fs/promises';
      const lock=${JSON.stringify(path.join(test.root, lock))};
      await fs.mkdir(lock); console.log('locked');
      for await (const _ of Bun.stdin.stream()) { break; }
      await fs.rmdir(lock);`;
    const child = Bun.spawn([process.execPath, '-e', script], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
    try {
      const reader = child.stdout.getReader();
      const signal = await reader.read();
      expect(new TextDecoder().decode(signal.value)).toContain('locked');
      reader.releaseLock();
      await expect(test.repo.load(ref, { includeArchived: false })).rejects.toThrow('lock exists');
      child.stdin.write('release');
      child.stdin.end();
      const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
      expect((await test.repo.load(ref, { includeArchived: false })).id).toBe('example');
    } finally {
      child.kill();
      await child.exited;
      await fs.rm(test.root, { recursive: true, force: true });
    }
  });

  it('retains recovery evidence when directory rollback itself fails', async () => {
    const test = await fixture();
    try {
      let renames = 0;
      const faulty = createFileLifecycleRepository(test.spec, bindings, {
        ...fs, async rename(from, to) { if (++renames > 1) throw new Error('injected filesystem fault'); await fs.rename(from, to); },
      });
      const source = await faulty.load(ref, { includeArchived: false });
      await expect(faulty.commit(source, transitionLifecycleResource(source, 'in_progress', at))).rejects.toThrow('needs recovery');
      expect(await fs.readFile(path.join(test.root, 'codument/tracks/active/example/track.xnl'), 'utf8')).toBe(test.source);
      expect(await exists(path.join(test.root, lock, 'transaction.json'))).toBe(true);
      await expect(test.repo.load(ref, { includeArchived: false })).rejects.toThrow('lock exists');
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('rejects duplicate authority, occupied move destinations, required-file omissions and unsafe paths', async () => {
    const test = await fixture();
    try {
      const source = await test.repo.load(ref, { includeArchived: false });
      await fs.writeFile(path.join(test.root, test.directory, 'track.xml'), '<Track id="example"/>');
      await expect(test.repo.load(ref, { includeArchived: false })).rejects.toThrow('competing lifecycle authority');
      await fs.unlink(path.join(test.root, test.directory, 'track.xml'));
      const target = 'codument/tracks/active/example';
      await fs.mkdir(path.join(test.root, target), { recursive: true });
      await expect(test.repo.commit(source, transitionLifecycleResource(source, 'in_progress', at))).rejects.toThrow('Occupied');
      await writeResource(test.root, target + '/track.xnl', test.source);
      await expect(test.repo.load(ref, { includeArchived: true })).rejects.toThrow('Ambiguous');
      await fs.rm(path.join(test.root, target), { recursive: true });
      await fs.unlink(path.join(test.root, test.directory, 'design.md'));
      await expect(test.repo.load(ref, { includeArchived: false })).rejects.toThrow('required file');
      await expect(test.repo.load({ ...ref, id: '../escape' }, { includeArchived: false })).rejects.toThrow('identity');
      expect(() => createFileLifecycleRepository({ ...test.spec, resourceDirectory: '../other' }, bindings)).toThrow('relative path');
      expect(() => createFileLifecycleRepository({ ...test.spec, workspaceRoot: '.' }, bindings)).toThrow('absolute');
      expect(await fs.readFile(path.join(test.root, test.file), 'utf8')).toBe(test.source);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('rejects symlink authorities, move descendants and old envelopes without writing them', async () => {
    const test = await fixture();
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-symlink-target-'));
    try {
      const source = await test.repo.load(ref, { includeArchived: false });
      await fs.symlink(other, path.join(test.root, test.directory, 'linked-notes'));
      await expect(test.repo.commit(source, transitionLifecycleResource(source, 'in_progress', at))).rejects.toThrow('symlink');
      await fs.unlink(path.join(test.root, test.directory, 'linked-notes'));
      await fs.unlink(path.join(test.root, test.file));
      await fs.writeFile(path.join(other, 'track.xnl'), test.source);
      await fs.symlink(path.join(other, 'track.xnl'), path.join(test.root, test.file));
      await expect(test.repo.load(ref, { includeArchived: false })).rejects.toThrow('symlink');
      await fs.unlink(path.join(test.root, test.file));
      const legacy = test.source.replace(metadata, 'apiVersion="codument/v1" version="1"');
      await fs.writeFile(path.join(test.root, test.file), legacy);
      await expect(test.repo.load(ref, { includeArchived: false })).rejects.toThrow('migration');
      expect(await fs.readFile(path.join(test.root, test.file), 'utf8')).toBe(legacy);
      const invalid = Buffer.concat([Buffer.from(test.source + '<!-- '), Buffer.from([0xff]), Buffer.from(' -->')]);
      await fs.writeFile(path.join(test.root, test.file), invalid);
      await expect(test.repo.load(ref, { includeArchived: false })).rejects.toThrow('UTF-8');
      expect(await fs.readFile(path.join(test.root, test.file))).toEqual(invalid);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); await fs.rm(other, { recursive: true, force: true }); }
  });

  it('finds archived roots by ID and moves a terminal Mission into its date-prefixed archive', async () => {
    const test = await fixture('mission');
    try {
      const mission = { kind: 'mission' as const, id: 'example' };
      await fs.writeFile(path.join(test.root, test.file), test.source.replace("'pending'", "'cancelled'"));
      const source = await test.repo.load(mission, { includeArchived: false });
      const result = await test.repo.commit(source, archiveMissionState(source, at));
      expect(result.directory).toBe('codument/missions/archived/2026-09-05-example');
      await expect(test.repo.load(mission, { includeArchived: false })).rejects.toThrow('no eligible');
      const archived = await test.repo.load(mission, { includeArchived: true });
      expect(archived.root.attributes!.revision).toBe(1);
      const reopened = await test.repo.commit(archived, transitionLifecycleResource(archived, 'active', at));
      expect(reopened.directory).toBe('codument/missions/active/example');
      expect((await test.repo.load(mission, { includeArchived: false })).root.attributes!.revision).toBe(2);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('resolves explicit ProjectRefs and commits portable, append-only binding receipts', async () => {
    const test = await fixture('mission', 'pending', '(<Task #M1 {status="NOT_STARTED"} (<TrackLink #candidate {state="candidate" project_ref="library"}>)> <ProjectRefs [<ProjectRef #library {kind="external"}>]>)');
    const library = await fixture();
    try {
      const spec = { ...test.spec, projects: { library: library.spec } };
      const repo = createFileLifecycleRepository(spec, bindings);
      const mission = { kind: 'mission' as const, id: 'example' };
      await expect(test.repo.resolveTrack('example', { projectRef: 'library', projectKind: 'external' })).rejects.toThrow('not bound');
      const target = await repo.resolveTrack('example', { projectRef: 'library', projectKind: 'external' });
      expect(target).toEqual({ trackId: 'example', projectRef: 'library', authority: library.file });
      const source = await repo.load(mission, { includeArchived: false });
      await repo.commit(source, bindMissionTrack(source, 'M1', target, at), target);
      const report = await fs.readFile(path.join(test.root, test.directory, 'reports/track-bind-cli-001.md'), 'utf8');
      expect(report).toContain('`M1`');
      expect(report).toContain('`' + library.file + '`');
      expect(report).not.toContain(library.root);
      const reloaded = await repo.load(mission, { includeArchived: false });
      await repo.commit(reloaded, bindMissionTrack(reloaded, 'M1', target, at), target);
      expect(await fs.readFile(path.join(test.root, test.directory, 'reports/track-bind-cli-001.md'), 'utf8')).toBe(report);
      expect(await exists(path.join(test.root, test.directory, 'reports/track-bind-cli-002.md'))).toBe(true);
      const latest = await repo.load(mission, { includeArchived: false });
      await fs.rename(path.join(library.root, library.directory), path.join(library.root, path.dirname(library.directory), 'renamed'));
      await expect(repo.commit(latest, bindMissionTrack(latest, 'M1', target, at), target)).rejects.toThrow('authority changed');
      expect(await exists(path.join(test.root, test.directory, 'reports/track-bind-cli-003.md'))).toBe(false);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); await fs.rm(library.root, { recursive: true, force: true }); }
  });

  it('removes only the new binding receipt when resource publication fails', async () => {
    const test = await fixture('mission', 'pending', '(<Task #M1 {status="NOT_STARTED"} (<TrackLink #candidate {state="candidate"}>)>)');
    try {
      await writeResource(test.root, 'codument/tracks/active/example/track.xnl', `<Track #example ${metadata} {status="in_progress"}>`);
      await fs.mkdir(path.join(test.root, test.directory, 'reports'));
      await fs.writeFile(path.join(test.root, test.directory, 'reports/track-bind-cli-001.md'), 'prior evidence');
      const repo = createFileLifecycleRepository(test.spec, bindings, {
        ...fs, async rename() { throw new Error('injected publication fault'); },
      });
      const source = await repo.load({ kind: 'mission', id: 'example' }, { includeArchived: false });
      const target = await repo.resolveTrack('example', { projectKind: 'host' });
      await expect(repo.commit(source, bindMissionTrack(source, 'M1', target, at), target)).rejects.toThrow('publication fault');
      expect(await fs.readFile(path.join(test.root, test.file), 'utf8')).toBe(test.source);
      expect(await fs.readdir(path.join(test.root, test.directory, 'reports'))).toEqual(['track-bind-cli-001.md']);
      expect(await fs.readFile(path.join(test.root, test.directory, 'reports/track-bind-cli-001.md'), 'utf8')).toBe('prior evidence');
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });

  it('binds a host ProjectRef pointing back to the same physical workspace without relocking itself', async () => {
    const test = await fixture('mission', 'pending', '(<Task #M1 {status="NOT_STARTED"} (<TrackLink #candidate {state="candidate" project_ref="self"}>)> <ProjectRefs [<ProjectRef #self {kind="host"}>]>)');
    try {
      await writeResource(test.root, 'codument/tracks/active/example/track.xnl', `<Track #example ${metadata} {status="in_progress"}>`);
      const repo = createFileLifecycleRepository({ ...test.spec, projects: { self: test.spec } }, bindings);
      const source = await repo.load({ kind: 'mission', id: 'example' }, { includeArchived: false });
      const target = await repo.resolveTrack('example', { projectKind: 'host', projectRef: 'self' });
      await repo.commit(source, bindMissionTrack(source, 'M1', target, at), target);
      expect(await exists(path.join(test.root, test.directory, 'reports/track-bind-cli-001.md'))).toBe(true);
      expect(await exists(path.join(test.root, lock))).toBe(false);
    } finally { await fs.rm(test.root, { recursive: true, force: true }); }
  });
});
