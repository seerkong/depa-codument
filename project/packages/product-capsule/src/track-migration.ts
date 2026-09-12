import { applyWorkspaceMigration, planWorkspaceResourceMigration, selectTrackMigrationSource } from 'depa-codument-domain-logic';
import { createFileWorkspaceMigrationPort } from 'depa-codument-domain-support';
import type { CodumentTrackMigrator, TrackUpgradeOptions, WorkspaceMigrationSnapshot } from 'depa-codument-domain-contract';
import { createCodumentResourceMigrator } from './migration';

/** Compatibility for the old track-id/archive-id operation. Early plan.xml
 * needs explicit semantic review; mode never silently drops task dependencies.
 * Backup is mandatory in this version and custom locations stay workspace-local. */
export function createCodumentTrackMigrator(workspaceRoot: string): CodumentTrackMigrator {
  return Object.freeze({async upgrade(identifier: string, options: TrackUpgradeOptions = {}) {
    const mode = options.mode ?? 'wave';
    if (mode !== 'wave' && mode !== 'sequential') throw new Error('Invalid Track upgrade mode.');
    if (options.noBackup) throw new Error('--no-backup is incompatible with current migration safety: an exact backup is mandatory.');
    const files = createFileWorkspaceMigrationPort(workspaceRoot, undefined, {backupDirectory: options.backupDirectory});
    const snapshot = await files.observe(), source = selectTrackMigrationSource(snapshot, identifier);
    const plan = (input: WorkspaceMigrationSnapshot) => {
      if (selectTrackMigrationSource(input, identifier) !== source) throw new Error('Track upgrade selection changed.');
      return planWorkspaceResourceMigration(input, [source]);
    };
    const expected = plan(snapshot), resource = expected.resources[0];
    const result = await applyWorkspaceMigration({files, plan, async validate(candidate) {
      const observed = await createCodumentResourceMigrator(candidate).verify(resource.targetPath ?? source);
      return observed.valid ? [] : observed.diagnostics.map(message => ({severity: 'error' as const, message}));
    }}, expected);
    const display = createCodumentResourceMigrator(workspaceRoot).displayPath;
    return {...result, path: display(source), targetPath: resource.targetPath && display(resource.targetPath), mode,
      ...(result.status === 'applied' ? {semanticReviewRecommended: true} : {}),
      diagnostics: [...result.diagnostics, ...(result.status === 'review-required' && source.endsWith('/plan.xml')
        ? [`Legacy plan.xml requires current Agent conversion with requested mode=${mode}; preserve dependencies, context, task descriptions and extensions. No scheduling changes were applied.`] : [])]};
  }});
}
