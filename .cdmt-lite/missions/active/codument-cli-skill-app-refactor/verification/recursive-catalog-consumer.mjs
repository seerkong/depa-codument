import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceResourceCatalog } from 'halfcode-cli-lite-skill-app-support/resources/workspace-resource-catalog';
import { createHostResourceContractRuntime } from 'halfcode-cli-lite-skill-app-support/resources/host-resource-contracts';
import { createKindSubjectOwner, createKindSpecRevision, digestCanonical } from 'halfcode-cli-lite-skill-app-contract/resource';

const owner = createKindSubjectOwner({ kind: 'Note', subjectFqn: 'Notes.Kind.Note', ownerPackageId: 'notes-contract',
  ownerPackageFingerprint: digestCanonical('notes/v1'), sourceShapes: ['single-file'] });
const revision = createKindSpecRevision({ kind: owner.kind, subjectFqn: owner.subjectFqn, specVersion: 1,
  sourceContractFingerprint: owner.sourceContract.sourceContractFingerprint, specSchema: { type: 'object' },
  semanticContract: { semanticValidatorFingerprint: digestCanonical('note/v1'), referenceProjectionFingerprint: digestCanonical('note-refs/v1'),
    compilerInputFingerprint: digestCanonical('note-input/v1') }, stability: 'stable' });
const contracts = createHostResourceContractRuntime({ registrations: [{ owners: [owner], revisions: [revision], readers: [{
  readerId: 'notes.reader/v1', subjectFqn: owner.subjectFqn, readerSpecVersion: 1, contractFingerprint: revision.contractFingerprint,
  readerImplementationFingerprint: digestCanonical('reader/v1'), compatibilityPolicy: 'exact', read: spec => spec,
}] }] });

const root = await mkdtemp(join(tmpdir(), 'recursive-public-consumer-'));
try {
  await mkdir(join(root, 'connections/region/team'), { recursive: true });
  const source = `<SkillApp #Notes.App envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Catalogs [
    <FileResourceCatalog #connections { resourceKind="Note" root="vfs://./connections/"
      entry="manifest.xnl" hostTraversal="recursive" }>
  ]>)>`;
  await writeFile(join(root, 'manifest.xnl'), source);
  await writeFile(join(root, 'connections/region/team/manifest.xnl'), `<Note #Notes.Database
    envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 { title="Note" }>`);
  const catalog = createWorkspaceResourceCatalog(root, [{ root: '.', scope: 'root', origin: 'independent-notes' }], contracts);
  const snapshot = await catalog.snapshot();
  assert.equal(snapshot.ready, true, JSON.stringify(snapshot.diagnostics));
  const member = snapshot.resources.find(item => item.fqn === 'Notes.Database');
  assert.ok(member);
  assert.equal(member.logicalPath, 'connections/region/team/manifest.xnl');
  assert.equal(member.loaderProjection, 'host-catalogs/v1');
  assert.equal(await readFile(join(root, 'manifest.xnl'), 'utf8'), source);
  console.log(JSON.stringify({ recursiveCatalog: 'PASS', nonempty: true, physicalSourceUnchanged: true }));
} finally { await rm(root, { recursive: true, force: true }); }
