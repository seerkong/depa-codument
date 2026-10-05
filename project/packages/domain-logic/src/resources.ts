import { CODUMENT_KIND_CONTRACTS, type CodumentResourceKind, type CodumentResourceView } from 'depa-codument-domain-contract/resources';
import { defineResourceContractRegistrations, digestCanonical, type PortableSpec } from 'halfcode-lite-skill-app-contract/resource';

function frozenCopy<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(frozenCopy)) as T;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, frozenCopy(child)]))) as T;
}

function readSpec(kind: CodumentResourceKind, spec: PortableSpec): CodumentResourceView {
  if (!spec.properties || typeof spec.properties !== 'object' || Array.isArray(spec.properties)
    || !spec.subdomains || typeof spec.subdomains !== 'object' || Array.isArray(spec.subdomains) || !Array.isArray(spec.body)) {
    throw new Error(`Codument ${kind} reader requires a canonical portable XNL container.`);
  }
  return Object.freeze({ kind, validationLevel: 'structural', spec: frozenCopy(spec) });
}

/** Typed projection bindings, separate from the data-only Kind ownership package. */
export const CODUMENT_RESOURCE_READER_REGISTRATIONS = defineResourceContractRegistrations({
  owners: [], revisions: [],
  readers: CODUMENT_KIND_CONTRACTS.map(({ kind, owner, revision }) => ({
    readerId: `codument.${kind}.reader/v1`, subjectFqn: owner.subjectFqn,
    readerSpecVersion: 1, contractFingerprint: revision.contractFingerprint,
    readerImplementationFingerprint: digestCanonical({ kind, implementation: 'codument-preserved-portable-tree/v1' }),
    compatibilityPolicy: 'exact' as const,
    read: (spec: PortableSpec) => readSpec(kind, spec),
  })),
  writers: CODUMENT_KIND_CONTRACTS.map(({ kind, owner, revision }) => ({
    subjectFqn: owner.subjectFqn, writerSpecVersion: 1, contractFingerprint: revision.contractFingerprint,
    write: (input: unknown) => {
      if (!input || typeof input !== 'object' || (input as CodumentResourceView).kind !== kind) throw new Error('Codument writer Kind mismatch.');
      return readSpec(kind, (input as CodumentResourceView).spec).spec;
    },
  })),
});
