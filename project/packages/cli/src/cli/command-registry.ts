import { BIN, DISPLAY_NAME } from '../identity';
import { appendCommandOperations } from 'halfcode-cli-lite-skill-app-logic/command-operation';
import { createCodumentGuidanceOperations } from 'depa-codument-product-capsule/global-guidance';
import { executeCommand, resolveCommand, validateCommandTree, validateCommandExecutionPolicies, resolveCommandExecutionPolicy } from 'halfcode-cli-lite-cli-host-logic';
import type { CommandDefinition as HostCommandDefinition, CommandExecutionPolicy } from 'halfcode-cli-lite-cli-host-contract';
import { VERSION } from '../version';
import { initCommand } from './commands/init';
import { initGlobalCommand } from './commands/init-global';
import { initWorkspaceCommand } from './commands/init-workspace';
import { execCodeCommand } from './commands/exec-code';
import { invokeCommand } from './commands/invoke';
import { pageListCommand } from './commands/page';
import { pageWorkflowGetCommand, pageWorkflowStartCommand } from './commands/page-workflow';
import { mcpAppConfigCommand, mcpAppServeCommand } from './commands/mcp-app';
import {
  localFunctionDetailCommand,
  localFunctionInvokeCommand,
  localFunctionListCommand,
} from './commands/local-function';
import { runWebApiCommand } from './commands/run-web-api';
import { browserWebApiInvokeCommand } from './commands/browser-web-api';
import {
  pageObjectInvokeCommand,
  resourceKindDetailCommand,
  resourceKindListCommand,
  resourceKindValidateCommand,
  resourceTreeCommand,
  resourceValidateCommand,
} from './commands/resource';
import { serveCommand, serveLifecycleCommand } from './commands/serve';
import { statusCommand } from './commands/status';
import { sopDetailCommand, sopGraphCommand, sopListCommand, sopValidateCommand } from './commands/sop';
import { sopNotebookInitCommand } from './commands/sop-notebook';
import { upgradeCommand } from './commands/upgrade';
import { upgradeGlobalCommand } from './commands/upgrade-global';
import { upgradeWorkspaceCommand } from './commands/upgrade-workspace';
import {
  createArgvSchema,
  type CommandDoc,
  type CommandOption,
  type CommandResult,
  type CommandRun,
  type CommandRuntime,
} from './contracts/command';
import { renderCommandResult } from './output';
import { createCommandRuntime } from './runtime';
import { builtinResourceKind } from './resources/kinds';
import { createCodumentDomainCommands, isCodumentDomainExecution } from 'depa-codument-host-adapter';
import { formatCodumentDomainResult } from 'depa-codument-cli-shell';

export type CommandDefinition = HostCommandDefinition<CommandRuntime>;

const helpOption = '-h, --help            Show this help message';
interface RegistryOption {
  schema: CommandOption;
  help: string;
}

function valueOption(name: string, placeholder: string, description: string, repeatable = false): RegistryOption {
  return {
    schema: { name, kind: 'value', repeatable },
    help: `--${name} <${placeholder}>`.padEnd(26) + description,
  };
}

const jsonOption: RegistryOption = {
  schema: { name: 'json', kind: 'boolean' },
  help: '--json                Print machine-readable JSON',
};

const workspaceOptions: RegistryOption[] = [
  valueOption('agent', 'names', 'Retain project agent instruction/configuration targets.'),
  valueOption('skills-dir', 'path', 'Retain a workspace-local legacy Skill target; guidance is global.'),
  { schema: { name: 'force', kind: 'boolean' }, help: '--force                   Rejected for authority safety; use upgrade-workspace.' },
];
const globalInstallOptions = [valueOption('agent', 'names', 'Install the complete global SkillApp for selected agents.')];

