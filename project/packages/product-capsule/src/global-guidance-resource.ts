import { join } from 'node:path';
import type { Blob } from 'node:buffer';
import { createSourceResourceEffect, createEmbeddedResourceEffect } from 'halfcode-cli-lite-cli-host-support';

export const GLOBAL_APP_ROOT = 'agents/global/skills/depa-codument';
const embeddedPrefix = 'resource/packages/product-capsule/src/templates/';

/** Fixed product asset root; no cwd, installed-skill discovery or generated documents. */
export function createGlobalGuidanceResourceEffect(sourceRoot = join(import.meta.dir, 'templates')) {
  const blobs = (Bun.embeddedFiles as readonly (Blob & { name?: string })[]);
  if (!blobs.length) return createSourceResourceEffect(sourceRoot);
  const files = blobs.filter(file => file.name?.replaceAll('\\', '/').startsWith(embeddedPrefix))
    .map(file => Object.defineProperty(file.slice(), 'name', {
      value: 'resource/' + file.name!.replaceAll('\\', '/').slice(embeddedPrefix.length),
    }));
  return createEmbeddedResourceEffect(files);
}
