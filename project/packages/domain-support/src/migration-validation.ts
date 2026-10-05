import * as fs from 'node:fs/promises';
import { join, posix } from 'node:path';
import type { MigrationValidationSnapshot, ResourceMigrationPlan } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-lite-skill-app-support/workspace';
import { createFileDomainValidationSourcePort } from './validate';
import { readXnlRegistrySources } from './registry';

/** Direct filesystem bootstrap: neither old nor new manifest/Std is required. */
export async function readResourceMigrationValidation(root: string, plan: ResourceMigrationPlan): Promise<MigrationValidationSnapshot> {
  const workspace = createWorkspaceEffect(root), file = plan.targetPath;
  if (!file || !file.startsWith('codument/')) throw new Error('Migration target path is unresolved.');
  async function read(file: string): Promise<string | undefined> {
    if (await workspace.kind(file) === undefined) return undefined;
    if (await workspace.kind(file) !== 'file') throw new Error('Migration source must be a regular file.');
    const source = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(await fs.readFile(join(root, file)));
    await workspace.kind(file); return source;
  }
  const source = await read(file);
  if (plan.targetKind === 'decision') {
    let directory: string;
    if (file.startsWith('codument/decisions/')) directory = 'codument/decisions';
    else if (posix.basename(file) === 'decisions.xnl') directory = posix.dirname(file) + '/decisions';
    else if (file.includes('/decisions/')) directory = file.slice(0, file.indexOf('/decisions/') + '/decisions'.length);
    else return {source, decisions: source === undefined ? new Map() : new Map([[file, source]])};
    const decisions = new Map([...await readXnlRegistrySources(join(root, directory), {rejectLegacy: true})].map(([path, value]) => [directory + '/' + path, value]));
    const direct = posix.dirname(directory) + '/decisions.xnl', directSource = await read(direct);
    if (directSource !== undefined) decisions.set(direct, directSource);
    return {source, decisions};
  }
  if (['Track', 'Mission'].includes(plan.targetKind ?? '')) {
    const parent = posix.dirname(file);
    const target = posix.basename(parent);
    return {source, domain: await createFileDomainValidationSourcePort(root, {includeArchivedTracks: true}).observe(target)};
  }
  return {source};
}
