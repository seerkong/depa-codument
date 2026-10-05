import type { PageFeatureRuntime } from 'halfcode-lite-page-capsule';
import type { CommandRuntime } from './contracts/command';
export function bindPageFeature(runtime: CommandRuntime): PageFeatureRuntime {
    const pages = runtime.page?.pages;
    if (!pages)
        throw new Error('Page resource catalog is not configured');
    const resourceCatalog = runtime.resourceCatalog;
    if (!resourceCatalog)
        throw new Error('Workspace resource catalog is not configured');
    return { pages, resourceCatalog };
}
