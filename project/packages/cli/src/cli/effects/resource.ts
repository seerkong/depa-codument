import { join } from 'node:path';
import type { Blob } from 'node:buffer';
import { createSourceResourceEffect as source, createEmbeddedResourceEffect, EMBEDDED_RESOURCE_PREFIX } from 'halfcode-cli-lite-cli-host-support';
export { createEmbeddedResourceEffect, normalizeResourcePath, walkResourceFiles, EMBEDDED_RESOURCE_PREFIX } from 'halfcode-cli-lite-cli-host-support';
export type { ResourcePath, ResourceEntryKind, ResourceEntry, ResourceEffect } from 'halfcode-cli-lite-cli-host-contract';

/** Product template binding; the reusable file resource effect requires an explicit root. */
export const createSourceResourceEffect = (root = join(import.meta.dir, '..', '..', 'templates')) => source(root);
export function createResourceEffect() {
  return (Bun.embeddedFiles as readonly (Blob & { name?: string })[]).some(({ name }) => name?.replaceAll('\\', '/').includes(EMBEDDED_RESOURCE_PREFIX))
    ? createEmbeddedResourceEffect((Bun.embeddedFiles as readonly (Blob & { name?: string })[])
      .filter(file => file.name?.replaceAll('\\', '/').startsWith('resource/packages/cli/src/templates/'))
      .map(file => Object.defineProperty(file.slice(), 'name', {
        value: 'resource/' + file.name!.replaceAll('\\', '/').slice('resource/packages/cli/src/templates/'.length),
      })))
    : createSourceResourceEffect();
}
export const createPackagedResourceEffect = createResourceEffect;
