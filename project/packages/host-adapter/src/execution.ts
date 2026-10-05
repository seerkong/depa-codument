import type { CommandExecutionPolicy } from 'halfcode-lite-cli-contract';

/** Product-owned placement descriptors shared by registration and presentation. */
export const CODUMENT_DOMAIN_EXECUTION = Object.freeze({
  lifecycle: Object.freeze({ placement: 'local', runtimeProfile: 'domain' } as const),
  registry: Object.freeze({ placement: 'local', runtimeProfile: 'domain-registry' } as const),
});
export function isCodumentDomainExecution(policy: CommandExecutionPolicy): boolean {
  return Object.values(CODUMENT_DOMAIN_EXECUTION).some(candidate => candidate.placement === policy.placement && candidate.runtimeProfile === policy.runtimeProfile);
}
