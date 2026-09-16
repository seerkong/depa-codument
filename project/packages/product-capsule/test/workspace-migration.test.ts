import { expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCodumentWorkspaceMigrator } from '../src/workspace-migration';
import { createCodumentWorkspaceInspector } from '../src/workspace-app';
import { createCodumentResourceMigrator } from '../src/migration';
import { createCodumentWorkspaceInstallDefinition } from '../src/workspace-install';
import { CODUMENT_WORKSPACE_ASSETS } from '../src/workspace-assets';

const legacy = 'apiVersion="codument.tech/v1alpha1" version=1';
const track = `<Track #example ${legacy} {status="in_progress" goal="Validate" description="Keep checks" created_at="2026-09-06" updated_at="2026-09-06" commit_mode="manual"} (
<Ports {scope="track"} [<MaterialBundle {name="outputs" role="output" domain="docs" path="vfs://./docs/"}>]>
<TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE" child_mode="sequential"} (<SubNodes [<Task #T1 {status="DONE"} (<Acceptance [<Criterion #C1 {checked=true} ?>Check.</?>]>)>]>)>]>)>
<Schedule []><Hooks [<Hook {on="track:after"} [<AttractorCheck {use="custom"}> <GapLoop {max_rounds=3}>]>]>)>`;
async function fixture(run: (root: string, put: (file: string, source: string) => Promise<void>) => Promise<void>) {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'codument-workspace-migration-product-')));
  const put = async (file: string, source: string) => {await fs.mkdir(dirname(join(root, file)), {recursive: true}); await fs.writeFile(join(root, file), source);};
  try {await fs.mkdir(join(root, 'codument')); await run(root, put);} finally {await fs.rm(root, {recursive: true, force: true});}
}

test('whole legacy App upgrades mutually dependent Track and Patch together via real compiler and complete semantic validation', () => fixture(async (root, put) => {
  const owner = 'codument/tracks/active/example';
  await put(owner + '/track.xnl', track);
  await put(owner + '/proposal.md', '# User proposal'); await put(owner + '/design.md', '# User design');
  const profiles = `<AttractorProfiles #profiles ${legacy} (<Profiles [<Profile #custom {enabled=true}>]>)>`;
  await put('codument/config/attractor-profiles.xnl', profiles);
  await put('codument/attractors/product.md', 'My product direction');
  await put('codument/attractors/project.md', 'My reviewed architecture');
  await put('codument/config/cli-tools.json', '{"tools":["codex"],"custom":"keep"}\n');
  // Either individual migration is rejected while its peer still has the old contract.
  expect((await createCodumentResourceMigrator(root).upgrade(owner + '/track.xnl')).status).toBe('review-required');
  const migration = createCodumentWorkspaceMigrator(root), plan = await migration.plan();
  expect(plan.diagnostics).toEqual([]);
  const result = await migration.apply(plan);
  expect(result.diagnostics.every(message => /registry is empty|no 'global' plane/u.test(message))).toBe(true);
  expect(result.status).toBe('applied');
  expect(await fs.readFile(join(result.backupPath!, 'tracks/active/example/track.xnl'), 'utf8')).toBe(track);
  expect(await fs.readFile(join(root, 'codument/attractors/product.md'), 'utf8')).toBe('My product direction');
  expect(await fs.readFile(join(root, 'codument/attractors/project.md'), 'utf8')).toBe('My reviewed architecture');
  expect(await fs.readFile(join(root, 'codument/config/cli-tools.json'), 'utf8')).toBe('{"tools":["codex"],"custom":"keep"}\n');
  expect(await fs.readFile(join(root, owner + '/track.xnl'), 'utf8')).toContain('<AttractorCheck {use="custom"}> <GapLoop {max_rounds=3}>');
  expect(await createCodumentWorkspaceInspector(root).inspect()).toMatchObject({ready: true, appId: 'codument.workspace'});
  expect((await fs.readdir(join(root, 'codument'), {recursive: true})).some(path => path.includes('KindDefinitions'))).toBe(false);
  const inode = (await fs.stat(join(root, owner + '/track.xnl'))).ino;
  expect((await migration.upgrade()).status).toBe('noop');
  expect((await fs.stat(join(root, owner + '/track.xnl'))).ino).toBe(inode);
  // Internal App upgrade has not silently installed/replaced agent commands.
  expect(await fs.stat(join(root, '.agents')).catch(() => undefined)).toBeUndefined();
}));

