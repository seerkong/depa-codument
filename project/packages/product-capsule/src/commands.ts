import { createManagementCommands } from 'halfcode-lite-management-capsule';
import { createMcpAppCommands } from 'halfcode-lite-mcp-app-capsule/commands';
import { createServeCommands, createPageLiveCommands } from 'halfcode-lite-serve-capsule';
import { createPageInspectionCommands } from 'halfcode-lite-page-capsule';
import { createBrowserCommands, createBrowserWebApiCommands } from 'halfcode-lite-browser-capsule';
import { createLocalFunctionCommands } from 'halfcode-lite-local-function-capsule';
import { createResourceCommands, createSopCommands, createResourceKindCommands } from 'halfcode-lite-resource-capsule';
import { valueOption, type RegistryOption, bindCommandRuntime, validateCommandTree, validateCommandExecutionPolicies } from 'halfcode-lite-cli-logic';
import { createResourceHandlers } from 'halfcode-lite-resource-capsule';
import { builtinResourceKind, type BuiltinResourceKindName } from 'halfcode-lite-skill-app-logic/resources/kinds';
import type { CommandDefinition, CommandRun } from 'halfcode-lite-cli-contract';
import { createCodumentDomainCommands, type CodumentDomainCommandRuntime } from 'depa-codument-host-adapter';
import { appendCommandOperations } from 'halfcode-lite-skill-app-logic/command-operation';
import { createCodumentGuidanceOperations } from './global-guidance';
export interface ProductCommandBindings<R extends CodumentDomainCommandRuntime> {
    readonly identity: {
        readonly bin: string;
        readonly displayName: string;
    };
    readonly bindLocalFunctionCatalog?: Parameters<typeof createLocalFunctionCommands<R>>[0]['bindCatalog'];
    readonly bindMcpAppConfig?: Parameters<typeof createMcpAppCommands<R>>[0]['bindConfig'];
    readonly bindResourceFeature: Parameters<typeof createResourceCommands<R>>[0]['bind'];
    readonly bindLocalFunctionFeature: Parameters<typeof createLocalFunctionCommands<R>>[0]['bind'];
    readonly bindBrowserFeature: Parameters<typeof createBrowserCommands<R>>[0]['bind'];
    readonly bindBrowserWebApiFeature: Parameters<typeof createBrowserWebApiCommands<R>>[0]['bind'];
    readonly bindPageFeature: Parameters<typeof createPageInspectionCommands<R>>[0]['bind'];
    readonly bindServeFeature: Parameters<typeof createServeCommands<R>>[0]['bind'];
    readonly bindPageLiveFeature: Parameters<typeof createPageLiveCommands<R>>[0]['bind'];
    readonly bindMcpAppFeature: Parameters<typeof createMcpAppCommands<R>>[0]['bind'];
    readonly statusCommand: CommandRun<R>;
    readonly initCommand: CommandRun<R>;
    readonly initGlobalCommand: CommandRun<R>;
    readonly initWorkspaceCommand: CommandRun<R>;
    readonly upgradeCommand: CommandRun<R>;
    readonly upgradeGlobalCommand: CommandRun<R>;
    readonly upgradeWorkspaceCommand: CommandRun<R>;
}
/** Product owns feature selection, domain policies and exposure; caller supplies environment bindings.
 * Commands borrow runtime facets. Their lifetime stays with the invocation/Serve/MCP owner.
 */
