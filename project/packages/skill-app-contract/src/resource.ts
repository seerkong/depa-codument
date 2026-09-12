export * from 'halfcode-cli-lite-skill-app-contract/resource';
import { createSkillAppKindContractDescriptors as createDescriptors, defineResourceContractRegistrations,
  type SkillAppResourceContractIdentity, type SkillAppResourceKind } from 'halfcode-cli-lite-skill-app-contract/resource';

/** Stable product semantic identity; all schemas and mechanisms belong to the public package. */
export const SKILL_APP_RESOURCE_OWNER_PACKAGE_ID = 'depa-codument-skill-app-contract' as const;
export const SKILL_APP_RESOURCE_CONTRACT_VERSION = 'depa-codument-skill-app-contract/resource-contracts/v1' as const;
export function createSkillAppKindContractDescriptors(identity: SkillAppResourceContractIdentity = {
  ownerPackageId: SKILL_APP_RESOURCE_OWNER_PACKAGE_ID, contractAuthority: SKILL_APP_RESOURCE_CONTRACT_VERSION,
}) { return createDescriptors(identity); }
export const SKILL_APP_KIND_CONTRACT_DESCRIPTORS = createSkillAppKindContractDescriptors();
export const SKILL_APP_RESOURCE_CONTRACT_REGISTRATIONS = defineResourceContractRegistrations({
  owners: SKILL_APP_KIND_CONTRACT_DESCRIPTORS.map(item => item.owner),
  revisions: SKILL_APP_KIND_CONTRACT_DESCRIPTORS.map(item => item.revision),
});
export function skillAppKindContract(kind: SkillAppResourceKind) {
  const descriptor = SKILL_APP_KIND_CONTRACT_DESCRIPTORS.find(item => item.kind === kind);
  if (!descriptor) throw new Error(`SKILL_APP_KIND_CONTRACT_MISSING: ${kind}`);
  return descriptor;
}
