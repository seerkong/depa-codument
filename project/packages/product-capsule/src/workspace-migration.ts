import { applyWorkspaceMigration, planCodumentWorkspaceMigration, resolveWorkspaceInstallTargets } from 'depa-codument-domain-logic';
import { createFileWorkspaceMigrationPort } from 'depa-codument-domain-support';
import type { WorkspaceMigrationPlan, WorkspaceMigrationSnapshot, WorkspaceInstallOptions } from 'depa-codument-domain-contract';
import { createCodumentWorkspaceInstallDefinition } from './workspace-install';
import { createCodumentWorkspaceInspector } from './workspace-app';
import { CODUMENT_LEGACY_MANAGED_FINGERPRINTS } from './legacy-managed-fingerprints';
import { CODUMENT_WORKSPACE_ASSETS } from './workspace-assets';
import { createHash } from 'node:crypto';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS } from './global-guidance';
import { CODUMENT_GLOBAL_REFERENCE_RELOCATIONS } from './global-reference-relocations';

/** Product upgrade composition uses the full App compiler, membership and
 * domain validators before publishing any planned resource changes. */
export function createCodumentWorkspaceMigrator(workspaceRoot: string, options?: WorkspaceInstallOptions) {
  const files = createFileWorkspaceMigrationPort(workspaceRoot);
  const installed = createCodumentWorkspaceInstallDefinition(options);
  const known: Record<string, readonly string[]> = { ...CODUMENT_LEGACY_MANAGED_FINGERPRINTS };
  for (const asset of CODUMENT_WORKSPACE_ASSETS.filter(asset => asset.path.startsWith('codument/std/') || asset.path === 'codument/SKILL.md')) {
    known[asset.path] = [...(known[asset.path] ?? []), 'sha256:' + createHash('sha256').update(asset.source).digest('hex')];
  }
  const definition = {appFiles: [...installed.appFiles, {path: 'config/cli-tools.json', source: resolveWorkspaceInstallTargets(options).configuration}], appDirectories: installed.appDirectories,
    globalReferences: Object.fromEntries([...CODUMENT_GLOBAL_GUIDANCE_ASSETS.filter(asset => asset.path.startsWith('references/std/'))
      .flatMap(asset => [
        ['vfs://@/codument/' + asset.path.slice('references/'.length), 'skill://depa-codument/' + asset.path],
        ['skill://depa-codument/' + asset.path.slice('references/'.length), 'skill://depa-codument/' + asset.path],
        ['skill://depa-codument/' + asset.path, 'skill://depa-codument/' + asset.path],
      ]), ...Object.entries(CODUMENT_GLOBAL_REFERENCE_RELOCATIONS)]),
    legacyManagedFingerprints: known};
  const plan = (snapshot: WorkspaceMigrationSnapshot) => planCodumentWorkspaceMigration(snapshot, definition);
  const runtime = {files, plan, async validate(root: string) {
    const result = await createCodumentWorkspaceInspector(root).inspect();
    if (!result.ready && !result.findings.some(finding => finding.severity === 'error')) return [{severity: 'error' as const, message: 'Workspace App is not ready for publication.'}];
    return result.findings.map(finding => ({severity: finding.severity, message: `${finding.file}: ${finding.message}`}));
  }};
  return Object.freeze({
    async plan() {return plan(await files.observe());},
    apply(expected: WorkspaceMigrationPlan) {return applyWorkspaceMigration(runtime, expected);},
    async upgrade() {return applyWorkspaceMigration(runtime, plan(await files.observe()));},
  });
}