export async function createCodumentProductCommands<R extends CodumentDomainCommandRuntime>(bindings: ProductCommandBindings<R>) {
    const { bin: BIN, displayName: DISPLAY_NAME } = bindings.identity;
    const { bindResourceFeature, bindLocalFunctionFeature, bindBrowserFeature, bindBrowserWebApiFeature, bindPageFeature, bindServeFeature, bindPageLiveFeature, bindMcpAppFeature, statusCommand, initCommand, initGlobalCommand, initWorkspaceCommand, upgradeCommand, upgradeGlobalCommand, upgradeWorkspaceCommand } = bindings;
    const handlers = createResourceHandlers(BIN);
    const resourceKindListCommand = (kind: BuiltinResourceKindName) => bindCommandRuntime(handlers.resourceKindListCommand(kind), bindResourceFeature);
    const resourceKindDetailCommand = (kind: BuiltinResourceKindName) => bindCommandRuntime(handlers.resourceKindDetailCommand(kind), bindResourceFeature);
    const resourceKindValidateCommand = (kind: BuiltinResourceKindName) => bindCommandRuntime(handlers.resourceKindValidateCommand(kind), bindResourceFeature);
    const workspaceOptions: RegistryOption[] = [
        valueOption('agent', 'names', 'Retain project agent instruction/configuration targets.'),
        valueOption('skills-dir', 'path', 'Retain a workspace-local legacy Skill target; guidance is global.'),
        { schema: { name: 'force', kind: 'boolean' }, help: '--force                   Rejected for authority safety; use upgrade-workspace.' },
    ];
    const globalInstallOptions = [valueOption('agent', 'names', 'Install the complete global SkillApp for selected agents.')];
    const LOCAL = Object.freeze({ placement: 'local', runtimeProfile: 'basic' } as const);
    const SERVE_PREFLIGHT = Object.freeze({ placement: 'serve-required', runtimeProfile: 'serve-client-preflight' } as const);
    function kindSummary(kind: string): string {
        const definition = builtinResourceKind(kind);
        if (!definition)
            throw new Error(`Unknown built-in resource Kind: ${kind}`);
        return definition.summary;
    }
    const commands: readonly CommandDefinition<R>[] = appendCommandOperations<R>([
        ...createCodumentDomainCommands<R>(),
        ...createManagementCommands<R>([{ execution: { placement: 'local', runtimeProfile: 'domain' }, name: 'status', summary: 'Show Codument project, Track and task progress.', usage: `${BIN} status`, examples: [
                    `${BIN} status`,
                    `${BIN} status --json`,
                ], run: statusCommand }]),
        ...createManagementCommands<R>([{ execution: LOCAL, name: 'init-global', summary: 'Install the global SkillApp for selected agents.', usage: `${BIN} init-global [--agent <names>]`, examples: [
                    `${BIN} init-global`,
                    `${BIN} init-global --json`,
                ], run: initGlobalCommand, options: globalInstallOptions }]),
        ...createManagementCommands<R>([{ execution: LOCAL, name: 'init-workspace', summary: 'Create the project codument/ SkillApp without global writes.', usage: `${BIN} init-workspace [path]`, examples: [
                    `${BIN} init-workspace`,
                    `${BIN} init-workspace --json`,
                ], run: initWorkspaceCommand, options: workspaceOptions }]),
        ...createManagementCommands<R>([{ execution: LOCAL, name: 'init', summary: `Initialize ${DISPLAY_NAME} global guidance and project assets.`, usage: `${BIN} init [path]`, examples: [
                    `${BIN} init`,
                    `${BIN} init --json`,
                ], run: initCommand, options: workspaceOptions }]),
        ...createManagementCommands<R>([{ execution: LOCAL, name: 'upgrade-global', summary: 'Replace selected agents’ global SkillApp with a backed-up upgrade.', usage: `${BIN} upgrade-global [--agent <names>]`, examples: [
                    `${BIN} upgrade-global`,
                    `${BIN} upgrade-global --json`,
                ], run: upgradeGlobalCommand, options: globalInstallOptions }]),
        ...createManagementCommands<R>([{ execution: { placement: 'local', runtimeProfile: 'domain-registry' }, name: 'upgrade-workspace', summary: 'Migrate the project App with backups and explicit review.', usage: `${BIN} upgrade-workspace`, examples: [
                    `${BIN} upgrade-workspace`,
                    `${BIN} upgrade-workspace --json`,
                ], run: upgradeWorkspaceCommand, options: workspaceOptions }]),
        ...createManagementCommands<R>([{ execution: LOCAL, name: 'upgrade', summary: 'Upgrade global and workspace installation state.', usage: `${BIN} upgrade [--agent <names>]`, examples: [
                    `${BIN} upgrade`,
                    `${BIN} upgrade --json`,
                ], run: upgradeCommand, options: globalInstallOptions }]),
        ...createServeCommands<R>({ bin: BIN, bind: bindServeFeature }),
        ...createResourceCommands<R>({ bin: BIN, bind: bindResourceFeature }),
        ...createSopCommands<R>({ bin: BIN, bind: bindResourceFeature }),
        ...createPageInspectionCommands<R>({ bin: BIN, bind: bindPageFeature, resourceKindListCommand, resourceKindDetailCommand, resourceKindValidateCommand, kindSummary }),
        ...createMcpAppCommands<R>({ bin: BIN, bind: bindMcpAppFeature, bindConfig: bindings.bindMcpAppConfig }),
        ...createLocalFunctionCommands<R>({ bin: BIN, bind: bindLocalFunctionFeature, bindCatalog: bindings.bindLocalFunctionCatalog, validate: resourceKindValidateCommand('LocalFunction') }),
        ...createResourceKindCommands<R>({ bin: BIN, bind: bindResourceFeature, kind: 'ConfigurationProfile', summary: kindSummary('ConfigurationProfile'), exampleFqn: 'Example.ConfigurationProfile.Personal' }),
        ...createResourceKindCommands<R>({ bin: BIN, bind: bindResourceFeature, kind: 'DatabaseConnection', summary: kindSummary('DatabaseConnection'), exampleFqn: 'Example.Database.LocalCache' }),
        ...createBrowserWebApiCommands<R>({ bin: BIN, bind: bindBrowserWebApiFeature, resourceKindListCommand, resourceKindDetailCommand, resourceKindValidateCommand }),
        ...createPageLiveCommands<R>({ bin: BIN, bind: bindPageLiveFeature, workflowStartPolicy: SERVE_PREFLIGHT, resourceKindListCommand, resourceKindDetailCommand, resourceKindValidateCommand, kindSummary }),
        ...createBrowserCommands<R>({ bin: BIN, bind: bindBrowserFeature }),
    ], await createCodumentGuidanceOperations(), { bin: BIN, runtimeProfile: 'basic' });
    validateCommandTree(commands);
    validateCommandExecutionPolicies(commands);
    return commands;
}