const LOCAL = Object.freeze({ placement: 'local', runtimeProfile: 'basic' } as const);
const CATALOG = Object.freeze({ placement: 'local', runtimeProfile: 'catalog' } as const);
const PAGE_CATALOG = Object.freeze({ placement: 'local', runtimeProfile: 'page-catalog' } as const);
const LOCAL_FUNCTION = Object.freeze({ placement: 'dynamic', runtimeProfile: 'local-function' } as const);
const BROWSER = Object.freeze({ placement: 'dynamic', runtimeProfile: 'browser' } as const);
const SERVE_CLIENT = Object.freeze({ placement: 'serve-required', runtimeProfile: 'serve-client' } as const);
const SERVE_PREFLIGHT = Object.freeze({ placement: 'serve-required', runtimeProfile: 'serve-client-preflight' } as const);
const SERVE_MANAGER = Object.freeze({ placement: 'entrypoint', runtimeProfile: 'serve-manager' } as const);
const MCP = Object.freeze({ placement: 'entrypoint', runtimeProfile: 'mcp-connection' } as const);

function leaf(
  execution: CommandExecutionPolicy,
  name: string,
  summary: string,
  usage: string,
  examples: string[],
  run: CommandRun,
  options: RegistryOption[] = [],
): CommandDefinition {
  const allOptions = [...options, jsonOption];
  const optionHelp = allOptions.map((option) => option.help);
  const doc: CommandDoc = Object.freeze({ summary, usage: [usage], examples, options: optionHelp });
  return {
    name,
    execution,
    summary,
    usage: [usage],
    examples,
    options: optionHelp,
    doc,
    schema: createArgvSchema(usage, [usage], allOptions.map((option) => option.schema)),
    run,
  };
}

function group(
  name: string,
  summary: string,
  usage: string,
  examples: string[],
  children: CommandDefinition[],
  defaultCommand?: Pick<CommandDefinition, 'doc' | 'schema' | 'run' | 'execution'>,
): CommandDefinition {
  const doc: CommandDoc = Object.freeze({ summary, usage: [usage], examples, options: defaultCommand?.doc?.options ?? [] });
  return Object.freeze({
    name,
    summary,
    usage: [usage],
    examples,
    children: Object.freeze(children),
    doc,
    schema: defaultCommand?.schema,
    run: defaultCommand?.run,
    execution: defaultCommand?.execution,
  });
}

function kindSummary(kind: string): string {
  const definition = builtinResourceKind(kind);
  if (!definition) throw new Error(`Unknown built-in resource Kind: ${kind}`);
  return definition.summary;
}