test('unknown manifests, changed managed guidance and Markdown decisions remain review-required with all originals preserved', async () => {
  for (const [path, source] of [
    ['codument/manifest.xnl', '<ResourcePackage #custom {extension="retain"}>'],
    ['codument/std/operations/impl-track.md', 'Independently edited workflow'],
    ['codument/std/attractors/depa-attractor.md', 'My reviewed architecture'],
    ['codument/tracks/active/old/decisions.md', '# Keep options, answer feedback and evidence'],
    ['codument/std/kinds/KindDefinitions/Custom/manifest.xnl', '<KindDefinition #Custom>'],
  ]) await fixture(async (root, put) => {
    await put(path, source);
    const result = await createCodumentWorkspaceMigrator(root).upgrade();
    expect(result.status).toBe('review-required');
    expect(await fs.readFile(join(root, path), 'utf8')).toBe(source);
    expect(await fs.readFile(join(result.backupPath!, path.slice(9)), 'utf8')).toBe(source);
    expect(await fs.stat(join(root, 'codument/SKILL.md')).catch(() => undefined)).toBeUndefined();
  });
});

test('known standards retire only into a complete backup and configuration refs move to global authority', () => fixture(async (root, put) => {
  const definition = createCodumentWorkspaceInstallDefinition();
  for (const directory of definition.appDirectories) await fs.mkdir(join(root, 'codument', directory), {recursive: true});
  for (const file of definition.appFiles) await put('codument/' + file.path, file.source);
  const standards = CODUMENT_WORKSPACE_ASSETS.filter(asset => asset.path.startsWith('codument/std/'));
  for (const asset of standards) await put(asset.path, asset.source);
  const finder = Buffer.from([0, 1, 0xff, 0x42]);
  await fs.writeFile(join(root, 'codument/std/.DS_Store'), finder);
  const oldConfig = CODUMENT_WORKSPACE_ASSETS.find(asset => asset.path === 'codument/config/attractor-profiles.xnl')!;
  await put(oldConfig.path, oldConfig.source);
  const result = await createCodumentWorkspaceMigrator(root).upgrade();
  expect(result.status, result.diagnostics.join('\n')).toBe('applied');
  expect(await fs.exists(join(root, 'codument/std'))).toBe(false);
  for (const asset of standards) expect(await fs.readFile(join(result.backupPath!, asset.path.slice(9)), 'utf8')).toBe(asset.source);
  expect(await fs.readFile(join(result.backupPath!, 'std/.DS_Store'))).toEqual(finder);
  expect(await fs.readFile(join(root, oldConfig.path), 'utf8')).toContain('skill://depa-codument/references/std/');
  expect((await createCodumentWorkspaceMigrator(root).upgrade()).status).toBe('noop');
}));

test('intermediate global URI layout upgrades to canonical methods without restoring retired folders', () => fixture(async (root,put) => {
  const definition = createCodumentWorkspaceInstallDefinition();
  for (const directory of definition.appDirectories) await fs.mkdir(join(root,'codument',directory),{recursive:true});
  for (const file of definition.appFiles) await put('codument/'+file.path,file.source);
  const file = 'codument/config/attractor-profiles.xnl';
  const broken = (await fs.readFile(join(root,file),'utf8'))
    .replace('references/std/protocols/operation-authoring.md','references/std/operations/_operation-spec.md')
    .replace('编码方向（DEPA 标准架构吸引子 + 项目工程约束）','Example (skill://depa-codument/references/std/operations/_operation-spec.md). Keep xskill://depa-codument/std/not-a-uri.md');
  await put(file,broken);
  const result = await createCodumentWorkspaceMigrator(root).upgrade();
  expect(result.status,result.diagnostics.join('\n')).toBe('applied');
  const actual = await fs.readFile(join(root,file),'utf8');
  expect(actual).not.toContain('std/skill/');
  expect(actual).toContain('references/std/protocols/operation-authoring.md');
  expect(actual).toContain('(skill://depa-codument/references/std/protocols/operation-authoring.md).');
  expect(actual).toContain('xskill://depa-codument/std/not-a-uri.md');
  expect(await fs.readFile(join(result.backupPath!,'config/attractor-profiles.xnl'),'utf8')).toBe(broken);
  expect((await createCodumentWorkspaceMigrator(root).upgrade()).status).toBe('noop');
}));

