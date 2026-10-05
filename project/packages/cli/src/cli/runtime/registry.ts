import type { LocateRegistryOptions } from 'halfcode-lite-cli-contract/registry';
import { discoverRegistryFiles as discover, locateRegistryFile as locate, resolveDiscoveredFunction as resolveFunction } from 'halfcode-lite-browser-support/registry';
export type * from 'halfcode-lite-cli-contract/registry';
export { parseRegistry, resolveRegistryFunction, collectSkillsDirs } from 'halfcode-lite-cli-logic/registry';
export { registryDirectory, resolveModulePath } from 'halfcode-lite-browser-support/registry';

export function productRoots(options: LocateRegistryOptions): LocateRegistryOptions {
  return { ...options, capsuleSkillRoots: options.capsuleSkillRoots ?? [
    { path: 'skills', multiple: 'error' },
    { path: 'dist/codument-demo/skills', multiple: 'skip' },
  ] };
}
export function discoverRegistryFiles(options: LocateRegistryOptions) { return discover(productRoots(options)); }
export function locateRegistryFile(options: LocateRegistryOptions) { return locate(productRoots(options)); }
export function resolveDiscoveredFunction(options: LocateRegistryOptions, fqn: string) { return resolveFunction(productRoots(options), fqn); }
