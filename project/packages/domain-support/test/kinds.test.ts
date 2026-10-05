import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CODUMENT_KIND_CONTRACTS, CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS, type CodumentResourceView } from 'depa-codument-domain-contract/resources';
import { CODUMENT_RESOURCE_READER_REGISTRATIONS } from 'depa-codument-domain-logic/resources';
import { createHostResourceContractRuntime } from 'halfcode-lite-skill-app-support/resources/host-resource-contracts';
import { createWorkspaceResourceCatalog } from 'halfcode-lite-skill-app-support/resources/workspace-resource-catalog';
import originalKindContracts from './fixtures/kind-contracts.json';

const metadata = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
function contracts() {
  return createHostResourceContractRuntime({ registrations: [CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS, CODUMENT_RESOURCE_READER_REGISTRATIONS] });
}

describe('code-owned Codument Kind bootstrap', () => {
  it('admits built-in Kinds and nonempty directory/forest resources without copying definitions', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-kinds-'));
    try {
      const catalogs: string[] = [];
      for (const { kind, owner } of CODUMENT_KIND_CONTRACTS) {
        const directory = owner.sourceContract.sourceShapes.includes('directory');
        const entry = directory ? kind.toLowerCase() + '.xnl' : 'resource.xnl';
        await fs.mkdir(path.join(root, kind));
        const properties = kind === 'Track' ? '{ status = "in_progress" }' : kind === 'Mission' ? '{ status = "active" revision = 2 }' : '{}';
        let content = `<${kind} #Codument.Example.${kind} ${metadata} ${properties}`;
        if (kind === 'Track' || kind === 'Mission') content += ' (<TaskSpace #TS (<SubNodes [<TaskGroup #G1 { status = "ACTIVE" } (<SubNodes [<Task #T1 { status = "ACTIVE" }> ]>)> ]>)>)>';
        else if (kind === 'decision') content += ' [<decision #nested.child { status = "accepted" }>]> ' + `<decision #second.root ${metadata} { status = "accepted" }>`;
        else content += '>';
        await fs.writeFile(path.join(root, kind, entry), content);
        for (const file of owner.sourceContract.requiredFiles) await fs.writeFile(path.join(root, kind, file), '# Owned document');
        catalogs.push(`<Catalog #${kind} { resourceKind="${kind}" root="vfs://./${kind}/" shape="${directory ? 'directory' : 'single-file'}" entry="${entry}" ${directory ? 'scope="root"' : ''} }>`);
      }
      const manifest = `<SkillApp #Codument.Example.App ${metadata} (<Catalogs [${catalogs.join(' ')}]>)>`;
      await fs.writeFile(path.join(root, 'manifest.xnl'), manifest);
      const catalog = createWorkspaceResourceCatalog(root, [{ root: '.', scope: 'root', origin: 'test' }], contracts());
      const snapshot = await catalog.snapshot();
      expect(snapshot.diagnostics).toEqual([]);
      expect(snapshot.ready).toBe(true);
      for (const { kind } of CODUMENT_KIND_CONTRACTS) {
        const rows = await catalog.list(kind);
        expect(rows).toHaveLength(kind === 'decision' ? 2 : 1);
        expect(rows[0].readerValue).toMatchObject({ kind, validationLevel: 'structural' });
      }
      expect(JSON.stringify((await catalog.list('decision'))[0].readerValue)).toContain('nested.child');
      expect(await fs.readFile(path.join(root, 'manifest.xnl'), 'utf8')).toBe(manifest);
      expect((await fs.readdir(root, { recursive: true })).some((file) => String(file).includes('KindDefinition'))).toBe(false);
      await fs.unlink(path.join(root, 'Track/design.md'));
      expect((await catalog.snapshot()).ready).toBe(false);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('retains exact identity/case, portable extension data, owner locks and experimental status', () => {
    const runtime = contracts();
    expect(CODUMENT_KIND_CONTRACTS).toHaveLength(5);
    expect(CODUMENT_KIND_CONTRACTS as unknown).toEqual(originalKindContracts.contracts);
    expect(CODUMENT_RESOURCE_READER_REGISTRATIONS.readers.map(({ read: _read, ...identity }) => identity) as unknown).toEqual(originalKindContracts.readers);
    expect(CODUMENT_KIND_CONTRACTS.find((entry) => entry.kind === 'decision')!.owner.subjectFqn).toBe('codument.resource_kind.decision');
    expect(CODUMENT_KIND_CONTRACTS.every(({ revision }) => revision.stability === 'experimental')).toBe(true);
    const spec = { properties: { status: 'active', unknown: { flags: [true, 7] } }, body: [], subdomains: { Future: { opaque: 'keep' } } };
    const reader = CODUMENT_RESOURCE_READER_REGISTRATIONS.readers.find((entry) => entry.subjectFqn.endsWith('.Mission'))!;
    const value = reader.read(spec);
    expect(value.spec).toEqual(spec);
    expect(value.spec).not.toBe(spec);
    expect(Object.isFrozen(value.spec.properties)).toBe(true);
    const writer = CODUMENT_RESOURCE_READER_REGISTRATIONS.writers.find((entry) => entry.subjectFqn.endsWith('.Mission'))!;
    expect(writer.write(value)).toEqual(spec);
    expect(() => writer.write({ ...value, kind: 'Track' } as CodumentResourceView)).toThrow('Kind mismatch');
    expect(runtime.readerProfile.readerFor('codument.resource_kind.Mission').readerId).toBe('codument.Mission.reader/v1');
    expect(() => createHostResourceContractRuntime({ registrations: [CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS, { owners: [{ ...CODUMENT_KIND_CONTRACTS[0].owner, ownerPackageId: 'conflicting-owner' }], revisions: [] }] })).toThrow();
  });

  it('rejects invalid schema and legacy envelopes rather than silently accepting old authority', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-kind-rejection-'));
    try {
      await fs.mkdir(path.join(root, 'track'));
      await fs.writeFile(path.join(root, 'manifest.xnl'), `<SkillApp #Codument.Example.App ${metadata} (<Catalogs [<Catalog #tracks { resourceKind="Track" shape="directory" scope="root" root="vfs://./track/" entry="track.xnl" }> ]>)>`);
      for (const file of ['proposal.md', 'design.md']) await fs.writeFile(path.join(root, 'track', file), '# Document');
      const file = path.join(root, 'track/track.xnl');
      await fs.writeFile(file, `<Track #example ${metadata} { status = 42 }>`);
      const catalog = createWorkspaceResourceCatalog(root, [{ root: '.', scope: 'root', origin: 'test' }], contracts());
      const invalid = await catalog.snapshot();
      expect(invalid.ready).toBe(false);
      expect(invalid.diagnostics.some((issue) => issue.code === 'WRITER_SCHEMA_INVALID')).toBe(true);
      await fs.writeFile(file, '<Track #example apiVersion="codument.tech/v1alpha1" version="1" { status = "in_progress" }>');
      const legacy = await catalog.snapshot();
      expect(legacy.ready).toBe(false);
      expect(legacy.diagnostics.length).toBeGreaterThan(0);
      expect(await fs.readFile(file, 'utf8')).toContain('apiVersion=');
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});
