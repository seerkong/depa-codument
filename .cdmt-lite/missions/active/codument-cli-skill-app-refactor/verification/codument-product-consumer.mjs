import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createCodumentDomainRuntime, createCodumentDomainHost } from 'depa-codument-product-capsule';
import { createCodumentResourceHost } from 'depa-codument-product-capsule/resources';
import { runCodumentDomainCli } from 'depa-codument-cli-shell';
import { CODUMENT_KIND_CONTRACTS } from 'depa-codument-domain-contract/resources';

const directory = await mkdtemp(join(tmpdir(), 'codument-public-product-'));
const metadata = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const at = '2026-09-06T00:00:00.000Z';
const bindings = { validation: { file: 'fixture/track.xnl' }, clock: { nowIso: () => at }, env: {},
  output: { write() { throw new Error('Query attempted verification subprocess output'); } } };
const beforeCwd = process.cwd();
try {
  const roots = [join(directory, 'one'), join(directory, 'two')];
  const sources = [];
  for (const [index, root] of roots.entries()) {
    const track = join(root, 'codument/tracks/active/example');
    await mkdir(track, { recursive: true });
    const source = `<Track #example ${metadata} {status="in_progress" goal="fixture" description="fixture" created_at="${at}" updated_at="${at}"} (<Ports {scope="track"} []><TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE"} (<SubNodes [<Task #T${index} {name="root-${index}" status="ACTIVE"}>]>)>]>)>)>`;
    await writeFile(join(track, 'track.xnl'), source);
    sources.push(source);
    for (const file of ['proposal.md', 'design.md']) await writeFile(join(track, file), '# User document');
    const text = [];
    const code = await runCodumentDomainCli({ args: ['track', 'ready', 'example'], cwd: root }, {
      roots: { resolve: (input, cwd) => resolve(cwd, input ?? '.') }, output: { write: value => text.push(value) },
    }, () => bindings);
    assert.equal(code, 0, text.join(''));
    assert.match(text.join(''), new RegExp(`T${index}\\tTask\\tACTIVE\\troot-${index}`));
    const host = createCodumentDomainHost(() => bindings);
    try {
      assert.deepEqual(host.commands.map(item => item.name), ['track', 'Track', 'mission', 'Mission', 'decisions', 'project', 'list', 'show', 'behavior-patch', 'BehaviorPatch', 'validate', 'std', 'modeling', 'engineering', 'artifact', 'archive', 'migrate', 'upgrade-resource', 'upgrade-track']);
      for (const paused of ['init', 'status', 'upgrade-workspace']) assert.ok(!host.commands.some(item => item.name === paused));
      const result = await host.dispatch(['Track', 'ready', 'example'], root);
      assert.equal(result.code, 0);
      assert.equal(result.data.ready[0].id, `T${index}`);
      await assert.rejects(host.dispatch(['track', 'ready'], root), /Usage:/);
    } finally { await host.dispose(); }
    const runtime = createCodumentDomainRuntime(root, bindings);
    assert.deepEqual(Object.keys(runtime).sort(), ['close', 'domain', 'domainJson', 'migration', 'migrationGuidance', 'trackMigration']);
    await runtime.close();
    await assert.rejects(runtime.domain.ready('example'), /clos/i);
    assert.equal(await readFile(join(track, 'track.xnl'), 'utf8'), source);
    assert.deepEqual(await readdir(root), ['codument']);
  }
  const root = join(directory, 'catalog');
  await mkdir(join(root, 'codument'), { recursive: true });
  const catalogs = [];
  for (const { kind, owner } of CODUMENT_KIND_CONTRACTS) {
    const folder = join(root, 'codument', kind);
    await mkdir(folder);
    const shape = owner.sourceContract.sourceShapes.includes('directory') ? 'directory' : 'single-file';
    const entry = shape === 'directory' ? kind.toLowerCase() + '.xnl' : 'resource.xnl';
    const fields = kind === 'Track' ? '{status="in_progress"}' : kind === 'Mission' ? '{status="active" revision=1}' : kind === 'ModelingRegistry' ? '{modeling_schema="data-topology/v1"}' : '{}';
    await writeFile(join(folder, entry), `<${kind} #Codument.Fixture.${kind} ${metadata} ${fields}>`);
    for (const file of owner.sourceContract.requiredFiles) await writeFile(join(folder, file), '# Required document');
    catalogs.push(`<Catalog #${kind} {resourceKind="${kind}" shape="${shape}" root="vfs://./${kind}/" entry="${entry}" ${shape === 'directory' ? 'scope="root"' : ''}}>`);
  }
  const manifest = `<SkillApp #Codument.Fixture.App ${metadata} (<Catalogs [${catalogs.join(' ')}]>)>`;
  await writeFile(join(root, 'codument/manifest.xnl'), manifest);
  const resourceHost = createCodumentResourceHost(root);
  try {
    const snapshot = await resourceHost.resourceCatalog.snapshot();
    assert.equal(snapshot.ready, true, JSON.stringify(snapshot.diagnostics));
    for (const { kind } of CODUMENT_KIND_CONTRACTS) assert.equal((await resourceHost.resourceCatalog.list(kind)).length, 1);
    assert.equal(await readFile(join(root, 'codument/manifest.xnl'), 'utf8'), manifest);
    assert.ok(!(await readdir(root, { recursive: true })).some(file => String(file).includes('KindDefinition')));
  } finally { await resourceHost.close(); }
  assert.equal(process.cwd(), beforeCwd);
  console.log(JSON.stringify({ domainReady: true, twoRoots: true, sourceBytesPreserved: true,
    domainOwnedClose: true, builtinKinds: 11, formalDirectory: 'codument', pausedCommandsAbsent: true, serveRequired: false }));
} finally { await rm(directory, { recursive: true, force: true }); }
