import { admitLegacyResourceFeature } from 'halfcode-lite-resource-capsule';
import type { CommandContext, CommandRuntime } from './contracts/command';
export function bindResourceFeature(runtime: CommandRuntime) {
    const base = admitLegacyResourceFeature(runtime);
    return { ...base, inspectApp: async () => {
            const inspected = await runtime.inspectWorkspaceApp?.();
            if (!inspected)
                return undefined;
            const domain = { ready: inspected.ready, appId: inspected.appId, memberCount: inspected.memberFiles.length, ownedCount: inspected.ownedFiles.length, findings: inspected.findings };
            return { valid: domain.ready, diagnostics: domain.findings, data: { domain }, message: `Codument App validation failed with ${domain.findings.filter(item => item.severity === 'error').length} error(s)` };
        } };
}
export function resourceContext(context: CommandContext) { return { ...context, runtime: bindResourceFeature(context.runtime) }; }
