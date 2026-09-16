import { BIN } from '../../identity';
import { invokePageObjectAction } from '../app/invoke';
import type { CommandContext, CommandResult } from '../contracts/command';
import type { HostResourceDefinition } from '../resources/definitions';
import type { PageObjectSelector } from '../resources/definitions';
import type { ConfigurationProfileCatalog } from '../resources/profile-configuration';
import {
  isDeclarativeResourceKind,
  type BuiltinResourceKindName,
} from '../resources/kinds';
import type { WorkspaceResourceRecord } from '../resources/workspace-resource-catalog';
import { localResourceDetailPath, presentLocalXnlDetail } from 'halfcode-cli-lite-skill-app-support/resources/confined-resource-file';
import { validateSopSnapshot } from '../sop';
import { optionString, parseJsonInput } from './runtime-flags';

function resources(context: CommandContext) {
  if (!context.runtime.resourceCatalog) throw new Error('Workspace resource catalog is not configured');
  return context.runtime.resourceCatalog;
}

function definitions(context: CommandContext) {
  if (!context.runtime.definitionCatalog) throw new Error('Bundle definition catalog is not configured');
  return context.runtime.definitionCatalog;
}

function configurationProfiles(context: CommandContext): ConfigurationProfileCatalog {
  if (!context.runtime.configurationProfiles) throw new Error('ConfigurationProfile catalog is not configured');
  return context.runtime.configurationProfiles;
}

function sops(context: CommandContext) {
  if (!context.runtime.sop) throw new Error('SOP runtime is not configured');
  return context.runtime.sop;
}

function exactFqn(context: CommandContext, kind: string): string {
  const fqn = optionString(context.options.fqn)?.trim();
  if (!fqn || context.positional.length > 0) throw new Error(`Usage: ${BIN} ${kind} detail --fqn <FQN>`);
  return fqn;
}

async function publicWorkspaceResource(resource: WorkspaceResourceRecord) {
  const { detailPath } = await localResourceDetailPath(resource);
  return Object.freeze({
    kind: resource.kind,
    fqn: resource.fqn,
    description: resource.description,
    packageId: resource.packageId,
    sourceRoot: resource.sourceRoot,
    sourceShape: resource.sourceShape,
    logicalPath: resource.logicalPath,
    detailPath,
    authorityDigest: resource.authorityDigest,
    sourceContentDigest: resource.sourceContentDigest,
    effectiveContentDigest: resource.effectiveContentDigest,
    contentDigest: resource.contentDigest,
    resolution: Object.freeze({
      readerProfileId: resource.readerProfileId,
      source: Object.freeze({
        envelopeVersion: resource.metadata.envelopeVersion,
        specVersion: resource.resolution.writer.specVersion,
        contractFingerprint: resource.resolution.writer.contractFingerprint,
      }),
      reader: Object.freeze({
        readerId: resource.resolution.reader.readerId,
        readerSpecVersion: resource.resolution.reader.specVersion,
        contractFingerprint: resource.resolution.reader.contractFingerprint,
        implementationFingerprint: resource.resolution.reader.implementationFingerprint,
      }),
      sourceContentDigest: resource.sourceContentDigest,
      effectiveContentDigest: resource.effectiveContentDigest,
    }),
  });
}

function isPublicLeafResource(resource: WorkspaceResourceRecord): boolean {
  return resource.kind !== 'SkillApp'
    && resource.kind !== 'SkillModule'
    && !resource.kind.endsWith('Bundle');
}

async function publicDefinition(
  definition: HostResourceDefinition,
  context: CommandContext,
): Promise<Record<string, unknown>> {
  const source = await definitions(context).source(definition.fqn);
  const base = {
    kind: definition.kind,
    fqn: definition.fqn,
    description: definition.description,
    runtimeCapabilities: definition.runtimeCapabilities,
    bundleFqn: source.bundleFqn,
    bundleKind: source.bundleKind,
    packageId: source.packageId,
    sourceRoot: source.sourceRoot,
    logicalPath: source.logicalPath,
  };
  if (definition.kind === 'LocalFunction') return Object.freeze({
    ...base,
    operation: definition.operation,
    inputSchema: definition.inputSchema,
    configSchema: definition.configSchema,
    outputSchema: definition.outputSchema,
  });
  if (definition.kind === 'PageWorkflow') return Object.freeze({
    ...base,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    selectionPolicy: definition.selectionPolicy,
    defaultSelector: definition.defaultSelector,
    ...(definition.activation ? { activation: definition.activation } : {}),
    ...(definition.inputSource ? { inputSource: definition.inputSource } : {}),
    ...(definition.resultTarget ? { resultTarget: definition.resultTarget } : {}),
  });
  if (definition.kind === 'BrowserWebApi') return Object.freeze({
    ...base,
    endpointKey: definition.endpointKey,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
  });
  return Object.freeze({
    ...base,
    selectionPolicy: definition.selectionPolicy,
    ...(definition.defaultSelector ? { defaultSelector: definition.defaultSelector } : {}),
    ...(definition.activation ? { activation: definition.activation } : {}),
    actions: definition.actions.map(({ fqn, description, inputSchema, outputSchema }) => ({
      fqn, description, inputSchema, outputSchema,
    })),
  });
}

