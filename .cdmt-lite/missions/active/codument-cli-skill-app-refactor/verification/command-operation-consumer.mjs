import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDirectoryResourcePackageReadPort } from 'halfcode-compiler.xnl/resource-core';
import { loadCommandOperations } from 'halfcode-cli-lite-skill-app-support/command-operation';
import { appendCommandOperations } from 'halfcode-cli-lite-skill-app-logic/command-operation';
import { createCommandHost } from 'halfcode-cli-lite-cli-host-capsule';
import { runCli } from 'halfcode-cli-lite-cli-host-shell';
import { pathRoots } from 'halfcode-cli-lite-cli-host-support';

const root = await mkdtemp(join(tmpdir(), 'notes-command-operation-'));
try {
  await mkdir(join(root, 'operations'));
  await writeFile(join(root, 'manifest.xnl'), `<SkillApp #Notes.App envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (
    <Catalogs [<FileResourceCatalog #operations {resourceKind="CommandOperation" root="vfs://./operations/"}>]>
  )>`);
  await writeFile(join(root, 'operations/plan.md'), `---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: CommandOperation
metadata:
  fqn: Notes.CommandOperation.Plan
spec:
  command: plan-note
  description: Plan a note
---

Read the note, plan the revision, then verify evidence.
`);
  const operations = await loadCommandOperations(await createDirectoryResourcePackageReadPort(root), root);
  const commands = appendCommandOperations([], operations, { bin: 'notes', runtimeProfile: 'basic' });
  assert.throws(() => appendCommandOperations(commands, operations, { bin: 'notes', runtimeProfile: 'basic' }), /COLLISION/);
  const created = [], output = [];
  const host = createCommandHost({ identity: { bin: 'notes', displayName: 'Notes', version: '1' }, commands }, {
    createRuntime(root) { created.push(root); return {}; }, disposeRuntime() {},
  });
  try {
    const effects = { roots: pathRoots, output: { write(value) { output.push(value); } } };
    assert.equal(await runCli(host, { args: ['-h'], cwd: root }, effects), 0);
    assert.ok(output.join('\n').includes('plan-note'));
    assert.deepEqual(created, []);
    assert.equal(await runCli(host, { args: ['plan-note', 'example', '--json'], cwd: root }, effects), 0);
    const result = JSON.parse(output.at(-1));
    assert.equal(result.status, 'guidance'); assert.deepEqual(result.arguments, ['example']);
    assert.equal(result.operation.fqn, 'Notes.CommandOperation.Plan');
    assert.ok(result.operation.markdown.includes('verify evidence'));
  } finally { await host.dispose(); }
  console.log(JSON.stringify({ consumer: 'Notes', commandOperation: true, actualHelpAndDispatch: true, copiedKindDefinitions: false, codumentImports: false }));
} finally { await rm(root, { recursive: true, force: true }); }
