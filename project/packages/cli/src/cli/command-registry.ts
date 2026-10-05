import {resourceRuntime, pageRuntime, browserRuntime, clientRuntime, liveRuntime, type ProductionRuntime} from './runtime-profiles';
import {requireResourceFeature} from 'halfcode-lite-resource-capsule';
import { createCodumentProductCommands } from 'depa-codument-product-capsule/commands';
import { bindMcpAppFeature } from './mcp-app-feature';
import { bindServeFeature, bindPageLiveFeature } from './serve-feature';
import { bindPageFeature } from './page-feature';
import { bindBrowserFeature, bindBrowserWebApiFeature } from './browser-feature';
import { bindLocalFunctionFeature } from './local-function-feature';
import { bindResourceFeature } from './resource-feature';
import { BIN, DISPLAY_NAME } from '../identity';
import { executeCommand, resolveCommand, validateCommandTree, validateCommandExecutionPolicies, resolveCommandExecutionPolicy } from 'halfcode-lite-cli-logic';
import type { CommandDefinition as HostCommandDefinition, CommandExecutionPolicy } from 'halfcode-lite-cli-contract';
import { VERSION } from '../version';
import { initCommand } from './commands/init';
import { initGlobalCommand } from './commands/init-global';
import { initWorkspaceCommand } from './commands/init-workspace';
import { statusCommand } from './commands/status';
import { upgradeCommand } from './commands/upgrade';
import { upgradeGlobalCommand } from './commands/upgrade-global';
import { upgradeWorkspaceCommand } from './commands/upgrade-workspace';
import { type CommandDoc, type CommandResult, type CommandRuntime, } from './contracts/command';
import { renderCommandResult } from './output';
import { createCommandRuntime, admitProductExecutionPolicy, type ProductExecutionPolicy } from './runtime';
import { isCodumentDomainExecution } from 'depa-codument-host-adapter';
import { formatCodumentDomainResult } from 'depa-codument-cli-shell';
export type CommandDefinition = HostCommandDefinition<CommandRuntime>;
const helpOption = '-h, --help            Show this help message';
export const COMMANDS: readonly CommandDefinition[] = await createCodumentProductCommands<CommandRuntime>({
    identity: { bin: BIN, displayName: DISPLAY_NAME }, bindResourceFeature, bindLocalFunctionFeature, bindBrowserFeature, bindBrowserWebApiFeature, bindPageFeature, bindServeFeature, bindPageLiveFeature, bindMcpAppFeature, statusCommand, initCommand, initGlobalCommand, initWorkspaceCommand, upgradeCommand, upgradeGlobalCommand, upgradeWorkspaceCommand,
});
validateCommandExecutionPolicies(COMMANDS);
// The legacy tree above admits borrowed test/embedder ports. Executable products use this
// required-profile composition; no Partial<> adapter participates in Resource binding.
export const PRODUCTION_COMMANDS = await createCodumentProductCommands<ProductionRuntime>({
  identity:{bin:BIN,displayName:DISPLAY_NAME},
  bindResourceFeature: runtime => {
    const selected=resourceRuntime(runtime);
    const resource=requireResourceFeature(selected);
    return {...resource,inspectApp:bindResourceFeature(selected).inspectApp};
  },
  bindPageFeature:runtime=>{const selected=pageRuntime(runtime);return {pages:selected.page.pages,resourceCatalog:selected.resourceCatalog};},
  bindLocalFunctionCatalog:runtime=>({localFunctions:resourceRuntime(runtime).localFunctions}),
  bindMcpAppConfig:runtime=>({config:bindMcpAppFeature(runtime).config}),
  bindLocalFunctionFeature:runtime=>{
    if(runtime.profile!=='local-function')throw new Error('LocalFunction execution requires its own profile');
    return bindLocalFunctionFeature(runtime);
  },
  bindBrowserFeature:runtime=>bindBrowserFeature(browserRuntime(runtime)),
  bindBrowserWebApiFeature:runtime=>bindBrowserWebApiFeature(browserRuntime(runtime)),
  bindServeFeature:runtime=>bindServeFeature(clientRuntime(runtime)),
  bindPageLiveFeature:runtime=>bindPageLiveFeature(clientRuntime(runtime)),
  bindMcpAppFeature:runtime=>bindMcpAppFeature(liveRuntime(runtime)),
  statusCommand,initCommand,initGlobalCommand,initWorkspaceCommand,upgradeCommand,upgradeGlobalCommand,upgradeWorkspaceCommand,
});
validateCommandExecutionPolicies(PRODUCTION_COMMANDS);

