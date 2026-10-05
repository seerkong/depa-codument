import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createCodumentDomainCommands } from 'depa-codument-host-adapter';
import { executeCommand, validateCommandTree, validateCommandExecutionPolicies } from 'halfcode-lite-cli-logic';
import { formatCodumentDomainResult } from 'depa-codument-cli-shell';
import { commandExecutionPolicy } from '../../src/cli/command-registry';
import { createCliCommandRuntime } from '../../src/cli/runtime';

const source = `<!-- preserve authored comment -->
<Track #example envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
  status="new" goal="CLI parity" description="Preserve authority" created_at="2026-09-05T12:00:00Z"
  updated_at="2026-09-05T12:00:00Z" question_mode="decision-tree" question_severity="auto" commit_mode="manual"
  custom={keep=[1 true "中文"]}
} (
  <Ports {scope="track"} [<MaterialBundle {name="outputs" role="output" domain="docs" path="vfs://./docs/"}>]>
  <TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE" child_mode="sequential"} (<SubNodes [<Task #T1 {status="NOT_STARTED"}>]>)>]>)>
  <Schedule []><Hooks []>
)>`;
const executable = path.resolve(import.meta.dir, '../../src/cli/index.ts');
async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, executable, '-w', root, ...args], {
    stdout: 'pipe', stderr: 'pipe', env: { ...process.env, CODUMENT_SERVER_INSTANCE_ID: undefined },
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, code };
}

