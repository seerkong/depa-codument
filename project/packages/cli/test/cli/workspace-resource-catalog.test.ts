import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { skillAppKindContract, type SkillAppResourceKind } from 'depa-codument-skill-app-contract/resource';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';

const repositoryRoot = path.resolve(import.meta.dir, '../../../..');
const temporaryRoots = new Set<string>();
const ENVELOPE = 'halfcode.resource-envelope/v1';

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => fs.rm(root, { force: true, recursive: true })));
  temporaryRoots.clear();
});

async function workspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-resolved-catalog-'));
  temporaryRoots.add(root);
  await fs.mkdir(path.join(root, '.agents/skills'), { recursive: true });
  return root;
}

function kindDefinition(kind: SkillAppResourceKind, contractFingerprint?: string): string {
  const descriptor = skillAppKindContract(kind);
  const revision = descriptor.revision;
  return [
    `<KindDefinition #${descriptor.subjectFqn} envelopeVersion="${ENVELOPE}" specVersion=1 {`,
    `  resourceKind = "${kind}"`,
    `  subjectFqn = "${descriptor.subjectFqn}"`,
    `  sourceShapes = [${descriptor.sourceShapes.map((shape) => `"${shape}"`).join(' ')}]`,
    `  documentCardinality = "${descriptor.documentCardinality}"`,
    '} (',
    '  <SpecRevisions [',
    '    <SpecRevision #v1 {',
    '      specVersion = 1',
    `      schemaRef = "${descriptor.schemaRef}"`,
    `      schemaFingerprint = "${revision.schemaFingerprint}"`,
    `      contractFingerprint = "${contractFingerprint ?? revision.contractFingerprint}"`,
    `      semanticValidatorFingerprint = "${revision.semanticContract.semanticValidatorFingerprint}"`,
    `      referenceProjectionFingerprint = "${revision.semanticContract.referenceProjectionFingerprint}"`,
    `      compilerInputFingerprint = "${revision.semanticContract.compilerInputFingerprint}"`,
    `      stability = "${revision.stability}"`,
    '    }>',
    '  ]>',
    ')>',
    '',
  ].join('\n');
}

async function addPagePackage(
  root: string,
  skillId: string,
  packageId: string,
  pageId: string,
  options: Readonly<{ legacyPageEnvelope?: boolean; forgedPageContract?: boolean }> = {},
): Promise<string> {
  const skillRoot = path.join(root, '.agents/skills', skillId);
  const pageName = pageId.split('.').at(-1) ?? 'page';
  await fs.mkdir(path.join(skillRoot, 'KindDefinitions/Page'), { recursive: true });
  await fs.mkdir(path.join(skillRoot, 'KindDefinitions/SkillApp'), { recursive: true });
  await fs.mkdir(path.join(skillRoot, 'Pages', pageName), { recursive: true });
  await fs.writeFile(path.join(skillRoot, 'manifest.xnl'), [
    `<SkillApp #${packageId} envelopeVersion="${ENVELOPE}" specVersion=1 (`,
    '  <Catalogs [',
    '    <Catalog #kind_definitions { kind = "KindDefinition" shape = "directory" root = "vfs://./KindDefinitions/" entry = "manifest.xnl" }>',
    '    <Catalog #pages { kind = "Page" shape = "manifest" root = "vfs://./Pages/" entry = "manifest.xnl" }>',
    '  ]>',
    ')>',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(skillRoot, 'KindDefinitions/SkillApp/manifest.xnl'), kindDefinition('SkillApp'));
  await fs.writeFile(path.join(skillRoot, 'KindDefinitions/Page/manifest.xnl'), kindDefinition(
    'Page',
    options.forgedPageContract ? `sha256:${'f'.repeat(64)}` : undefined,
  ));
  await fs.writeFile(path.join(skillRoot, 'Pages', pageName, 'manifest.xnl'), [
    `<Page #${pageId} ${options.legacyPageEnvelope
      ? 'apiVersion="codument.resources/v1" version="1.0.0"'
      : `envelopeVersion="${ENVELOPE}" specVersion=1`} { name = "${pageName.toLowerCase()}" description = "${skillId} page" }>`,
    '',
  ].join('\n'));
  return skillRoot;
}

describe('Halfcode workspace resource catalog dependency', () => {
  test('pins the portable 0.3.0 compiler package without a path resolution', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'packages/cli/package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies?.['halfcode-compiler.xnl']).toBe('0.3.0');
    expect(manifest.dependencies?.['halfcode-compiler.xnl']).not.toMatch(/^(?:workspace|file|link):/);
  });

  test('exposes the compiler resolution and registry surface', async () => {
    const contracts = await import('halfcode-compiler.xnl/kind-definition');
    expect(contracts.resolveResourceTree).toBeFunction();
    expect(contracts.KindContractRegistry).toBeFunction();
    expect(contracts.CORE_RESOURCE_CONTRACT_REGISTRATIONS.readers).toHaveLength(2);
  });
});