export function resourceKindListCommand(kind: BuiltinResourceKindName) {
  return async (context: CommandContext): Promise<CommandResult> => {
    if (context.positional.length > 0) return { code: 1, message: `Usage: ${BIN} ${kind} list` };
    try {
      const entries = isDeclarativeResourceKind(kind)
        ? await Promise.all((await resources(context).list(kind)).map(publicWorkspaceResource))
        : await Promise.all((await definitions(context).list(kind)).map((definition) => publicDefinition(definition, context)));
      return {
        code: 0,
        data: { command: `${kind}.list`, kind, count: entries.length, resources: entries },
        message: entries.length
          ? entries.map((entry) => `${String(entry.fqn)}\t${String(entry.detailPath ?? entry.logicalPath)}`).join('\n')
          : `No ${kind} resources found.`,
      };
    } catch (error) {
      return { code: 1, data: { command: `${kind}.list`, kind, count: 0, resources: [] }, message: error instanceof Error ? error.message : String(error) };
    }
  };
}

export function resourceKindDetailCommand(kind: BuiltinResourceKindName) {
  return async (context: CommandContext): Promise<CommandResult> => {
    try {
      const fqn = exactFqn(context, kind);
      const resource = isDeclarativeResourceKind(kind)
        ? await resources(context).detail(fqn).then(async (entry) => {
          if (entry.kind !== kind) throw new Error(`${fqn} is ${entry.kind}, not ${kind}`);
          const metadata = await publicWorkspaceResource(entry);
          if (entry.format !== 'xnl') return metadata;
          const xnl = await presentLocalXnlDetail(entry);
          return Object.freeze({
            ...metadata,
            xnl: xnl.xnl,
            vfsReferences: xnl.vfsReferences,
            presentation: Object.freeze({
              version: 'local-xnl-vfs-projection/v1',
              contentDigest: entry.contentDigest,
              readCoverage: xnl.readCoverage,
              returnedBytes: xnl.returnedBytes,
            }),
          });
        })
        : await definitions(context).detail(fqn).then((entry) => {
          if (entry.kind !== kind) throw new Error(`${fqn} is ${entry.kind}, not ${kind}`);
          return publicDefinition(entry, context);
        });
      const xnl = typeof (resource as Record<string, unknown>).xnl === 'string'
        ? (resource as Record<string, unknown>).xnl as string
        : undefined;
      return {
        code: 0,
        data: { command: `${kind}.detail`, kind, resource },
        message: xnl ?? `${fqn}\n${String(resource.description)}\n${String(resource.detailPath ?? resource.logicalPath)}`,
      };
    } catch (error) {
      return { code: 1, data: { command: `${kind}.detail`, kind }, message: error instanceof Error ? error.message : String(error) };
    }
  };
}

export function resourceKindValidateCommand(kind: BuiltinResourceKindName) {
  return async (context: CommandContext): Promise<CommandResult> => {
    if (context.positional.length > 0) return { code: 1, message: `Usage: ${BIN} ${kind} validate [--fqn <FQN>]` };
    try {
      const fqn = optionString(context.options.fqn)?.trim();
      if (kind === 'SOP') {
        const result = await sops(context).validate(fqn);
        return {
          code: result.valid ? 0 : 1,
          data: { command: 'SOP.validate', kind, ...result },
          message: result.valid
            ? `${result.count} SOP resource(s) valid.`
            : `SOP validation failed with ${result.diagnostics.length} diagnostic(s).`,
        };
      }
      if (kind === 'ConfigurationProfile') {
        const profiles = await configurationProfiles(context).list();
        const count = fqn ? profiles.filter((profile) => profile.fqn === fqn).length : profiles.length;
        if (fqn && count === 0) throw new Error(`${kind} validation failed: ${fqn}`);
        return { code: 0, data: { command: `${kind}.validate`, kind, valid: true, count }, message: `${count} ${kind} resource(s) valid.` };
      }
      const count = fqn
        ? ((await resourceKindDetailCommand(kind)(context)).code === 0 ? 1 : 0)
        : isDeclarativeResourceKind(kind)
          ? (await resources(context).list(kind)).length
          : (await definitions(context).list(kind)).length;
      if (fqn && count === 0) throw new Error(`${kind} validation failed: ${fqn}`);
      return { code: 0, data: { command: `${kind}.validate`, kind, valid: true, count }, message: `${count} ${kind} resource(s) valid.` };
    } catch (error) {
      return { code: 1, data: { command: `${kind}.validate`, kind, valid: false }, message: error instanceof Error ? error.message : String(error) };
    }
  };
}

