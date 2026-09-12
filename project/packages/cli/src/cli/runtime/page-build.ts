import { PageBuildCoordinator as HostPageBuildCoordinator } from 'halfcode-cli-lite-live-host-capsule/page-build';
import { createFilePageGenerationStore as createHostStore } from 'halfcode-cli-lite-skill-app-support/page-generation-store';
import { createPageBuildPlatform } from 'halfcode-cli-lite-skill-app-support/page-build-platform';
import type { PageBuildCoordinatorOptions as HostOptions } from 'halfcode-cli-lite-skill-app-contract/page-build';
export type * from 'halfcode-cli-lite-skill-app-contract/page-build';
export { PACKAGE_BUILD_RECEIPT_ASSET } from 'halfcode-cli-lite-skill-app-support/page-generation-store';
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
