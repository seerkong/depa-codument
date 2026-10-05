import { loadCommandOperations } from 'halfcode-lite-skill-app-support/command-operation';
import { walkResourceFiles, normalizeResourcePath } from 'halfcode-lite-cli-support';
import { createGlobalGuidanceResourceEffect, GLOBAL_APP_ROOT } from './global-guidance-resource';

export { createGlobalGuidanceResourceEffect, GLOBAL_APP_ROOT };

export async function readGlobalGuidanceAssets(resources = createGlobalGuidanceResourceEffect()) {
  const entries = await walkResourceFiles(resources, GLOBAL_APP_ROOT);
  if (!entries.some(entry => entry.path === GLOBAL_APP_ROOT + '/manifest.xnl')) throw new Error('Global SkillApp manifest is missing');
  return Promise.all(entries.map(async entry => {
    const source = await resources.readText(entry.path);
    if (source === undefined) throw new Error('Missing global App asset: ' + entry.path);
    return Object.freeze({ path: entry.path.slice(GLOBAL_APP_ROOT.length + 1), source });
  }));
}

/** Adapt the fixed ResourceEffect root to the public compiler read port. */
export async function createCodumentGuidanceOperations(resources = createGlobalGuidanceResourceEffect()) {
  const file = (path: string) => GLOBAL_APP_ROOT + '/' + normalizeResourcePath(path.replace(/^\//, ''));
  if ((await resources.stat(GLOBAL_APP_ROOT + '/manifest.xnl'))?.kind !== 'file') throw new Error('Global SkillApp manifest is missing');
  return loadCommandOperations({
    stat: async path => { const entry = await resources.stat(file(path)); return entry && { kind: entry.kind }; },
    readBytes: path => resources.readBytes(file(path)),
    readDirectory: async path => (await resources.readDirectory(file(path)))?.map(entry => ({ name: entry.name, kind: entry.kind })),
  }, 'resource:' + GLOBAL_APP_ROOT);
}

// Read-only projections for existing product consumers; resource files own all metadata.
export const CODUMENT_GLOBAL_GUIDANCE_ASSETS = Object.freeze(await readGlobalGuidanceAssets());
export const CODUMENT_GLOBAL_SKILL = CODUMENT_GLOBAL_GUIDANCE_ASSETS.find(asset => asset.path === 'SKILL.md')!.source;
export const CODUMENT_OPERATION_ROUTES = Object.freeze((await createCodumentGuidanceOperations()).map(operation => {
  const name = operation.command.replace(/-operation$/, '');
  return Object.freeze({ legacySkill: 'codument-' + name, operation: name, command: operation.command,
    fqn: operation.fqn, description: operation.description });
}));