export async function resourceValidateCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0) return { code: 1, message: `Usage: ${BIN} Resource validate` };
  try {
    const snapshot = await resources(context).snapshot();
    if (!snapshot.ready) return {
      code: 1,
      data: { command: 'Resource.validate', valid: false, count: 0, diagnostics: snapshot.diagnostics },
      message: `Workspace resource catalog is invalid with ${snapshot.diagnostics.length} diagnostic(s)`,
    };
    const inspected = await context.runtime.inspectWorkspaceApp?.();
    const domain = inspected ? { ready: inspected.ready, appId: inspected.appId,
      memberCount: inspected.memberFiles.length, ownedCount: inspected.ownedFiles.length, findings: inspected.findings } : undefined;
    if (domain && !domain.ready) return {
      code: 1,
      data: { command: 'Resource.validate', valid: false, count: snapshot.resources.filter(isPublicLeafResource).length,
        diagnostics: domain.findings, domain },
      message: `Codument App validation failed with ${domain.findings.filter(item => item.severity === 'error').length} error(s)`,
    };
    await configurationProfiles(context).list();
    const executable = await definitions(context).list();
    const sopValidation = await validateSopSnapshot(snapshot);
    if (!sopValidation.valid) return {
      code: 1,
      data: {
        command: 'Resource.validate',
        valid: false,
        count: snapshot.resources.filter(isPublicLeafResource).length + executable.length,
        diagnostics: sopValidation.diagnostics,
      },
      message: `SOP validation failed with ${sopValidation.diagnostics.length} diagnostic(s)`,
    };
    return {
      code: 0,
      data: { command: 'Resource.validate', valid: true, count: snapshot.resources.filter(isPublicLeafResource).length + executable.length,
        diagnostics: [], ...(domain ? { domain } : {}) },
      message: `${snapshot.resources.filter(isPublicLeafResource).length + executable.length} resource(s) valid.`,
    };
  } catch (error) {
    return { code: 1, data: { command: 'Resource.validate', valid: false }, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function resourceTreeCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0) return { code: 1, message: `Usage: ${BIN} Resource tree` };
  try {
    const snapshot = await resources(context).snapshot();
    if (!snapshot.ready) return { code: 1, data: { command: 'Resource.tree', packages: [], diagnostics: snapshot.diagnostics }, message: 'Workspace resource catalog is invalid' };
    const executable = await definitions(context).list();
    const projected = await Promise.all(executable.map((definition) => publicDefinition(definition, context)));
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const resource of await Promise.all(snapshot.resources.filter(isPublicLeafResource).map(publicWorkspaceResource))) {
      const entries = grouped.get(resource.sourceRoot) ?? [];
      entries.push(resource);
      grouped.set(resource.sourceRoot, entries);
    }
    for (const resource of projected) {
      const sourceRoot = String(resource.sourceRoot);
      const entries = grouped.get(sourceRoot) ?? [];
      entries.push(resource);
      grouped.set(sourceRoot, entries);
    }
    const packages = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceRoot, entries]) => ({ sourceRoot, resources: entries.sort((left, right) => String(left.fqn).localeCompare(String(right.fqn))) }));
    return {
      code: 0,
      data: {
        command: 'Resource.tree',
        readerProfileId: snapshot.readerProfileId,
        contractLock: snapshot.contractLock,
        packages,
        diagnostics: [],
      },
      message: packages.flatMap((item) => [item.sourceRoot, ...item.resources.map((resource) => `  ${String(resource.kind)}\t${String(resource.fqn)}`)]).join('\n') || 'No resources found.',
    };
  } catch (error) {
    return { code: 1, data: { command: 'Resource.tree', packages: [] }, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function pageObjectInvokeCommand(context: CommandContext): Promise<CommandResult> {
  const fqn = optionString(context.options.fqn)?.trim();
  if (!fqn || context.positional.length > 0) return { code: 1, message: `Usage: ${BIN} PageObject invoke --fqn <Action-FQN> [--input <json>]` };
  const input = parseJsonInput(context.options.input);
  if (!input.ok) return { code: 1, data: { command: 'PageObject.invoke', accepted: false, fqn }, message: input.message };
  const selector = parseJsonInput(context.options.selector, 'selector');
  if (!selector.ok) return { code: 1, data: { command: 'PageObject.invoke', accepted: false, fqn }, message: selector.message };
  return invokePageObjectAction(context.runtime, {
    operationRef: fqn,
    actionInput: input.value,
    selector: context.options.selector === undefined ? undefined : selector.value as PageObjectSelector,
  });
}
