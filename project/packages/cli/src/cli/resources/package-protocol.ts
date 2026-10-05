import { CODUMENT_AUTHORING_PACKAGE_POLICY } from 'depa-codument-product-capsule/authoring-policy';
import { validatePackageProtocol as validate, resolvePackageModulesRoot as resolve } from 'halfcode-lite-skill-app-support/resources/package-protocol';
export { COMPILER_PACKAGE, PackageProtocolError, packagePathSafetyIssue, type PackageProtocolEvidence } from 'halfcode-lite-skill-app-support/resources/package-protocol';
export const CONTRACT_PACKAGE = CODUMENT_AUTHORING_PACKAGE_POLICY.contractPackage;
export function validatePackageProtocol(input: Parameters<typeof validate>[0]) {
  return validate(input, CODUMENT_AUTHORING_PACKAGE_POLICY);
}
export function resolvePackageModulesRoot(packageRoot: string, lockPath: string) {
  return resolve(packageRoot, lockPath, CODUMENT_AUTHORING_PACKAGE_POLICY);
}