export const COMMANDS: readonly CommandDefinition[] = appendCommandOperations<CommandRuntime>([
  ...createCodumentDomainCommands<CommandRuntime>(),
  leaf({ placement: 'local', runtimeProfile: 'domain' }, 'status', 'Show Codument project, Track and task progress.', `${BIN} status`, [
    `${BIN} status`,
    `${BIN} status --json`,
  ], statusCommand),
  leaf(LOCAL, 'init-global', 'Install the global SkillApp for selected agents.', `${BIN} init-global [--agent <names>]`, [
    `${BIN} init-global`,
    `${BIN} init-global --json`,
  ], initGlobalCommand, globalInstallOptions),
  leaf(LOCAL, 'init-workspace', 'Create the project codument/ SkillApp without global writes.', `${BIN} init-workspace [path]`, [
    `${BIN} init-workspace`,
    `${BIN} init-workspace --json`,
  ], initWorkspaceCommand, workspaceOptions),
  leaf(LOCAL, 'init', `Initialize ${DISPLAY_NAME} global guidance and project assets.`, `${BIN} init [path]`, [
    `${BIN} init`,
    `${BIN} init --json`,
  ], initCommand, workspaceOptions),
  leaf(LOCAL, 'upgrade-global', 'Replace selected agents’ global SkillApp with a backed-up upgrade.', `${BIN} upgrade-global [--agent <names>]`, [
    `${BIN} upgrade-global`,
    `${BIN} upgrade-global --json`,
  ], upgradeGlobalCommand, globalInstallOptions),
  leaf({ placement: 'local', runtimeProfile: 'domain-registry' }, 'upgrade-workspace', 'Migrate the project App with backups and explicit review.', `${BIN} upgrade-workspace`, [
    `${BIN} upgrade-workspace`,
    `${BIN} upgrade-workspace --json`,
  ], upgradeWorkspaceCommand, workspaceOptions),
  leaf(LOCAL, 'upgrade', 'Upgrade global and workspace installation state.', `${BIN} upgrade [--agent <names>]`, [
    `${BIN} upgrade`,
    `${BIN} upgrade --json`,
  ], upgradeCommand, globalInstallOptions),
  group('serve', 'Manage the workspace Hono HTTP server with packaged web assets.', `${BIN} serve <command> [options]`, [
    `${BIN} serve`,
    `${BIN} serve restart`,
    `${BIN} serve status --json`,
  ], [
    leaf(SERVE_MANAGER, 'start', 'Start the workspace server; reuse it when already healthy.', `${BIN} serve start [options]`, [
      `${BIN} serve start --port 8787 --host 127.0.0.1`,
      `${BIN} serve start --json`,
    ], serveLifecycleCommand('start'), [
      valueOption('port', 'n', 'Listen port (0 chooses a free port, default 8787)'),
      valueOption('host', 'addr', 'Bind address (default 127.0.0.1)'),
      valueOption('codex-thread-id', 'id', 'Lock this Serve to the current Codex task at startup'),
    ]),
    leaf(SERVE_MANAGER, 'stop', 'Stop the server recorded for this workspace and agent scope.', `${BIN} serve stop`, [
      `${BIN} serve stop`,
      `${BIN} serve stop --json`,
    ], serveLifecycleCommand('stop')),
    leaf(SERVE_MANAGER, 'restart', 'Stop any recorded server and start a fresh workspace server.', `${BIN} serve restart [options]`, [
      `${BIN} serve restart`,
      `${BIN} serve restart --port 0 --json`,
    ], serveLifecycleCommand('restart'), [
      valueOption('port', 'n', 'Listen port (0 chooses a free port, default 8787)'),
      valueOption('host', 'addr', 'Bind address (default 127.0.0.1)'),
      valueOption('codex-thread-id', 'id', 'Lock this Serve to the current Codex task at startup'),
    ]),
    leaf(SERVE_MANAGER, 'status', 'Show the recorded workspace server status.', `${BIN} serve status`, [
      `${BIN} serve status`,
      `${BIN} serve status --json`,
    ], serveLifecycleCommand('status')),
  ], leaf(SERVE_MANAGER, 'serve', 'Start the workspace server (compatibility entry).', `${BIN} serve [options]`, [
    `${BIN} serve`,
    `${BIN} serve --port 8787 --host 127.0.0.1`,
  ], serveCommand, [
    valueOption('port', 'n', 'Listen port (0 chooses a free port, default 8787)'),
    valueOption('host', 'addr', 'Bind address (default 127.0.0.1)'),
    valueOption('codex-thread-id', 'id', 'Lock this Serve to the current Codex task at startup'),
  ])),
  group('Resource', 'Inspect the complete XNL workspace resource projection.', `${BIN} Resource <command>`, [
    `${BIN} Resource tree --json`,
    `${BIN} Resource validate --json`,
  ], [
    leaf(CATALOG, 'tree', 'Show resources grouped by package provenance.', `${BIN} Resource tree`, [
      `${BIN} Resource tree --json`,
    ], resourceTreeCommand),
    leaf(CATALOG, 'validate', 'Validate the workspace and executable definition catalogs.', `${BIN} Resource validate`, [
      `${BIN} Resource validate --json`,
    ], resourceValidateCommand),
  ]),
  group('SOP', kindSummary('SOP'), `${BIN} SOP <command>`, [
    `${BIN} SOP list --json`,
    `${BIN} SOP detail --fqn Codument.Demo.SOP.GoogleSearch --json`,
  ], [
    leaf(CATALOG, 'list', 'List SOP resource summaries.', `${BIN} SOP list`, [
      `${BIN} SOP list --json`,
    ], sopListCommand),
    leaf(CATALOG, 'detail', 'Show one validated SOP resource by exact FQN.', `${BIN} SOP detail --fqn <FQN>`, [
      `${BIN} SOP detail --fqn Codument.Demo.SOP.GoogleSearch --json`,
    ], sopDetailCommand, [valueOption('fqn', 'FQN', 'Exact SOP FQN')]),
    leaf(CATALOG, 'validate', 'Validate installed SOP resources.', `${BIN} SOP validate [--fqn <FQN>]`, [
      `${BIN} SOP validate --json`,
    ], sopValidateCommand, [valueOption('fqn', 'FQN', 'Optional exact SOP FQN')]),
    leaf(CATALOG, 'graph', 'Project one valid typed-pipeline SOP as deterministic Mermaid.', `${BIN} SOP graph --fqn <FQN>`, [
      `${BIN} SOP graph --fqn Codument.Demo.SOP.Pipeline`,
    ], sopGraphCommand, [valueOption('fqn', 'FQN', 'Exact typed-pipeline SOP FQN')]),
    group('notebook', 'Materialize private sparse run-state Notebooks.', `${BIN} SOP notebook <command>`, [
      `${BIN} SOP notebook init --fqn Codument.Demo.SOP.Pipeline`,
    ], [
      leaf(CATALOG, 'init', 'Create or explicitly reset one exact-FQN SOP Notebook.', `${BIN} SOP notebook init --fqn <FQN> [--reset]`, [
        `${BIN} SOP notebook init --fqn Codument.Demo.SOP.Pipeline --json`,
      ], sopNotebookInitCommand, [
        valueOption('fqn', 'FQN', 'Exact typed-pipeline SOP FQN'),
        { schema: { name: 'reset', kind: 'boolean' }, help: '--reset               Atomically replace an existing Notebook' },
      ]),
    ]),
  ]),
  group('Site', kindSummary('Site'), `${BIN} Site <command>`, [
    `${BIN} Site list --json`,
    `${BIN} Site detail --fqn Codument.Demo.Site.Main --json`,
  ], [
    leaf(CATALOG, 'list', 'List Site resource summaries.', `${BIN} Site list`, [
      `${BIN} Site list --json`,
    ], resourceKindListCommand('Site')),
    leaf(CATALOG, 'detail', 'Show one Site resource by exact FQN.', `${BIN} Site detail --fqn <FQN>`, [
      `${BIN} Site detail --fqn Codument.Demo.Site.Main --json`,
    ], resourceKindDetailCommand('Site'), [valueOption('fqn', 'FQN', 'Exact Site FQN')]),
    leaf(CATALOG, 'validate', 'Validate installed Site resources.', `${BIN} Site validate [--fqn <FQN>]`, [
      `${BIN} Site validate --json`,
    ], resourceKindValidateCommand('Site'), [valueOption('fqn', 'FQN', 'Optional exact Site FQN')]),
  ]),
  group('PageBundle', kindSummary('PageBundle'), `${BIN} PageBundle <command>`, [
    `${BIN} PageBundle list --json`,
    `${BIN} PageBundle detail --fqn Codument.Demo.PageBundle.HtmlGuide --json`,
  ], [
    leaf(CATALOG, 'list', 'List PageBundle resource summaries.', `${BIN} PageBundle list`, [
      `${BIN} PageBundle list --json`,
    ], resourceKindListCommand('PageBundle')),
    leaf(CATALOG, 'detail', 'Show one PageBundle resource by exact FQN.', `${BIN} PageBundle detail --fqn <FQN>`, [
      `${BIN} PageBundle detail --fqn Codument.Demo.PageBundle.HtmlGuide --json`,
    ], resourceKindDetailCommand('PageBundle'), [valueOption('fqn', 'FQN', 'Exact PageBundle FQN')]),
    leaf(CATALOG, 'validate', 'Validate installed PageBundle resources.', `${BIN} PageBundle validate [--fqn <FQN>]`, [
      `${BIN} PageBundle validate --json`,
    ], resourceKindValidateCommand('PageBundle'), [valueOption('fqn', 'FQN', 'Optional exact PageBundle FQN')]),
  ]),
  group('Page', kindSummary('Page'), `${BIN} Page <command>`, [
    `${BIN} Page list --json`,
    `${BIN} Page detail --fqn Codument.Demo.Page.GoogleSearch --json`,
  ], [
    leaf(PAGE_CATALOG, 'list', 'List Page runtime projections.', `${BIN} Page list`, [
      `${BIN} Page list --json`,
    ], pageListCommand),
    leaf(CATALOG, 'detail', 'Show one XNL Page resource by exact FQN.', `${BIN} Page detail --fqn <FQN>`, [
      `${BIN} Page detail --fqn Codument.Demo.Page.GoogleSearch --json`,
    ], resourceKindDetailCommand('Page'), [valueOption('fqn', 'FQN', 'Exact Page FQN')]),
    leaf(CATALOG, 'validate', 'Validate installed Page resources.', `${BIN} Page validate [--fqn <FQN>]`, [
      `${BIN} Page validate --json`,
    ], resourceKindValidateCommand('Page'), [valueOption('fqn', 'FQN', 'Optional exact Page FQN')]),
  ]),
  group('mcp-app', 'Expose registered business pages to MCP Apps-capable hosts.', `${BIN} mcp-app <command>`, [
    `${BIN} mcp-app serve --transport stdio`,
    `${BIN} mcp-app config --json`,
  ], [
    leaf(MCP, 'serve', 'Start the MCP App server over stdio.', `${BIN} mcp-app serve [options]`, [
      `${BIN} mcp-app serve --transport stdio`,
    ], mcpAppServeCommand, [
      valueOption('transport', 'name', 'MCP transport (stdio only)'),
    ]),
    leaf(LOCAL, 'config', 'Print a copy-only Claude Desktop MCP server snippet.', `${BIN} mcp-app config`, [
      `${BIN} mcp-app config --json`,
    ], mcpAppConfigCommand),
  ]),
  group('LocalFunction', kindSummary('LocalFunction'), `${BIN} LocalFunction <command>`, [
    `${BIN} LocalFunction list --json`,
    `${BIN} LocalFunction detail --fqn Codument.Example.LocalFunction.Query --json`,
    `${BIN} LocalFunction invoke --fqn Codument.Example.LocalFunction.Query --input '{"id":"example"}' --json`,
  ], [
    leaf(CATALOG, 'list', 'List merged LocalFunction metadata.', `${BIN} LocalFunction list [--operation <kind>]`, [
      `${BIN} LocalFunction list`,
      `${BIN} LocalFunction list --operation query --json`,
    ], localFunctionListCommand, [valueOption('operation', 'query|detail|action', 'Filter by operation kind')]),
    leaf(CATALOG, 'detail', 'Show one LocalFunction definition and its typed schemas.', `${BIN} LocalFunction detail --fqn <FQN>`, [
      `${BIN} LocalFunction detail --fqn Codument.Example.LocalFunction.Query --json`,
    ], localFunctionDetailCommand, [valueOption('fqn', 'FQN', 'Exact Local Function FQN')]),
    leaf(CATALOG, 'validate', 'Validate installed LocalFunction definitions.', `${BIN} LocalFunction validate [--fqn <FQN>]`, [
      `${BIN} LocalFunction validate --json`,
    ], resourceKindValidateCommand('LocalFunction'), [valueOption('fqn', 'FQN', 'Optional exact LocalFunction FQN')]),
    leaf(LOCAL_FUNCTION, 'invoke', 'Invoke a typed LocalFunction through the host dispatcher.', `${BIN} LocalFunction invoke --fqn <FQN> [--input <json>] [--config <json>] [--profile <name>]`, [
      `${BIN} LocalFunction invoke --fqn Codument.Example.LocalFunction.Query --input '{"id":"example"}' --config null --profile personal --json`,
    ], localFunctionInvokeCommand, [
      valueOption('fqn', 'FQN', 'Exact Local Function FQN'),
      valueOption('input', 'json', 'Typed JSON input (default {})'),
      valueOption('config', 'json', 'Per-call JSON config (default null)'),
      valueOption('profile', 'name', 'ConfigurationProfile selector; never enters business input/config'),
    ]),
  ]),
  group('ConfigurationProfile', kindSummary('ConfigurationProfile'), `${BIN} ConfigurationProfile <command>`, [
    `${BIN} ConfigurationProfile list --json`,
  ], [
    leaf(CATALOG, 'list', 'List ConfigurationProfile resources.', `${BIN} ConfigurationProfile list`, [`${BIN} ConfigurationProfile list --json`], resourceKindListCommand('ConfigurationProfile')),
    leaf(CATALOG, 'detail', 'Show one ConfigurationProfile resource.', `${BIN} ConfigurationProfile detail --fqn <FQN>`, [`${BIN} ConfigurationProfile detail --fqn Example.ConfigurationProfile.Personal --json`], resourceKindDetailCommand('ConfigurationProfile'), [valueOption('fqn', 'FQN', 'Exact ConfigurationProfile FQN')]),
    leaf(CATALOG, 'validate', 'Validate ConfigurationProfile resources.', `${BIN} ConfigurationProfile validate [--fqn <FQN>]`, [`${BIN} ConfigurationProfile validate --json`], resourceKindValidateCommand('ConfigurationProfile'), [valueOption('fqn', 'FQN', 'Optional exact ConfigurationProfile FQN')]),
  ]),
  group('DatabaseConnection', kindSummary('DatabaseConnection'), `${BIN} DatabaseConnection <command>`, [
    `${BIN} DatabaseConnection list --json`,
  ], [
    leaf(CATALOG, 'list', 'List DatabaseConnection resources.', `${BIN} DatabaseConnection list`, [`${BIN} DatabaseConnection list --json`], resourceKindListCommand('DatabaseConnection')),
    leaf(CATALOG, 'detail', 'Show one DatabaseConnection resource.', `${BIN} DatabaseConnection detail --fqn <FQN>`, [`${BIN} DatabaseConnection detail --fqn Example.Database.LocalCache --json`], resourceKindDetailCommand('DatabaseConnection'), [valueOption('fqn', 'FQN', 'Exact DatabaseConnection FQN')]),
    leaf(CATALOG, 'validate', 'Validate DatabaseConnection resources.', `${BIN} DatabaseConnection validate [--fqn <FQN>]`, [`${BIN} DatabaseConnection validate --json`], resourceKindValidateCommand('DatabaseConnection'), [valueOption('fqn', 'FQN', 'Optional exact DatabaseConnection FQN')]),
  ]),
  group('BrowserWebApi', kindSummary('BrowserWebApi'), `${BIN} BrowserWebApi <command>`, [
    `${BIN} BrowserWebApi invoke --fqn Example.BrowserWebApi.Records --profile personal --json`,
  ], [
    leaf(CATALOG, 'list', 'List BrowserWebApi resources.', `${BIN} BrowserWebApi list`, [`${BIN} BrowserWebApi list --json`], resourceKindListCommand('BrowserWebApi')),
    leaf(CATALOG, 'detail', 'Show one BrowserWebApi resource.', `${BIN} BrowserWebApi detail --fqn <FQN>`, [`${BIN} BrowserWebApi detail --fqn Example.BrowserWebApi.Records --json`], resourceKindDetailCommand('BrowserWebApi'), [valueOption('fqn', 'FQN', 'Exact BrowserWebApi FQN')]),
    leaf(CATALOG, 'validate', 'Validate BrowserWebApi resources.', `${BIN} BrowserWebApi validate [--fqn <FQN>]`, [`${BIN} BrowserWebApi validate --json`], resourceKindValidateCommand('BrowserWebApi'), [valueOption('fqn', 'FQN', 'Optional exact BrowserWebApi FQN')]),
    leaf(BROWSER, 'invoke', 'Invoke a BrowserWebApi through the workspace-selected provider.', `${BIN} BrowserWebApi invoke --fqn <FQN> [--input <json>] [--profile <name>]`, [`${BIN} BrowserWebApi invoke --fqn Example.BrowserWebApi.Records --profile personal --json`], browserWebApiInvokeCommand, [valueOption('fqn', 'FQN', 'Exact BrowserWebApi FQN'), valueOption('input', 'json', 'Typed JSON input (default {})'), valueOption('profile', 'name', 'ConfigurationProfile selector'), valueOption('session', 'name', 'Browser provider session name')]),
  ]),
  group('PageWorkflow', kindSummary('PageWorkflow'), `${BIN} PageWorkflow <command>`, [
    `${BIN} PageWorkflow list --json`,
    `${BIN} PageWorkflow start --fqn Codument.GoogleSearch.Workflow.Search --input '{"query":"agentic workflows"}' --json`,
    `${BIN} PageWorkflow get --run-id pwr_example --json`,
  ], [
    leaf(CATALOG, 'list', 'List PageWorkflow definition summaries.', `${BIN} PageWorkflow list`, [
      `${BIN} PageWorkflow list --json`,
    ], resourceKindListCommand('PageWorkflow')),
    leaf(CATALOG, 'detail', 'Show one PageWorkflow definition by exact FQN.', `${BIN} PageWorkflow detail --fqn <FQN>`, [
      `${BIN} PageWorkflow detail --fqn Codument.GoogleSearch.Workflow.Search --json`,
    ], resourceKindDetailCommand('PageWorkflow'), [valueOption('fqn', 'FQN', 'Exact PageWorkflow FQN')]),
    leaf(CATALOG, 'validate', 'Validate installed PageWorkflow definitions.', `${BIN} PageWorkflow validate [--fqn <FQN>]`, [
      `${BIN} PageWorkflow validate --json`,
    ], resourceKindValidateCommand('PageWorkflow'), [valueOption('fqn', 'FQN', 'Optional exact PageWorkflow FQN')]),
    leaf(SERVE_PREFLIGHT, 'start', 'Start a PageWorkflow and return its run receipt immediately.', `${BIN} PageWorkflow start --fqn <FQN> [options]`, [
      `${BIN} PageWorkflow start --fqn Codument.GoogleSearch.Workflow.Search --input '{"query":"agentic workflows"}' --json`,
    ], pageWorkflowStartCommand, [
      valueOption('fqn', 'FQN', 'Installed PageWorkflow FQN'),
      valueOption('selector', 'json', 'Closed PageWorkflow selector (definition default when omitted)'),
      valueOption('input', 'json', 'JSON object passed to the PageWorkflow (default {})'),
    ]),
    leaf(SERVE_CLIENT, 'get', 'Get an asynchronous PageWorkflow run receipt.', `${BIN} PageWorkflow get --run-id <runId>`, [
      `${BIN} PageWorkflow get --run-id pwr_example --json`,
    ], pageWorkflowGetCommand, [valueOption('run-id', 'id', 'Run id returned by PageWorkflow start')]),
  ]),
  group('PageObject', kindSummary('PageObject'), `${BIN} PageObject <command>`, [
    `${BIN} PageObject list --json`,
    `${BIN} PageObject invoke --fqn Codument.GoogleSearch.Page.Results.extract --input '{}' --json`,
  ], [
    leaf(CATALOG, 'list', 'List PageObject definition summaries.', `${BIN} PageObject list`, [
      `${BIN} PageObject list --json`,
    ], resourceKindListCommand('PageObject')),
    leaf(CATALOG, 'detail', 'Show one PageObject definition by exact FQN.', `${BIN} PageObject detail --fqn <FQN>`, [
      `${BIN} PageObject detail --fqn Codument.GoogleSearch.Page.Results --json`,
    ], resourceKindDetailCommand('PageObject'), [valueOption('fqn', 'FQN', 'Exact PageObject FQN')]),
    leaf(CATALOG, 'validate', 'Validate installed PageObject definitions.', `${BIN} PageObject validate [--fqn <FQN>]`, [
      `${BIN} PageObject validate --json`,
    ], resourceKindValidateCommand('PageObject'), [valueOption('fqn', 'FQN', 'Optional exact PageObject FQN')]),
    leaf(SERVE_CLIENT, 'invoke', 'Invoke one PageObject action by exact action FQN.', `${BIN} PageObject invoke --fqn <Action-FQN> [--input <json>]`, [
      `${BIN} PageObject invoke --fqn Codument.GoogleSearch.Page.Results.extract --input '{}' --json`,
    ], pageObjectInvokeCommand, [
      valueOption('fqn', 'Action-FQN', 'Exact PageObject action FQN'),
      valueOption('selector', 'json', 'Closed PageObject selector (definition default when omitted)'),
      valueOption('input', 'json', 'JSON object passed to the PageObject action (default {})'),
    ]),
  ]),
  leaf(BROWSER, 'run-web-api', 'Run a compiled Web API module through the selected browser provider.', `${BIN} run-web-api <module> [options]`, [
    `${BIN} run-web-api ./web-api.js --input '{"pageNum":1,"pageSize":20}' --json`,
    `${BIN} run-web-api ./web-api.js --transport opencli --opencli-transport plugin --json`,
  ], runWebApiCommand, [
    valueOption('input', 'json', 'JSON object passed to the module default export'),
    valueOption('transport', 'name', 'Browser provider override: ego-browser, opencli, or mdd-browser-robot'),
    valueOption('opencli-transport', 'name', 'OpenCLI subtransport: plugin or browser-eval'),
    valueOption('session', 'name', 'Selected browser provider session name'),
  ]),
  leaf(BROWSER, 'invoke', 'Run a compiled capability by FQN through the selected browser provider.', `${BIN} invoke --fqn <FQN> [options]`, [
    `${BIN} invoke --fqn Example.Namespace.Operation --skills-dir .agents/skills --input '{"pageNum":1,"pageSize":20}' --json`,
    `${BIN} invoke --fqn Example.Namespace.Operation --skills-dir ./skills/example-skill --json`,
  ], invokeCommand, [
    valueOption('fqn', 'FQN', 'Capability FQN from browser-functions/registry.json'),
    valueOption('input', 'json', 'JSON object passed to the module default export'),
    valueOption('skills-dir', 'path', 'Agent-supplied scan root (repeatable; skill dir or skills root). Not the init destination', true),
    valueOption('registry', 'file', 'Debug: explicit registry.json path'),
    valueOption('capsule', 'dir', 'Debug: skill or dist directory that contains browser-functions/'),
    valueOption('transport', 'name', 'Browser provider override: ego-browser, opencli, or mdd-browser-robot'),
    valueOption('opencli-transport', 'name', 'OpenCLI subtransport: plugin or browser-eval'),
    valueOption('session', 'name', 'Selected browser provider session name'),
  ]),
  leaf(BROWSER, 'exec', 'Debug-only: evaluate an expression against the compiled bundle runners.', `${BIN} exec --code <expression> [options]`, [
    `${BIN} exec --code '(async () => run_web_api("Example.Namespace.Operation", {"pageNum":1}))()' --skills-dir .agents/skills --json`,
  ], execCodeCommand, [
    valueOption('code', 'expression', 'JavaScript expression; typically an async IIFE using run_web_api'),
    valueOption('skills-dir', 'path', 'Agent-supplied scan root (repeatable; skill dir or skills root). Not the init destination', true),
    valueOption('registry', 'file', 'Debug: explicit registry.json path'),
    valueOption('capsule', 'dir', 'Debug: skill or dist directory that contains browser-functions/'),
    valueOption('transport', 'name', 'Browser provider override: ego-browser, opencli, or mdd-browser-robot'),
    valueOption('opencli-transport', 'name', 'OpenCLI subtransport: plugin or browser-eval'),
    valueOption('session', 'name', 'Selected browser provider session name'),
  ]),
], await createCodumentGuidanceOperations(), { bin: BIN, runtimeProfile: 'basic' });

