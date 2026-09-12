import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CODUMENT_APP_CATALOGS, CODUMENT_APP_DIRECTORIES } from 'depa-codument-domain-contract';
import { inspectCodumentWorkspaceApp, lifecycleSourceCodec, renderCodumentAppManifest } from 'depa-codument-domain-logic';
import { createFileWorkspaceAppSourcePort } from 'depa-codument-domain-support';
import { createCodumentResourceHost } from '../src/resources';
import { createCodumentWorkspaceInspector } from '../src/workspace-app';

const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
test('formal product App membership covers deep canonical registries and archived owners without Kind copies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codument-formal-app-'));
  const host = createCodumentResourceHost(root);
  const source = renderCodumentAppManifest();
  try {
    for (const directory of CODUMENT_APP_DIRECTORIES) await mkdir(join(root, 'codument', directory), { recursive: true });
    await writeFile(join(root, 'codument/manifest.xnl'), source);
    for (const catalog of CODUMENT_APP_CATALOGS.filter(item => !item.recursive)) {
      await writeFile(join(root, 'codument', catalog.root, catalog.entry!), `<${catalog.kind} #codument.config.${catalog.id} ${envelope}>`);
    }
    const owner = 'codument/tracks/archived/2026-09/2026-09-06-1200-example';
    await mkdir(join(root, owner), { recursive: true });
    await writeFile(join(root, owner, 'track.xnl'), `<Track #example ${envelope} {status="completed"}>`);
    for (const file of ['proposal.md', 'design.md']) await writeFile(join(root, owner, file), '# Kept');
    await mkdir(join(root, 'codument/modeling/domain/orders'), { recursive: true });
    await writeFile(join(root, 'codument/modeling/domain/orders/index.xnl'), `<ModelingRegistry #knowledge.orders ${envelope}
      {modeling_schema="data-topology/v1"} [<object #domain.orders.order {kind="entity" semantic_role=["value"] authority_model="immutable_value" relations=[]} (<types ?>type Order = string</?>)>]>`);
    const snapshot = await host.resourceCatalog.snapshot();
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.resources.filter(item => item.kind === 'SkillApp').map(item => item.fqn)).toEqual(['codument.workspace']);
    expect(snapshot.resources.find(item => item.fqn === 'example')?.logicalPath).toBe(owner.slice('codument/'.length) + '/track.xnl');
    expect(snapshot.resources.find(item => item.fqn === 'knowledge.orders')?.logicalPath).toBe('modeling/domain/orders/index.xnl');
    expect(snapshot.resources.every(item => item.sourceRoot === 'codument')).toBe(true);
    expect(snapshot.resources.some(item => item.kind === 'KindDefinition')).toBe(false);
    expect(await readFile(join(root, 'codument/manifest.xnl'), 'utf8')).toBe(source);
    expect(await readdir(root)).toEqual(['codument']);
    expect((await readdir(join(root, 'codument'), { recursive: true })).some(file => file.includes('KindDefinition'))).toBe(false);
    expect(() => renderCodumentAppManifest('escape {')).toThrow();
  } finally { await host.close(); await rm(root, { recursive: true, force: true }); }
});

test('product inspector rejects orphan membership and full knowledge errors even with the feature disabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codument-app-inspection-'));
  const host = createCodumentResourceHost(root);
  try {
    for (const directory of CODUMENT_APP_DIRECTORIES) await mkdir(join(root, 'codument', directory), { recursive: true });
    const source = renderCodumentAppManifest();
    await writeFile(join(root, 'codument/manifest.xnl'), source);
    await writeFile(join(root, 'codument/SKILL.md'), '---\nname: codument\ndescription: Isolated fixture\n---\n# Codument');
    for (const catalog of CODUMENT_APP_CATALOGS.filter(item => !item.recursive)) {
      const body = catalog.kind === 'AttractorProfiles' ? '(<Profiles []>)' : '{enabled=false}';
      await writeFile(join(root, 'codument', catalog.root, catalog.entry!), `<${catalog.kind} #codument.config.${catalog.id} ${envelope} ${body}>`);
    }
    const inspector = createCodumentWorkspaceInspector(root);
    expect(await inspector.inspect()).toMatchObject({ ready: true, appId: 'codument.workspace' });
    const file = 'codument/modeling/domain/orders/index.xnl';
    await mkdir(join(root, 'codument/modeling/domain/orders'), { recursive: true });
    const valid = `<ModelingRegistry #knowledge.orders ${envelope} {modeling_schema="data-topology/v1"} [
      <object #domain.orders.order {kind="entity" semantic_role=["value"] authority_model="immutable_value" relations=[]}
        (<types ?>type Order = string</?>)>
    ]>`;
    await writeFile(join(root, file), valid);
    const complete = await inspector.inspect();
    expect(complete.findings.filter(item => item.severity === 'error')).toEqual([]);
    expect(complete.ready).toBe(true);
    expect(complete.memberFiles).toContain(file);
    const observed = await createFileWorkspaceAppSourcePort(root, lifecycleSourceCodec).observe();
    const resources = await host.resourceCatalog.snapshot();
    const drifted = { ...observed, authorities: observed.authorities.map((item, index) => index ? item : { ...item, digest: 'sha256:changed' }) };
    const drift = inspectCodumentWorkspaceApp({ before: observed, after: drifted, catalog: resources });
    expect(drift.ready).toBe(false);
    expect(drift.findings.some(item => item.rule === 'workspace.drift')).toBe(true);
    expect(drift.findings.some(item => item.rule === 'workspace.source-drift')).toBe(true);
    await writeFile(join(root, 'codument/manifest.xnl'), source.split('\n').filter(line => !line.includes('#modeling {')).join('\n'));
    expect((await host.resourceCatalog.snapshot()).ready).toBe(true);
    const orphan = await inspector.inspect();
    expect(orphan.ready).toBe(false);
    expect(orphan.findings.some(item => item.file === file && item.rule === 'workspace.orphan')).toBe(true);
    await writeFile(join(root, 'codument/manifest.xnl'), source);
    await writeFile(join(root, file), valid.replace('(<types ?>type Order = string</?>)', ''));
    expect((await host.resourceCatalog.snapshot()).ready).toBe(true);
    const invalid = await inspector.inspect();
    expect(invalid.ready).toBe(false);
    expect(invalid.findings.some(item => item.file === file && item.rule.startsWith('knowledge.'))).toBe(true);
    await writeFile(join(root, file), valid);
    await writeFile(join(root, 'codument/decisions/old.xml'), '<decision/>');
    expect((await inspector.inspect()).findings.some(item => item.message.includes('Legacy registry'))).toBe(true);
    expect(await readdir(root)).toEqual(['codument']);
  } finally { await host.close(); await rm(root, { recursive: true, force: true }); }
});
