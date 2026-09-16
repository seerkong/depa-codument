import { describe, expect, test } from 'bun:test';
import {
  CORE_KIND_READER_REGISTRATIONS,
  KindReaderRegistry,
  createKindSubjectOwner,
} from 'halfcode-compiler.xnl/kind-definition';
import { digestCanonical } from 'halfcode-compiler.xnl/resource-core';
import { skillAppKindContract } from 'depa-codument-skill-app-contract/resource';
import {
  HOST_KIND_CONTRACT_DESCRIPTORS,
  HOST_RESOURCE_CONTRACT_REGISTRATIONS,
  createHostResourceContractRuntime,
} from '../../src/cli/resources/host-resource-contracts';

describe('Host resource contract composition root', () => {
  test('admits one exact owner/revision/reader set and creates a stable lock', () => {
    const first = createHostResourceContractRuntime();
    const second = createHostResourceContractRuntime();

    expect(HOST_KIND_CONTRACT_DESCRIPTORS).toHaveLength(18);
    expect(first.readerProfile.readers.size).toBe(23);
    expect(first.contractLock.readers).toHaveLength(23);
    for (const kind of ['AttractorProfiles', 'decision', 'Mission', 'OperationHooks', 'Track']) {
      expect(first.readerProfile.readerFor(`codument.resource_kind.${kind}`).readerId).toBe(`codument.${kind}.reader/v1`);
    }
    expect(first.contractLock.lockDigest).toBe(second.contractLock.lockDigest);
    expect(first.contractLock.lockDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(CORE_KIND_READER_REGISTRATIONS.map((reader) => reader.readerId)).toEqual([
      'halfcode.compiler.kind-definition.reader.v1',
      'halfcode.compiler.resource-package.reader.v1',
    ]);
  });

  test.each(['contractFingerprint', 'readerImplementationFingerprint'] as const)(
    'rejects ReaderProfile %s drift against the admitted executable reader',
    (field) => {
      const runtime = createHostResourceContractRuntime();
      const exact = runtime.readerProfile.readerFor('Halfcode.ResourceKind.Page');
      const readers = new KindReaderRegistry();
      for (const reader of [...CORE_KIND_READER_REGISTRATIONS, ...(HOST_RESOURCE_CONTRACT_REGISTRATIONS.readers ?? [])]) {
        readers.register(reader);
      }
      expect(() => readers.require({
        ...exact,
        [field]: digestCanonical(`drift:${field}`),
      })).toThrow('KIND_READER_FINGERPRINT_MISMATCH');
    },
  );

  test('rejects an expected lock mismatch and duplicate owner authority', () => {
    expect(() => createHostResourceContractRuntime({
      expectedLock: { lockDigest: digestCanonical('drifted-lock') },
    })).toThrow('HOST_KIND_CONTRACT_LOCK_MISMATCH');

    const page = skillAppKindContract('Page');
    const conflictingOwner = createKindSubjectOwner({
      kind: page.kind,
      subjectFqn: page.subjectFqn,
      ownerPackageId: 'untrusted-page-owner',
      ownerPackageFingerprint: digestCanonical('untrusted-page-owner'),
      sourceShapes: page.sourceShapes,
      documentCardinality: page.documentCardinality,
      requiredFiles: page.requiredFiles,
    });
    expect(() => createHostResourceContractRuntime({
      registrations: [{ owners: [conflictingOwner], revisions: [] }],
    })).toThrow('KIND_SUBJECT_OWNER_CONFLICT');
  });

  test('fails invalid Page business shape before producing a resolution receipt', () => {
    const runtime = createHostResourceContractRuntime();
    const input = {
      resourceId: 'Test.Invalid.Page',
      kind: 'Page',
      writerSpecVersion: 1,
      authoredSpec: Object.freeze({
        properties: Object.freeze({ description: 'missing name' }),
        body: Object.freeze([]),
        subdomains: Object.freeze({}),
      }),
      sourceContentDigest: digestCanonical('invalid-page-source'),
    } as const;
    expect(() => runtime.resolvePortableSpec(input)).toThrow('WRITER_SCHEMA_INVALID');

    const resolved = runtime.resolvePortableSpec({
      ...input,
      resourceId: 'Test.Valid.Page',
      authoredSpec: Object.freeze({
        properties: Object.freeze({ name: 'valid-page', description: 'Valid page' }),
        body: Object.freeze([]),
        subdomains: Object.freeze({}),
      }),
      sourceContentDigest: digestCanonical('valid-page-source'),
    });
    expect(resolved.readerValue).toMatchObject({ kind: 'Page', properties: { name: 'valid-page' } });
    expect(resolved.receipt.reader.implementationFingerprint).toMatch(/^sha256:/);
  });
});