validateCommandExecutionPolicies(COMMANDS);

export function commandExecutionPolicy(args: readonly string[]): CommandExecutionPolicy {
  return resolveCommandExecutionPolicy(COMMANDS, args);
}

export function commandPaths(): string[][] {
  validateCommandTree(COMMANDS);
  const out: string[][] = [];
  const visit = (definitions: readonly CommandDefinition[], prefix: string[]) => {
    for (const definition of definitions) {
      const next = [...prefix, definition.name];
      out.push(next);
      if (definition.children) visit(definition.children, next);
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
  if (!resolved) return rootHelp();
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

export async function dispatchCommand(
  args: string[],
  runtime: CommandRuntime = createCommandRuntime(),
  json = false,
): Promise<CommandResult> {
  const result = await executeCommand(COMMANDS, args, runtime);
  if (result.render !== 'none') {
    if (isCodumentDomainExecution(commandExecutionPolicy(args))) {
      process.stdout.write(formatCodumentDomainResult(result, json));
      if (result.code !== 0) process.exitCode = result.code;
    } else renderCommandResult(result, { json });
  }
  if (result.wait) await result.wait;
  return result;
}

export function resolveCommandPath(args: string[]): string[] {
  const filtered = args.filter((arg) => arg !== '-h' && arg !== '--help');
  const resolved = resolveDefinition(filtered);
  return resolved ? filtered.slice(0, resolved.consumed) : [];
}

function resolveDefinition(args: string[]): { definition: CommandDefinition; consumed: number } | undefined {
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
