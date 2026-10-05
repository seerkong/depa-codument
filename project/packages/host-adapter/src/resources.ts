import { CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS } from 'depa-codument-domain-contract/resources';
import { CODUMENT_RESOURCE_READER_REGISTRATIONS } from 'depa-codument-domain-logic/resources';
import type { HostResourceReaderIdentity } from 'halfcode-lite-skill-app-contract/resource-runtime';
import { SKILL_APP_RESOURCE_KINDS } from 'halfcode-lite-skill-app-contract/resource';
import { createHostResourceContractRuntime } from 'halfcode-lite-skill-app-support/resources/host-resource-contracts';
import type { CreateHostResourceContractRuntimeOptions } from 'halfcode-lite-skill-app-support/resources/host-resource-contracts';
import { createHostReaderContracts, type HostResourceKind } from 'halfcode-lite-skill-app-logic/resources/reader-contracts';
export type { HostResourceKind, HostResolvedResourceSpec, HostKindContractDescriptor } from 'halfcode-lite-skill-app-logic/resources/reader-contracts';
export { HOST_RESOURCE_KINDS } from 'halfcode-lite-skill-app-logic/resources/reader-contracts';
export type { HostResourceContractRuntime } from 'halfcode-lite-skill-app-contract/resource-runtime';

/** Product semantic authority is stable even when its implementation package changes. */
export const CODUMENT_HOST_READER_IDENTITY: HostResourceReaderIdentity = Object.freeze({
  resource: Object.freeze({ ownerPackageId: 'depa-codument-skill-app-contract', contractAuthority: 'depa-codument-skill-app-contract/resource-contracts/v1' }),
  readerIdPrefix: 'cli-host', profileId: 'cli-host/resource-readers/v1',
  contractAuthority: 'cli-host-resource-contracts/v1', adapterVersion: 'cli-host/typed-resource-reader/v1',
});

const contracts = createHostReaderContracts(CODUMENT_HOST_READER_IDENTITY);
export const HOST_KIND_CONTRACT_DESCRIPTORS = contracts.descriptors;
export const HOST_RESOURCE_CONTRACT_REGISTRATIONS = contracts.readerRegistrations;
export const HOST_RESOURCE_READER_PROFILE_ID = CODUMENT_HOST_READER_IDENTITY.profileId;
export const HOST_RESOURCE_CONTRACT_VERSION = CODUMENT_HOST_READER_IDENTITY.contractAuthority;
export function hostKindContract(kind: HostResourceKind) {
  const descriptor = contracts.descriptors.find(item => item.kind === kind);
  if (!descriptor) throw new Error(`HOST_KIND_CONTRACT_MISSING: ${kind}`);
  return descriptor;
}
export type CodumentResourceContractOptions = Pick<CreateHostResourceContractRuntimeOptions, 'registrations' | 'expectedLock'>;
/** Domain structural registrations extend one reader authority; legacy documents still require migration. */
export function createCodumentResourceContracts(options: CodumentResourceContractOptions = {}) {
  return createHostResourceContractRuntime({ semanticIdentity: CODUMENT_HOST_READER_IDENTITY,
    // Full inspection plus Codument domain registrations; schema readability never grants execution.
    readableKinds: SKILL_APP_RESOURCE_KINDS,
    registrations: [CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS, CODUMENT_RESOURCE_READER_REGISTRATIONS, ...(options.registrations ?? [])],
    expectedLock: options.expectedLock });
}
