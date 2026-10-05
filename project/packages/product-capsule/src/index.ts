import type { LifecycleValidationContext, MigrationGuideTopic } from 'depa-codument-domain-contract';
import { archiveDestinationPrefix, archiveTrackSelectors, assertArchiveRequest, createValidatedLifecycleSourceCodec, isCurrentStdDocumentation, lifecycleSourceCodec, projectTrackVerificationContract, readAttractorProfileNames, readWorkspaceBindingSources } from 'depa-codument-domain-logic';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS } from './global-guidance';
import { createFileLifecycleRepository, createFileVerificationRuntime, createFileDecisionSourcePort, createFileDecisionWritePort, readAttractorProfilesSource,
  readLocalWorkspaceBindingsSource, createCodumentContextGuard, createFileWorkspaceBindingRuntime, createFileDomainQuerySourcePort, createFileScaffoldSourcePort, createFileDomainValidationSourcePort, createFileStdDocumentationPort, createFileArtifactSyncPort, createFileArchiveSourcePort } from 'depa-codument-domain-support';
import { createDomainOwner } from 'depa-codument-domain-capsule';
import { createCodumentDomainCommands } from 'depa-codument-host-adapter';
import { createCommandHost } from 'halfcode-lite-cli-capsule';
import { createCodumentResourceMigrator } from './migration';
import { createCodumentTrackMigrator } from './track-migration';

export const CODUMENT_IDENTITY = Object.freeze({ bin: 'codument', displayName: 'Codument', version: '0.6.0' });
export interface CodumentDomainBindings {
  readonly json?: boolean;
  readonly context?: CodumentDomainContext;
  readonly validation: LifecycleValidationContext;
  readonly clock: { nowIso(): string };
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly output: { write(bytes: Uint8Array): void };
}

export interface CodumentDomainContext {
  readonly validation: LifecycleValidationContext;
  readonly projects: Readonly<Record<string, string>>;
  readonly sources: { readonly profiles?: string; readonly bindings?: string };
}

export async function observeCodumentDomainContext(workspaceRoot: string): Promise<CodumentDomainContext> {
  const [profiles, bindings] = await Promise.all([readAttractorProfilesSource(workspaceRoot), readLocalWorkspaceBindingsSource(workspaceRoot)]);
  return { validation: { file: 'codument', profileNames: readAttractorProfileNames(profiles) },
    projects: readWorkspaceBindingSources(bindings), sources: { profiles, bindings } };
}

/** Observe once for one CLI invocation; never cache across workspace invocations. */
export async function observeCodumentLifecycleValidation(workspaceRoot: string): Promise<LifecycleValidationContext> {
  return { file: 'codument', profileNames: readAttractorProfileNames(await readAttractorProfilesSource(workspaceRoot)) };
}

/** Filesystem and verification capabilities are scoped to the formal codument/ authority. */
export function createCodumentDomainRuntime(workspaceRoot: string, bindings: CodumentDomainBindings) {
  const context = bindings.context ? structuredClone(bindings.context) : undefined;
  const repository = createFileLifecycleRepository({ workspaceRoot, resourceDirectory: 'codument',
    projects: Object.fromEntries(Object.entries(context?.projects ?? {}).map(([ref, root]) => [ref, { workspaceRoot: root, resourceDirectory: 'codument' }])),
  }, {
    codec: createValidatedLifecycleSourceCodec(context?.validation ?? bindings.validation),
    assertContextCurrent: context ? createCodumentContextGuard(workspaceRoot, context.sources) : undefined,
    async observeLocationContext(location) {
      const observed = await observeCodumentDomainContext(location.workspaceRoot);
      return { codec: createValidatedLifecycleSourceCodec(observed.validation),
        assertContextCurrent: createCodumentContextGuard(location.workspaceRoot, observed.sources) };
    },
    archiveName: update => `${bindings.clock.nowIso().slice(0, 10)}-${update.id}`,
  });
  const verification = createFileVerificationRuntime({ workspaceRoot, env: bindings.env }, {
    projectTrackContract: projectTrackVerificationContract,
    locateTrack: id => repository.load({ kind: 'track', id }, { includeArchived: false }),
    output: bindings.output, clock: bindings.clock,
  });
  const archives = createFileArchiveSourcePort(workspaceRoot, {
    codec: createValidatedLifecycleSourceCodec(context?.validation ?? bindings.validation), projects: context?.projects,
    assertCurrent: context ? createCodumentContextGuard(workspaceRoot, context.sources) : undefined,
    async observeProjectContext(root) {
      const observed = await observeCodumentDomainContext(root);
      return {codec: createValidatedLifecycleSourceCodec(observed.validation), assertCurrent: createCodumentContextGuard(root, observed.sources)};
    },
    assertRequest: assertArchiveRequest, trackSelectors: archiveTrackSelectors, destinationPrefix: archiveDestinationPrefix, clock: bindings.clock,
    calendar(timestamp) {
      const date = new Date(timestamp);
      return {year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes()};
    },
  });
  const domain = createDomainOwner({ repository, verification, contextSources: context?.sources, artifacts: createFileArtifactSyncPort(workspaceRoot), decisions: createFileDecisionSourcePort(workspaceRoot),
    archive: {sources: archives},
    decisionWrites: createFileDecisionWritePort(workspaceRoot), projectBindings: createFileWorkspaceBindingRuntime(workspaceRoot),
    queries: createFileDomainQuerySourcePort(workspaceRoot), scaffolds: createFileScaffoldSourcePort(workspaceRoot),
    validationSources: createFileDomainValidationSourcePort(workspaceRoot), stdDocumentation: {
      observe: directory => directory
        ? createFileStdDocumentationPort(workspaceRoot, { include: isCurrentStdDocumentation }).observe(directory)
        : Promise.resolve({ root: 'resource:depa-codument/references/std', sources: new Map(CODUMENT_GLOBAL_GUIDANCE_ASSETS
          .filter(asset => asset.path.startsWith('references/std/')).map(asset => [asset.path.slice('references/std/'.length), asset.source])) }),
    },
    clock: bindings.clock });
  return Object.freeze({ domain, migration: createCodumentResourceMigrator(workspaceRoot), trackMigration: createCodumentTrackMigrator(workspaceRoot),
    migrationGuidance: async (topic: MigrationGuideTopic) => (await import('./migration-guidance')).readCodumentMigrationGuidance(topic),
    domainJson: bindings.json === true, close: () => domain.close() });
}

/** No Page, browser, Serve record or HTTP owner exists in this domain command closure. */
export function createCodumentDomainHost(bindings: (root: string) => CodumentDomainBindings) {
  return createCommandHost<ReturnType<typeof createCodumentDomainRuntime>>({ identity: CODUMENT_IDENTITY, commands: createCodumentDomainCommands() }, {
    createRuntime: root => createCodumentDomainRuntime(root, bindings(root)),
    disposeRuntime: runtime => runtime.close(),
  }, { runtimeScope: 'invocation' });
}
