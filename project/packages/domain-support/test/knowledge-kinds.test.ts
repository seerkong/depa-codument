import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS, type CodumentResourceView } from 'depa-codument-domain-contract/resources';
import { CODUMENT_RESOURCE_READER_REGISTRATIONS } from 'depa-codument-domain-logic/resources';
import { createHostResourceContractRuntime } from 'halfcode-cli-lite-skill-app-support/resources/host-resource-contracts';
import { createWorkspaceResourceCatalog } from 'halfcode-cli-lite-skill-app-support/resources/workspace-resource-catalog';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
it('actual compiler admits both knowledge owners and exposes recursive member paths with enclosing source provenance', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-knowledge-kind-'));
  const contracts = createHostResourceContractRuntime({ registrations: [CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS, CODUMENT_RESOURCE_READER_REGISTRATIONS] });
  try {
    await fs.mkdir(path.join(root, 'modeling/domain/orders'), { recursive: true });
    await fs.mkdir(path.join(root, 'engineering/global/overview'), { recursive: true });
    const shallowManifest = `<SkillApp #Knowledge.App ${envelope} (<Catalogs [
      <Catalog #modeling {resourceKind="ModelingRegistry" root="vfs://./modeling/" shape="single-file"}>
      <Catalog #engineering {resourceKind="EngineeringRegistry" root="vfs://./engineering/" shape="single-file"}>
    ]>)>`;
    await fs.writeFile(path.join(root, 'manifest.xnl'), shallowManifest);
    const source = `<!-- keep owner -->\n<ModelingRegistry #knowledge.orders ${envelope} {modeling_schema="data-topology/v1"} [
      <object #domain.orders.order {kind="entity" semantic_role=["project_custom" "value"] authority_model="immutable_value" relations=[] unknown={preserve=true}} (
        <types ?>type Order = string</?>
        <children [<object #domain.orders.item {kind="object" source="modeling://domain/orders/order"} (<types ?>type Item = string</?>)>]>
      )>
    ]>`;
    const file = path.join(root, 'modeling/domain/orders/index.xnl');
    await fs.writeFile(file, source);
    await fs.writeFile(path.join(root, 'engineering/global/overview/project.xnl'), `<EngineeringRegistry #knowledge.project ${envelope} [<overview #global.overview.project.layout {kind="overview"} (<desc ?>Project</?><mental-model ?>Knowledge</?>)>]>`);
    const catalog = createWorkspaceResourceCatalog(root, [{root: '.', scope: 'root', origin: 'test'}], contracts);
    // Native compiler catalogs remain shallow; recursion is explicit Host input.
    expect((await catalog.list('ModelingRegistry'))).toHaveLength(0);
    const manifest = shallowManifest.replaceAll('shape="single-file"', 'shape="single-file" hostTraversal="recursive" hostExtensions=[".xnl"]');
    await fs.writeFile(path.join(root, 'manifest.xnl'), manifest);
    const snapshot = await catalog.snapshot();
    expect(snapshot.diagnostics).toEqual([]); expect(snapshot.ready).toBe(true);
    const rows = await catalog.list('ModelingRegistry');
    expect(rows).toHaveLength(1);
    expect(rows[0].loaderProjection).toBe('host-catalogs/v1');
    expect(await fs.readFile(path.join(root, 'manifest.xnl'), 'utf8')).toBe(manifest);
    const view = rows[0].readerValue as CodumentResourceView;
    expect(view.knowledge?.members.map(member => member.id)).toEqual(['domain.orders.order', 'domain.orders.item']);
    const child = view.knowledge!.members[1];
    expect(child.parentId).toBe('domain.orders.order');
    expect(child.ancestorIds).toEqual(['domain.orders.order']);
    expect(child.references).toEqual(['modeling://domain/orders/order']);
    expect(child.path).toEqual(['body', 0, 'subdomains', 'children', 'body', 0]);
    let value: unknown = view.spec;
    for (const segment of child.path) value = (value as Record<string | number, unknown>)[segment];
    expect(value).toEqual(child.node);
    expect(JSON.stringify(rows[0])).toContain('modeling/domain/orders/index.xnl');
    expect(JSON.stringify(rows[0])).toContain('sha256:');
    expect((await catalog.list('EngineeringRegistry'))[0].readerValue).toMatchObject({kind: 'EngineeringRegistry', knowledge: {members: [{id: 'global.overview.project.layout'}]}});
    expect(Object.isFrozen(child.node)).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe(source);
    expect((await fs.readdir(root, {recursive: true})).some(name => name.includes('KindDefinition'))).toBe(false);
    for (const invalid of [
      source.replace('data-topology/v1', 'unknown/v1'),
      source.replace('modeling_schema="data-topology/v1"', ''),
      source.replace('domain.orders.item', 'domain.orders.order'),
      source.replace(envelope, ''),
    ]) {
      await fs.writeFile(file, invalid);
      expect((await catalog.snapshot()).ready).toBe(false);
      expect(await fs.readFile(file, 'utf8')).toBe(invalid);
    }
    await fs.writeFile(file, source.replace('data-topology/v1', 'codument-legacy/v1'));
    expect((await catalog.snapshot()).ready).toBe(true);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});
