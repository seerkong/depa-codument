import type { LocateRegistryOptions } from 'halfcode-cli-lite-cli-host-contract/registry';
import { discoverRegistryFiles as discover, locateRegistryFile as locate, resolveDiscoveredFunction as resolveFunction } from 'halfcode-cli-lite-browser-support/registry';
export type * from 'halfcode-cli-lite-cli-host-contract/registry';
export { parseRegistry, resolveRegistryFunction, collectSkillsDirs } from 'halfcode-cli-lite-cli-host-logic/registry';
export { registryDirectory, resolveModulePath } from 'halfcode-cli-lite-browser-support/registry';

function productRoots(options: LocateRegistryOptions): LocateRegistryOptions {
  return { ...options, capsuleSkillRoots: options.capsuleSkillRoots ?? [
    { path: 'skills', multiple: 'error' },
    { path: 'dist/codument-demo/skills', multiple: 'skip' },
  ] };
}
export function discoverRegistryFiles(options: LocateRegistryOptions) { return discover(productRoots(options)); }
export function locateRegistryFile(options: LocateRegistryOptions) { return locate(productRoots(options)); }
export function resolveDiscoveredFunction(options: LocateRegistryOptions, fqn: string) { return resolveFunction(productRoots(options), fqn); }
