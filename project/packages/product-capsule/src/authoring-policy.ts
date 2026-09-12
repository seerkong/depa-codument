import type { AuthoringPackagePolicy } from 'halfcode-cli-lite-skill-app-contract/bundle';

/** App-facing package identity is retained; its implementation now forwards to the public contract. */
export const CODUMENT_AUTHORING_PACKAGE_POLICY: AuthoringPackagePolicy = Object.freeze({
  contractPackage: 'depa-codument-skill-app-contract',
});