describe('Halfcode workspace resolved resource catalog', () => {
  test('composes packages into a frozen reader-sensitive snapshot', async () => {
    const root = await workspace();
    await addPagePackage(root, 'beta', 'Template.Demo.Package.Beta', 'Template.Demo.Page.Beta');
    await addPagePackage(root, 'alpha', 'Template.Demo.Package.Alpha', 'Template.Demo.Page.Alpha');

    const catalog = createWorkspaceResourceCatalog(root, ['.agents/skills']);
    const snapshot = await catalog.snapshot();
    expect(snapshot.ready).toBe(true);
    expect(snapshot.resources.map((resource) => resource.fqn)).toEqual([
      'Template.Demo.Page.Alpha',
      'Template.Demo.Page.Beta',
      'Template.Demo.Package.Alpha',
      'Template.Demo.Package.Beta',
    ]);
    expect(snapshot.revision).toMatch(/^sha256:/);
    expect(snapshot.contractLock.lockDigest).toMatch(/^sha256:/);
    expect(snapshot.readerProfileId).toBe('cli-host/resource-readers/v1');
    expect(Object.isFrozen(snapshot.resources)).toBe(true);
    expect(await catalog.detail('Template.Demo.Page.Beta')).toMatchObject({
      stage: 'resolved',
      kind: 'Page',
      packageId: 'Template.Demo.Package.Beta',
      sourceRoot: '.agents/skills/beta',
      readerId: 'cli-host.Page.reader/v1',
      readerSpecVersion: 1,
      sourceContentDigest: expect.stringMatching(/^sha256:/),
      effectiveContentDigest: expect.stringMatching(/^sha256:/),
      contentDigest: expect.stringMatching(/^sha256:/),
      resolution: { reader: { implementationFingerprint: expect.stringMatching(/^sha256:/) } },
    });
  });

  test('loads direct and installed sources through one FQN authority', async () => {
    const root = await workspace();
    await addPagePackage(root, 'installed', 'Template.Demo.Package.Installed', 'Template.Demo.Page.Installed');
    const direct = await addPagePackage(root, 'direct-source', 'Template.Demo.Package.Direct', 'Template.Demo.Page.Direct');
    await fs.cp(direct, root, { recursive: true });
    await fs.rm(direct, { recursive: true });
    const catalog = createWorkspaceResourceCatalog(root, [
      { root: '.', scope: 'root', origin: 'workspace' },
      { root: '.agents/skills', scope: 'children', origin: 'installed' },
    ]);
    expect((await catalog.list('Page')).map((resource) => [resource.fqn, resource.sourceOrigin])).toEqual([
      ['Template.Demo.Page.Direct', 'workspace'],
      ['Template.Demo.Page.Installed', 'installed'],
    ]);
  });

  test('fails closed for duplicate FQNs', async () => {
    const root = await workspace();
    await addPagePackage(root, 'first', 'Template.Demo.Package.First', 'Template.Demo.Page.Shared');
    await addPagePackage(root, 'second', 'Template.Demo.Package.Second', 'Template.Demo.Page.Shared');
    const snapshot = await createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'WORKSPACE_RESOURCE_FQN_DUPLICATE' }),
    ]));
  });

  test('ignores JSON-only skills instead of creating fallback authority', async () => {
    const root = await workspace();
    const legacy = path.join(root, '.agents/skills/legacy/pages/example');
    await fs.mkdir(legacy, { recursive: true });
    await fs.writeFile(path.join(legacy, 'page.json'), JSON.stringify({ name: 'legacy' }));
    await expect(createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot()).resolves.toMatchObject({
      ready: true, resources: [], diagnostics: [], revision: null,
    });
  });

  test('fails closed for invalid source, removed fields, and contract drift', async () => {
    const invalidRoot = await workspace();
    const skillRoot = await addPagePackage(invalidRoot, 'broken', 'Template.Demo.Package.Broken', 'Template.Demo.Page.Broken');
    await fs.writeFile(path.join(skillRoot, 'manifest.xnl'), '<SkillApp');
    const invalidCatalog = createWorkspaceResourceCatalog(invalidRoot, ['.agents/skills']);
    const invalid = await invalidCatalog.snapshot();
    expect(invalid).toMatchObject({ ready: false, resources: [] });
    expect(JSON.stringify(invalid.diagnostics)).not.toContain(invalidRoot);
    await expect(invalidCatalog.list()).rejects.toThrow('Workspace resource catalog is invalid');

    const legacyRoot = await workspace();
    await addPagePackage(legacyRoot, 'legacy', 'Template.Demo.Package.Legacy', 'Template.Demo.Page.Legacy', { legacyPageEnvelope: true });
    const legacy = await createWorkspaceResourceCatalog(legacyRoot, ['.agents/skills']).snapshot();
    expect(legacy.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'RESOURCE_METADATA_FIELD_REMOVED' }),
    ]));

    const driftRoot = await workspace();
    await addPagePackage(driftRoot, 'drift', 'Template.Demo.Package.Drift', 'Template.Demo.Page.Drift', { forgedPageContract: true });
    const drift = await createWorkspaceResourceCatalog(driftRoot, ['.agents/skills']).snapshot();
    expect(drift.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'KIND_DEFINITION_REVISION_MISMATCH' }),
    ]));
  });

  test('rejects symlinked skill roots', async () => {
    const root = await workspace();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-xnl-outside-'));
    temporaryRoots.add(outside);
    await addPagePackage(outside, 'real', 'Template.Demo.Package.Real', 'Template.Demo.Page.Real');
    await fs.symlink(path.join(outside, '.agents/skills/real'), path.join(root, '.agents/skills/linked'));
    const snapshot = await createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot();
    expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'WORKSPACE_RESOURCE_SYMLINK_UNSUPPORTED' }),
    ]));
  });
});
