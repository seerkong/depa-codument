import { applyResourceMigration, inspectResourceMigration, planResourceMigration, migrationAdmissionDefinition, validateResourceMigration } from 'depa-codument-domain-logic';
import { createFileResourceMigrationPort, readResourceMigrationValidation } from 'depa-codument-domain-support';
import { createCodumentResourceContracts } from 'depa-codument-host-adapter/resources';
import { loadHostAuthoredSource } from 'halfcode-lite-skill-app-support/resources/authored-loader';
import type { ResourceMigrationPlan, CodumentResourceMigrator } from 'depa-codument-domain-contract';

/** Local bootstrap API: the new formal App need not load to migrate an old
 * resource. Built-in compiler admission and full domain validation are separate. */
export function createCodumentResourceMigrator(workspaceRoot: string): CodumentResourceMigrator {
  const files = createFileResourceMigrationPort(workspaceRoot, undefined, migrationAdmissionDefinition);
  const runtime = {
    files,
    async validate(root: string, plan: ResourceMigrationPlan, admissionRoot?: string) {
      try {
        if (plan.proposal?.source !== null) {
          if (!admissionRoot) throw new Error('Migration is missing its built-in Kind admission view.');
          const contracts = createCodumentResourceContracts();
          const loaded = await loadHostAuthoredSource(admissionRoot, contracts);
          contracts.resolveTree(loaded.tree);
        }
        return validateResourceMigration(await readResourceMigrationValidation(root, plan), plan);
      } catch (cause) { return [{severity: 'error' as const, message: String(cause)}]; }
    },
  };
  return Object.freeze({
    displayPath(path: string) {return files.resolve(path).absolute;},
    async inspect(path: string) { return inspectResourceMigration(await files.read(path)); },
    async plan(path: string) { return planResourceMigration(await files.read(path)); },
    async verify(path: string) {
      const snapshot = await files.read(path), plan = planResourceMigration(snapshot);
      if (plan.status !== 'noop') return {path, valid: false, diagnostics: plan.diagnostics.length ? plan.diagnostics : ['Resource requires migration before current validation.']};
      const prepared = await files.prepare(snapshot, plan, {transient: true});
      try {
        const findings = prepared.reviewDiagnostics?.length ? prepared.reviewDiagnostics.map(message => ({severity: 'error' as const, message}))
          : await runtime.validate(prepared.validationRoot, plan, prepared.admissionRoot);
        await prepared.assertCurrent();
        return {path, valid: !findings.some(finding => finding.severity === 'error'), diagnostics: findings.map(finding => finding.message)};
      } finally {await prepared.abort();}
    },
    apply(plan: ResourceMigrationPlan) { return applyResourceMigration(runtime, plan); },
    async upgrade(path: string) { return applyResourceMigration(runtime, planResourceMigration(await files.read(path))); },
  });
}
