export * from 'halfcode-lite-skill-app-support/resources/host-package-materializer';
import { CODUMENT_AUTHORING_PACKAGE_POLICY } from 'depa-codument-product-capsule/authoring-policy';
import { readHostPackageMaterialSet as read } from 'halfcode-lite-skill-app-support/resources/host-package-materializer';
export function readHostPackageMaterialSet(resource: Parameters<typeof read>[0]) {
  return read(resource, CODUMENT_AUTHORING_PACKAGE_POLICY);
}
