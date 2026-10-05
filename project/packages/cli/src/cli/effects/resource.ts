import { join } from 'node:path';
import type { Blob } from 'node:buffer';
import { createSourceResourceEffect as source } from 'halfcode-lite-cli-support';
import {createResourceBundleEffect} from 'halfcode-lite-resource-bundle-support';
export { createEmbeddedResourceEffect, normalizeResourcePath, walkResourceFiles, EMBEDDED_RESOURCE_PREFIX } from 'halfcode-lite-cli-support';
export type { ResourcePath, ResourceEntryKind, ResourceEntry, ResourceEffect } from 'halfcode-lite-cli-contract';

/** Product template binding; the reusable file resource effect requires an explicit root. */
export const createSourceResourceEffect = (root = join(import.meta.dir, '..', '..', 'templates')) => source(root);
export function createResourceEffect() {
  return createResourceBundleEffect({templateRoot:join(import.meta.dir,'..','..','templates'),embeddedFiles:Bun.embeddedFiles as readonly (Blob & {name?:string})[],embeddedRoot:'resource/packages/cli/src/templates/'});
}
export const createPackagedResourceEffect = createResourceEffect;