describe('Codument lifecycle command compatibility boundary', () => {
  it('maps each old path and Kind alias through the same owner without acquiring transport', async () => {
    const commands = createCodumentDomainCommands();
    validateCommandTree(commands);
    validateCommandExecutionPolicies(commands);
    const trace: unknown[] = [];
    const receipt = { kind: 'track' as const, id: 'example', from: 'new', to: 'in_progress', directory: 'codument/tracks/active/example' };
    const runtime = { domainJson: true, domain: {
      async apply(input: unknown) { trace.push(input); return receipt; },
      async decisions() { throw new Error('unexpected decisions'); },
      async createDecision() { throw new Error('unexpected create'); },
      async project() { throw new Error('unexpected project'); },
      async query() { throw new Error('unexpected query'); },
      async scaffold() { throw new Error('unexpected scaffold'); },
      async validate() { throw new Error('unexpected validate'); },
      async lintStd() { throw new Error('unexpected std lint'); },
      async knowledge() { throw new Error('unexpected knowledge'); },
      async scaffoldKnowledge() { throw new Error('unexpected knowledge scaffold'); },
      async syncArtifacts() { throw new Error('unexpected artifact sync'); },
      async archive() { throw new Error('unexpected archive'); },
      async ready(track: string) { return { track, ready: [] }; },
      async context() { throw new Error('unexpected context'); },
      async verify() { throw new Error('unexpected verify'); }, async close() {},
    } };
    for (const kind of ['track', 'mission']) for (const name of [kind, kind[0].toUpperCase() + kind.slice(1)]) {
      for (const [args, operation] of [
        [['transition', 'example', 'active'], { type: 'resource-transition', kind, id: 'example', status: 'active' }],
        [['task', 'transition', 'example', 'T1', 'ACTIVE'], { type: 'task-transition', kind, id: 'example', taskId: 'T1', status: 'ACTIVE' }],
        [['gap-round', 'example', '2'], { type: 'gap-round', kind, id: 'example', round: 2 }],
      ] as const) {
        expect(commandExecutionPolicy([name, ...args])).toEqual({ placement: 'local', runtimeProfile: 'domain' });
        const result = await executeCommand(commands, [name, ...args], runtime);
        expect(trace.at(-1)).toEqual(operation);
        expect(formatCodumentDomainResult(result, true)).toBe(JSON.stringify(receipt, null, 2) + '\n');
        expect(formatCodumentDomainResult(result)).toBe(`✓ ${JSON.stringify(receipt)}\n`);
      }
    }
    await executeCommand(commands, ['mission', 'bind-track', 'parent', 'T1', 'child'], runtime);
    expect(trace.at(-1)).toEqual({ type: 'bind-track', kind: 'mission', id: 'parent', taskId: 'T1', trackId: 'child' });
    const command = ['bun', '-e', 'console.log("quoted --json")', '--help', '--json', '-w', 'child root'];
    await executeCommand(commands, ['track', 'task', 'complete', 'example', 'T1', '--fresh', '--', ...command], runtime);
    expect(trace.at(-1)).toEqual({ type: 'task-complete', kind: 'track', id: 'example', taskId: 'T1', command, fresh: true, captureOutput: true });
    const before = trace.length;
    for (const args of [
      ['track', 'transition', 'example'], ['track', 'task', 'complete', 'example', 'T1'],
      ['track', 'task', 'complete', 'example', 'T1', '--'], ['track', 'ready', 'example', '--unknown'],
    ]) await expect(executeCommand(commands, args, runtime)).rejects.toThrow();
    expect(trace).toHaveLength(before);
    expect(commands.map(command => command.name)).toEqual(['track', 'Track', 'mission', 'Mission', 'decisions', 'project', 'list', 'show', 'validate', 'std', 'artifact', 'archive', 'migrate', 'upgrade-resource', 'upgrade-track']);
  });

  it('actual CLI preserves raw JSON, verification argv, source bytes and failed-verifier admission', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-domain-cli-'));
    try {
      const pending = path.join(root, 'codument/tracks/pending/example');
      const active = path.join(root, 'codument/tracks/active/example');
      await fs.mkdir(pending, { recursive: true });
      await fs.writeFile(path.join(pending, 'track.xnl'), source);
      for (const file of ['proposal.md', 'design.md']) await fs.writeFile(path.join(pending, file), 'authored companion');
      const runtime = createCliCommandRuntime(root, { placement: 'local', runtimeProfile: 'domain' });
      expect(runtime.domain).toBeDefined();
      for (const key of ['serveProcess', 'httpFetch', 'httpServer', 'page', 'codex', 'browserProviderFor', 'resourceCatalog']) expect(runtime).not.toHaveProperty(key);
      await runtime.close?.();
      const pendingContext = await invoke(root, ['track', 'context', 'example', '--json']);
      expect(pendingContext.code).toBe(0);
      const observed = JSON.parse(pendingContext.stdout);
      expect(observed.identity.stage).toBe('pending');
      expect(observed.identity.directory).toBe('codument/tracks/pending/example');
      expect(observed.ready[0].id).toBe('T1');
      expect(observed.contract.attributes.custom).toEqual({keep:[1,true,'中文']});
      expect(await fs.readFile(path.join(pending, 'track.xnl'), 'utf8')).toBe(source);
      const moved = await invoke(root, ['track', 'transition', 'example', 'in_progress', '--json']);
      expect(moved.stderr).toBe('');
      expect(moved.code).toBe(0);
      expect(JSON.parse(moved.stdout)).toEqual({ kind: 'track', id: 'example', from: 'new', to: 'in_progress', directory: 'codument/tracks/active/example' });
      const ready = await invoke(root, ['track', 'ready', 'example', '--json']);
      expect(ready.code).toBe(0);
      expect(Object.keys(JSON.parse(ready.stdout)).sort()).toEqual(['ready', 'track']);
      const transitioned = await invoke(root, ['track', 'task', 'transition', 'example', 'T1', 'ACTIVE']);
      expect(transitioned.code).toBe(0);
      expect(transitioned.stdout.startsWith('✓ {')).toBe(true);
      const before = await fs.readFile(path.join(active, 'track.xnl'), 'utf8');
      const failed = await invoke(root, ['track', 'task', 'complete', 'example', 'T1', '--json', '--', process.execPath, '-e', 'console.log("not json"); process.exit(7)']);
      expect(failed.code).toBe(1);
      expect(failed.stdout).toBe('');
      expect(failed.stderr).toContain('Error:');
      expect(await fs.readFile(path.join(active, 'track.xnl'), 'utf8')).toBe(before);
      const command = [process.execPath, '-e', 'console.log("not json")', '--', '--help', '--json', '-w', 'child root'];
      const completed = await invoke(root, ['track', 'task', 'complete', 'example', 'T1', '--json', '--fresh', '--', ...command]);
      expect(completed.code).toBe(0);
      expect(completed.stderr).toBe('not json\n');
      expect(JSON.parse(completed.stdout)).toMatchObject({ id: 'example:T1', to: 'DONE', verification: { command, reused: false, exit_code: 0 } });
      const after = await fs.readFile(path.join(active, 'track.xnl'), 'utf8');
      expect(after).toContain('<!-- preserve authored comment -->');
      expect(after).toContain('custom={keep=[1 true "中文"]}');
      expect(await fs.readFile(path.join(active, 'proposal.md'), 'utf8')).toBe('authored companion');
      expect(await fs.readdir(root)).toEqual(['codument']);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  }, 30_000);

  it('observes current profile authority on each invocation and rejects old or unsafe config', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-domain-profiles-'));
    try {
      const directory = path.join(root, 'codument/tracks/active/example');
      const config = path.join(root, 'codument/config');
      await fs.mkdir(directory, { recursive: true });
      await fs.mkdir(config);
      await fs.writeFile(path.join(directory, 'track.xnl'), source.replace('status="new"', 'status="in_progress"')
        .replace('<Hooks []>', '<Hooks [<Hook {on="track:after"} [<AttractorCheck {use="project"}>]>]>'));
      for (const file of ['proposal.md', 'design.md']) await fs.writeFile(path.join(directory, file), 'keep');
      const absent = await invoke(root, ['track', 'ready', 'example', '--json']);
      expect(absent.code).toBe(1);
      expect(absent.stdout).toBe('');
      expect(absent.stderr).toContain('attractor.profile');
      const profiles = '<AttractorProfiles #codument.config.attractor_profiles envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Profiles [<Profile #project {enabled=true}>]>)>';
      const file = path.join(config, 'attractor-profiles.xnl');
      await fs.writeFile(file, profiles);
      const valid = await invoke(root, ['track', 'ready', 'example', '--json']);
      expect(valid.stderr).toBe('');
      expect(valid.code).toBe(0);
      const withRef = profiles.replace('<Profile #project {enabled=true}>', '<Profile #project {enabled=true} (<Attractors [<Attractor {ref="codument/attractors/project.md"}>]>)>');
      await fs.writeFile(file, withRef);
      const context = await invoke(root, ['track', 'context', 'example', '--json']);
      expect(context.code).toBe(0);
      expect(JSON.parse(context.stdout).attractors).toEqual({ profilesObserved: true, references: [{profile:'project',enabled:true,refs:['codument/attractors/project.md']}] });
      await fs.writeFile(file, withRef.replace('project.md', 'changed.md'));
      const changedContext = await invoke(root, ['track', 'context', 'example', '--json']);
      expect(changedContext.code).toBe(0);
      expect(JSON.parse(changedContext.stdout).requiredSources).toContain('codument/attractors/changed.md');
      expect(JSON.parse(changedContext.stdout).requiredSources).not.toContain('codument/attractors/project.md');
      await fs.writeFile(file, profiles.replace('#project', '#changed'));
      expect((await invoke(root, ['track', 'ready', 'example', '--json'])).code).toBe(1);
      await fs.writeFile(file, profiles.replace('specVersion=1', 'apiVersion="old" version="1"'));
      const old = await invoke(root, ['track', 'ready', 'example', '--json']);
      expect(old.code).toBe(1);
      expect(old.stdout).toBe('');
      expect(old.stderr).toContain('migration');
      expect((await invoke(root, ['track', 'context', 'example', '--json'])).code).toBe(1);
      await fs.rm(file);
      await fs.symlink(path.join(directory, 'track.xnl'), file);
      expect((await invoke(root, ['track', 'ready', 'example', '--json'])).code).toBe(1);
      expect((await invoke(root, ['track', 'context', 'example', '--json'])).code).toBe(1);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  }, 30_000);

  it('decision queries preserve array/error JSON, recurse once and do not acquire lifecycle configuration', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-domain-decisions-'));
    try {
      const registry = path.join(root, 'codument/decisions');
      await fs.mkdir(path.join(registry, 'nested'), { recursive: true });
      await fs.mkdir(path.join(root, 'codument/config'));
      await fs.writeFile(path.join(root, 'codument/config/attractor-profiles.xnl'), 'intentionally invalid and irrelevant');
      const metadata = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
      const policy = `<decision #policy ${metadata} {status="accepted"}>`;
      const child = `<decision #child ${metadata} {status="pending" priority="P0" question="Choose?" depends_on=["decision://policy"]}>`;
      await fs.writeFile(path.join(registry, 'policy.xnl'), policy);
      await fs.writeFile(path.join(registry, 'nested/child.xnl'), child);
      const validated = await invoke(root, ['decisions', 'validate', 'codument/decisions', '--json']);
      expect(validated.stderr).toBe('');
      expect(validated.code).toBe(0);
      expect(JSON.parse(validated.stdout)).toMatchObject([{ file: 'nested/child.xnl', severity: 'warning', decision: 'child' }]);
      const frontier = await invoke(root, ['decisions', 'frontier', 'codument/decisions', '--json']);
      expect(frontier.code).toBe(0);
      expect(JSON.parse(frontier.stdout)).toEqual([{ id: 'child', priority: 'P0', question: 'Choose?', depends_on: ['decision://policy'], source: 'nested/child.xnl' }]);
      expect((await invoke(root, ['decisions', 'frontier', 'codument/decisions'])).stdout).toBe('P0 child: Choose?\n');
      await fs.writeFile(path.join(registry, 'policy.xnl'), policy.replace('status="accepted"', 'status="accepted" depends_on=["child"]'));
      const cycle = await invoke(root, ['decisions', 'frontier', 'codument/decisions', '--json']);
      expect(cycle.code).toBe(1);
      expect(cycle.stderr).toBe('');
      expect(JSON.parse(cycle.stdout).frontier).toEqual([]);
      expect(JSON.parse(cycle.stdout).findings.some((finding: { message: string }) => finding.message.includes('cycle'))).toBe(true);
      const missing = await invoke(root, ['decisions', 'validate', 'missing.xnl', '--json']);
      expect(missing.code).toBe(1);
      expect(JSON.parse(missing.stdout)).toEqual([{ file: 'missing.xnl', decision: '(file)', severity: 'error', message: 'decisions file not found' }]);
      expect(await fs.readFile(path.join(registry, 'nested/child.xnl'), 'utf8')).toBe(child);
      expect(await fs.readdir(root)).toEqual(['codument']);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  }, 30_000);

  it('creates top-level and nested decisions through the same source-preserving owner', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-domain-create-'));
    try {
      const target = 'codument/decisions/forest.xnl';
      const first = await invoke(root, ['decisions', 'create', target, 'root', '--json']);
      expect(first.stderr).toBe('');
      expect(first.code).toBe(0);
      expect(JSON.parse(first.stdout)).toMatchObject({ id: 'root', specVersion: 1 });
      const file = path.join(root, target);
      const before = '<!-- user header -->\r\n' + await fs.readFile(file, 'utf8');
      await fs.writeFile(file, before);
      const child = await invoke(root, ['decisions', 'create', target, 'child', '--parent', 'root']);
      expect(child.stderr).toBe('');
      expect(child.code).toBe(0);
      expect(child.stdout).toBe(`Decision 'child' created in ${target} under 'root'\n  specVersion: 1\n`);
      const after = await fs.readFile(file, 'utf8');
      expect(after.startsWith('<!-- user header -->\r\n')).toBe(true);
      expect(after).toContain('<decision #child {');
      const validate = await invoke(root, ['decisions', 'validate', target, '--json']);
      expect(validate.code).toBe(0);
      expect(JSON.parse(validate.stdout).every((finding: {severity: string}) => finding.severity === 'warning')).toBe(true);
      const duplicate = await invoke(root, ['decisions', 'create', target, 'child', '--json']);
      expect(duplicate.code).toBe(1);
      expect(duplicate.stdout).toBe('');
      expect(duplicate.stderr).toContain('already exists');
      expect(await fs.readFile(file, 'utf8')).toBe(after);
      expect(await fs.readdir(path.dirname(file))).toEqual(['forest.xnl']);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  }, 30_000);

  it('resolves real external ProjectRefs using each workspace profile authority and portable receipts', async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-projectref-cli-'));
    const root = path.join(temporary, 'host'), library = path.join(temporary, 'library');
    try {
      const target = path.join(library, 'codument/tracks/active/example');
      const mission = path.join(root, 'codument/missions/active/parent');
      for (const directory of [target, mission]) {
        await fs.mkdir(directory, { recursive: true });
        for (const file of ['proposal.md', 'design.md']) await fs.writeFile(path.join(directory, file), 'owned content');
      }
      const libraryTrack = source.replace('status="new"', 'status="in_progress"')
        .replace('<Hooks []>', '<Hooks [<Hook {on="track:after"} [<AttractorCheck {use="library-only"}>]>]>');
      await fs.writeFile(path.join(target, 'track.xnl'), libraryTrack);
      await fs.mkdir(path.join(library, 'codument/config'));
      await fs.writeFile(path.join(library, 'codument/config/attractor-profiles.xnl'),
        '<AttractorProfiles #profiles envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Profiles [<Profile #library-only {enabled=true}>]>)>');
      expect((await invoke(root, ['project', 'bindings'])).stdout).toBe('');
      const binding = await invoke(root, ['project', 'bind', 'library', '../library']);
      expect(binding.code).toBe(0);
      expect(binding.stdout).toBe(`ProjectRef 'library' bound locally to ${library}\n`);
      const listed = await invoke(root, ['project', 'bindings', '--json']);
      expect(listed.code).toBe(0);
      expect(JSON.parse(listed.stdout)).toEqual([{ projectRef: 'library', workspacePath: library }]);
      const bindings = await fs.readFile(path.join(root, 'codument/.local/workspace-bindings.xnl'), 'utf8');
      const actors = ['MissionPlanner', 'MissionObserver', 'MissionReconciler', 'MissionApplier'];
      await fs.writeFile(path.join(mission, 'mission.xnl'), `<Mission #parent envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
        status="active" revision=1 goal="Cross workspace" description="Bind target" created_at="2026-09-05T12:00:00Z" updated_at="2026-09-05T12:00:00Z"
      } (
        <ProjectRefs [<ProjectRef #host {kind="host"}><ProjectRef #library {kind="external"}>]>
        <ActorSets {default="loop"} [<ActorSet #loop [${actors.map(role => `<Actor {role="${role}" project_ref="host"} (<Description ?>Work.</?>)>`).join('')}]>]>
        <TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE" child_mode="sequential" actor_set="loop"} (<SubNodes [
          <Task #T1 {status="ACTIVE"} (<TrackLink #candidate {state="candidate" project_ref="library"}>)>
        ]>)>]>)>
        <Schedule []><Hooks []>
      )>`);
      const bound = await invoke(root, ['mission', 'bind-track', 'parent', 'T1', 'example', '--json']);
      expect(bound.stderr).toBe('');
      expect(bound.code).toBe(0);
      expect(JSON.parse(bound.stdout).directory).toBe('codument/missions/active/parent');
      const authored = await fs.readFile(path.join(mission, 'mission.xnl'), 'utf8');
      expect(authored).toContain('#example');
      expect(authored).not.toContain(library);
      expect(await fs.readFile(path.join(target, 'track.xnl'), 'utf8')).toBe(libraryTrack);
      expect(await fs.readFile(path.join(root, 'codument/.local/workspace-bindings.xnl'), 'utf8')).toBe(bindings);
      const reports = await fs.readdir(path.join(mission, 'reports'));
      expect(reports).toEqual(['track-bind-cli-001.md']);
      expect(await fs.readFile(path.join(mission, 'reports', reports[0]), 'utf8')).not.toContain(library);
      const unbound = await invoke(root, ['project', 'unbind', 'library']);
      expect(unbound.code).toBe(0);
      expect(unbound.stdout).toBe("ProjectRef 'library' unbound locally\n");
      expect((await invoke(root, ['project', 'bindings'])).stdout).toBe('');
      expect((await invoke(root, ['mission', 'bind-track', 'parent', 'T1', 'example', '--json'])).code).toBe(1);
      expect(await fs.readFile(path.join(mission, 'mission.xnl'), 'utf8')).toBe(authored);
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
  }, 30_000);

  it('rejects context changes made during verification instead of committing under stale bindings', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-context-cas-'));
    try {
      const directory = path.join(root, 'codument/tracks/active/example');
      await fs.mkdir(directory, { recursive: true });
      await fs.mkdir(path.join(root, 'codument/.local'));
      const file = path.join(directory, 'track.xnl');
      const before = source.replace('status="new"', 'status="in_progress"').replace('status="NOT_STARTED"', 'status="ACTIVE"');
      await fs.writeFile(file, before);
      for (const companion of ['proposal.md', 'design.md']) await fs.writeFile(path.join(directory, companion), 'keep');
      const command = [process.execPath, '-e', 'await Bun.write("codument/.local/workspace-bindings.xnl", "<WorkspaceBindings []>")'];
      const changed = await invoke(root, ['track', 'task', 'complete', 'example', 'T1', '--fresh', '--json', '--', ...command]);
      expect(changed.code).toBe(1);
      expect(changed.stdout).toBe('');
      expect(changed.stderr).toContain('context sources changed');
      expect(await fs.readFile(file, 'utf8')).toBe(before);
      expect(await fs.readFile(path.join(root, 'codument/.local/workspace-bindings.xnl'), 'utf8')).toBe('<WorkspaceBindings []>');
      expect(await fs.readdir(path.join(root, 'codument'))).not.toContain('.lifecycle-write.lock');
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  }, 30_000);
});