export function commandExecutionPolicy(args: readonly string[]): ProductExecutionPolicy {
    return admitProductExecutionPolicy(resolveCommandExecutionPolicy(PRODUCTION_COMMANDS, args));
}
export function commandPaths(): string[][] {
    validateCommandTree(COMMANDS);
    const out: string[][] = [];
    const visit = (definitions: readonly CommandDefinition[], prefix: string[]) => {
        for (const definition of definitions) {
            const next = [...prefix, definition.name];
            out.push(next);
            if (definition.children)
                visit(definition.children, next);
        }
    };
    visit(COMMANDS, []);
    return out;
}
export function rootHelp(): string {
    const commands = COMMANDS.map((command) => `  ${command.name.padEnd(20)}${definitionDoc(command).summary}`).join('\n');
    const examples = [
        `${BIN} init --agent=claude,codex,eidolon`,
        `${BIN} status`,
        `${BIN} serve --port 8787`,
    ].map((line) => `  ${line}`).join('\n');
    return `
${DISPLAY_NAME} v${VERSION}

Usage:
  ${BIN} <command> [options]

Commands:
${commands}

Examples:
${examples}

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  -w, --workspace-dir     Set workspace directory (default: current directory)
  --agent <name>          Runtime agent scope; init/global upgrade also accept comma-separated agents (default: codex)
  --json                  Print machine-readable JSON
`;
}
export function commandHelp(path: string[]): string {
    const resolved = resolveDefinition(path);
    if (!resolved)
        return rootHelp();
    const definition = resolved.definition;
    const doc = definitionDoc(definition);
    const usage = doc.usage.map((line) => `  ${line}`).join('\n');
    const examples = doc.examples.map((line) => `  ${line}`).join('\n');
    const children = definition.children?.map((child) => `  ${child.name.padEnd(18)}${definitionDoc(child).summary}`).join('\n');
    const options = [...doc.options, helpOption].map((line) => `  ${line}`).join('\n');
    return `
Usage:
${usage}

${doc.summary}
${children ? `\nCommands:\n${children}\n` : ''}
Examples:
${examples}

Options:
${options}
`;
}
export async function dispatchCommand(args: string[], runtime: CommandRuntime = createCommandRuntime(), json = false): Promise<CommandResult> {
    return dispatchResult(args, await executeCommand(COMMANDS, args, runtime), json);
}
export async function dispatchProductionCommand(args:string[],runtime:ProductionRuntime,json=false):Promise<CommandResult> {
    return dispatchResult(args,await executeCommand(PRODUCTION_COMMANDS,args,runtime),json);
}
async function dispatchResult(args:string[],result:CommandResult,json:boolean):Promise<CommandResult> {
    if (result.render !== 'none') {
        if (isCodumentDomainExecution(commandExecutionPolicy(args))) {
            process.stdout.write(formatCodumentDomainResult(result, json));
            if (result.code !== 0)
                process.exitCode = result.code;
        }
        else
            renderCommandResult(result, { json });
    }
    if (result.wait)
        await result.wait;
    return result;
}
export function resolveCommandPath(args: string[]): string[] {
    const filtered = args.filter((arg) => arg !== '-h' && arg !== '--help');
    const resolved = resolveDefinition(filtered);
    return resolved ? filtered.slice(0, resolved.consumed) : [];
}
function resolveDefinition(args: string[]): {
    definition: CommandDefinition;
    consumed: number;
} | undefined {
    return resolveCommand(COMMANDS, args);
}
function definitionDoc(definition: CommandDefinition): CommandDoc {
    return definition.doc ?? {
        summary: definition.summary,
        usage: definition.usage,
        examples: definition.examples,
        options: definition.options ?? [],
    };
}
