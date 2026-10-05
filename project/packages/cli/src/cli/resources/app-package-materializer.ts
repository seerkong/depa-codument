export * from 'halfcode-lite-skill-app-support/resources/app-package-materializer';
import { CODUMENT_AUTHORING_PACKAGE_POLICY } from 'depa-codument-product-capsule/authoring-policy';
import { readCompositionPackageMaterialSet as read } from 'halfcode-lite-skill-app-support/resources/app-package-materializer';
export function readCompositionPackageMaterialSet(resource: Parameters<typeof read>[0], kind: Parameters<typeof read>[1]) {
  return read(resource, kind, CODUMENT_AUTHORING_PACKAGE_POLICY);
}
