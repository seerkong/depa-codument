export * from 'halfcode-lite-skill-app-support/resources/page-bundle-materializer';
import { CODUMENT_AUTHORING_PACKAGE_POLICY } from 'depa-codument-product-capsule/authoring-policy';
import { materializePageBundle as materialize } from 'halfcode-lite-skill-app-support/resources/page-bundle-materializer';
export function materializePageBundle(bundle: Parameters<typeof materialize>[0]) {
  return materialize(bundle, CODUMENT_AUTHORING_PACKAGE_POLICY);
}
