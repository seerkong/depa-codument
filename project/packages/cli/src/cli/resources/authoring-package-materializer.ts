export * from 'halfcode-cli-lite-skill-app-support/resources/authoring-package-materializer';
import { CODUMENT_AUTHORING_PACKAGE_POLICY } from 'depa-codument-product-capsule/authoring-policy';
import { readAuthoringPackageMaterialSet as read } from 'halfcode-cli-lite-skill-app-support/resources/authoring-package-materializer';
export function readAuthoringPackageMaterialSet(resource: Parameters<typeof read>[0], kind: Parameters<typeof read>[1]) {
  return read(resource, kind, CODUMENT_AUTHORING_PACKAGE_POLICY);
}
