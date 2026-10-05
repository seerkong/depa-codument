import { PageBuildCoordinator as HostPageBuildCoordinator } from 'halfcode-lite-live-host-capsule/page-build';
import { createFilePageGenerationStore as createHostStore } from 'halfcode-lite-skill-app-support/page-generation-store';
import { createPageBuildPlatform } from 'halfcode-lite-skill-app-support/page-build-platform';
import type { PageBuildCoordinatorOptions as HostOptions } from 'halfcode-lite-skill-app-contract/page-build';
export type * from 'halfcode-lite-skill-app-contract/page-build';
export { PACKAGE_BUILD_RECEIPT_ASSET } from 'halfcode-lite-skill-app-support/page-generation-store';
export { normalizeBuildDiagnostic } from 'depa-codument-page-builder-vue-support/build-diagnostic';

export interface PageBuildCoordinatorOptions extends Omit<HostOptions, 'platform'> {
  now?: () => number;
}
export class PageBuildCoordinator extends HostPageBuildCoordinator {
  constructor(options: PageBuildCoordinatorOptions) {
    const { now, ...bindings } = options;
    super({ ...bindings, platform: createPageBuildPlatform({ now }) });
  }
}
export function createFilePageGenerationStore(workspaceRoot: string) {
  return createHostStore(workspaceRoot, '.codument/cache/page-builds');
}
