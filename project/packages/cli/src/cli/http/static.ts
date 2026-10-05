import type { ResourceEffect } from '../effects/resource';

import { mimeType, webRelativePath } from 'halfcode-lite-skill-app-logic/web-path';
export { mimeType, webRelativePath } from 'halfcode-lite-skill-app-logic/web-path';

export async function loadWebAsset(
  resources: ResourceEffect,
  urlPath: string,
): Promise<{ body: Uint8Array; contentType: string } | undefined> {
  const relative = webRelativePath(urlPath);
  if (relative === undefined) return undefined;
  const resourcePath = `web/${relative}`;
  const entry = await resources.stat(resourcePath);
  if (entry?.kind === 'directory') {
    const index = await resources.readBytes(`${resourcePath}/index.html`);
    return index ? { body: index, contentType: mimeType('index.html') } : undefined;
  }
  const body = await resources.readBytes(resourcePath);
  return body ? { body, contentType: mimeType(relative) } : undefined;
}
