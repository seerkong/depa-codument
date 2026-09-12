#!/usr/bin/env bun
import { BIN, DISPLAY_NAME } from '../identity';
import { VERSION } from '../version';
import { commandExecutionPolicy, commandHelp, dispatchCommand, resolveCommandPath, rootHelp } from './command-registry';
import { renderCommandResult } from './output';
import { createCliCommandRuntime } from './runtime';
import { parsePageControlAgent } from './runtime/serve-process';
import { resolveWorkspaceRoot } from './runtime/workspace-root';
import { observeCodumentDomainContext } from 'depa-codument-product-capsule';
import { isCodumentDomainExecution } from 'depa-codument-host-adapter';

interface GlobalArgs {
  commandArgs: string[];
  workspaceDir?: string;
  agent?: string;
  json: boolean;
}

function commandNameOf(args: readonly string[]): string | undefined {
  const flagsWithValue = new Set(['-w', '--workspace-dir', '--agent']);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') break;
    if (arg.startsWith('--') && arg.includes('=')) continue;
    if (flagsWithValue.has(arg)) {
      index++;
      continue;
    }
    if (arg.startsWith('-')) continue;
    return arg;
  }
  return undefined;
}

function parseGlobalArgs(args: string[]): GlobalArgs {
  const commandName = commandNameOf(args);
  const consumePageAgent = ['serve', 'Resource', 'Page', 'LocalFunction', 'PageWorkflow', 'PageObject'].includes(commandName ?? '');
  const commandArgs: string[] = [];
  let workspaceDir: string | undefined;
  let agent: string | undefined;
  let json = false;
  let passthrough = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (passthrough) {
      commandArgs.push(arg);
    } else if (arg === '--') {
      passthrough = true;
      commandArgs.push(arg);
    } else if (arg === '-w' || arg === '--workspace-dir') {
      workspaceDir = args[index + 1];
      if (!workspaceDir) throw new Error(`${arg} requires a directory`);
      index++;
    } else if (arg.startsWith('--workspace-dir=')) {
      workspaceDir = arg.slice('--workspace-dir='.length);
    } else if (consumePageAgent && arg === '--agent') {
      agent = args[index + 1];
      if (!agent) throw new Error(`${arg} requires a name`);
      index++;
    } else if (consumePageAgent && arg.startsWith('--agent=')) {
      agent = arg.slice('--agent='.length);
    } else if (arg === '--json') {
      json = true;
    } else if (arg.startsWith('--json=')) {
      json = arg.slice('--json='.length) !== 'false';
    } else {
      commandArgs.push(arg);
    }
  }
  return { commandArgs, workspaceDir, agent, json };
}

async function main(): Promise<void> {
  const { commandArgs, workspaceDir, agent, json } = parseGlobalArgs(process.argv.slice(2));
  if (commandArgs.length === 0 || commandArgs[0] === '-h' || commandArgs[0] === '--help') {
    console.log(rootHelp());
    return;
  }
  if (commandArgs[0] === '-v' || commandArgs[0] === '--version') {
    renderCommandResult({
      code: 0,
      data: { command: 'version', version: VERSION, bin: BIN },
      message: `${BIN} v${VERSION}`,
    }, { json });
    return;
  }
  const separator = commandArgs.indexOf('--');
  const visibleArgs = separator < 0 ? commandArgs : commandArgs.slice(0, separator);
  if (visibleArgs.some((arg) => arg === '-h' || arg === '--help')) {
    console.log(commandHelp(resolveCommandPath(commandArgs)));
    return;
  }
  const policy = commandExecutionPolicy(commandArgs);
  const commandPath = resolveCommandPath(commandArgs).join(' ');
  const workspaceRoot = await resolveWorkspaceRoot({ explicit: workspaceDir });
  let runtime: ReturnType<typeof createCliCommandRuntime> | undefined;
  try {
    runtime = createCliCommandRuntime(workspaceRoot, policy, {
      json,
      domainContext: policy.runtimeProfile === 'domain' ? await observeCodumentDomainContext(workspaceRoot) : undefined,
      agent: parsePageControlAgent(agent),
      serveChild: Boolean(process.env.CODUMENT_SERVER_INSTANCE_ID) && (commandPath === 'serve' || commandPath === 'serve start'),
    });
    await dispatchCommand(commandArgs, runtime, json);
  }
  catch (error) {
    if (!isCodumentDomainExecution(policy)) throw error;
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
  finally { await runtime?.close?.(); }
}

main().catch((error) => {
  const json = process.argv.includes('--json');
  renderCommandResult({
    code: 1,
    data: { command: 'error', tool: DISPLAY_NAME },
    message: error instanceof Error ? error.message : String(error),
  }, { json });
  process.exit(1);
});