test('current authored App membership and non-Codument mixed resources are not replaced by installer defaults', () => fixture(async (root, put) => {
  const definition = createCodumentWorkspaceInstallDefinition({appId: 'company.codument'});
  for (const directory of definition.appDirectories) await fs.mkdir(join(root, 'codument', directory), {recursive: true});
  for (const file of definition.appFiles) await put('codument/' + file.path, file.source);
  await put('codument/config/cli-tools.json', '{"tools":["claude"]}\n');
  const manifest = await fs.readFile(join(root, 'codument/manifest.xnl'), 'utf8');
  const result = await createCodumentWorkspaceMigrator(root).upgrade();
  expect(result.status).toBe('noop');
  expect(await fs.readFile(join(root, 'codument/manifest.xnl'), 'utf8')).toBe(manifest);
  expect(await createCodumentWorkspaceInspector(root).inspect()).toMatchObject({ready: true, appId: 'company.codument'});
}));

test('known old Kind definitions leave App discovery only after byte-exact backup', () => fixture(async (root, put) => {
  const path = 'codument/std/kinds/KindDefinitions/Decision/manifest.xnl';
  const source = `<KindDefinition #codument.resource_kind.decision apiVersion="halfcode.resources/v1" version="1.0.0" {
  lifecycle = "Stable"
  resourceKind = "decision"
  sourceShapes = ["single-file"]
  currentApiVersion = "codument.tech/v1alpha1"
  supportedApiVersions = ["codument.tech/v1alpha1"]
  documentCardinality = "many"
  description = "Codument decision tree and forest resource contract"
}>
`;
  await put(path, source);
  const result = await createCodumentWorkspaceMigrator(root).upgrade();
  expect(result.status).toBe('applied');
  expect(await fs.readFile(join(result.backupPath!, path.slice(9)), 'utf8')).toBe(source);
  expect(await fs.stat(join(root, 'codument/std/kinds')).catch(() => undefined)).toBeUndefined();
}));

test('old flat and archive lifecycle directories relocate with all attachments; collisions stay review-required', async () => {
  for (const [from, to] of [
    ['codument/tracks/example', 'codument/tracks/active/example'],
    ['codument/archive/2025-01-01-example', 'codument/tracks/archived/2025-01-01-example'],
  ]) await fixture(async (root, put) => {
    const source = track.replace('status="in_progress"', 'status="completed"').replace('status="ACTIVE"', 'status="DONE"').replace('<Hooks [<Hook {on="track:after"} [<AttractorCheck {use="custom"}> <GapLoop {max_rounds=3}>]>]>', '<Hooks []>');
    await put(from + '/track.xnl', source); await put(from + '/proposal.md', '# Proposal'); await put(from + '/design.md', '# Design');
    await fs.writeFile(join(root, from, 'attachment.bin'), Buffer.from([0xff, 0, 0xfe]));
    const result = await createCodumentWorkspaceMigrator(root).upgrade();
    expect(result.diagnostics.filter(message => !/registry is empty|no 'global' plane/u.test(message))).toEqual([]);
    expect(result.status).toBe('applied');
    expect(await fs.readFile(join(root, to, 'attachment.bin'))).toEqual(Buffer.from([0xff, 0, 0xfe]));
    expect(await fs.stat(join(root, from)).catch(() => undefined)).toBeUndefined();
    expect(await fs.readFile(join(result.backupPath!, from.slice(9), 'track.xnl'), 'utf8')).toBe(source);
  });
  await fixture(async (root, put) => {
    await put('codument/tracks/example/track.xnl', track);
    await put('codument/tracks/active/example/track.xnl', track + '\n<!-- independent -->');
    const result = await createCodumentWorkspaceMigrator(root).upgrade();
    expect(result.status).toBe('review-required');
    expect(result.diagnostics.join('\n')).toContain('collides');
    expect(await fs.readFile(join(root, 'codument/tracks/example/track.xnl'), 'utf8')).toBe(track);
    expect(await fs.readFile(join(root, 'codument/tracks/active/example/track.xnl'), 'utf8')).toBe(track + '\n<!-- independent -->');
  });
});
