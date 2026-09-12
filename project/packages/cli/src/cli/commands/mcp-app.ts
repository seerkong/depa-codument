import { renderMcpAppConfig, createMcpAppConnection } from 'depa-codument-mcp-app-capsule';
import { createProcessShutdownSignals } from 'halfcode-cli-lite-cli-host-support/shutdown';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as path from 'node:path';
import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { createCliMcpAppRuntime } from '../runtime/mcp-app';
import { optionString } from './runtime-flags';

export async function mcpAppServeCommand(context: CommandContext): Promise<CommandResult> {
  const transport = optionString(context.options.transport)?.trim() || 'stdio';
  if (transport !== 'stdio' || context.positional.length > 0) {
    return {
      code: 1,
      render: 'none',
      data: { command: 'mcp-app-serve', accepted: false },
      message: `Usage: ${BIN} mcp-app serve --transport stdio`,
    };
  }
  const connection = await createMcpAppConnection(createCliMcpAppRuntime(context.runtime), {
    transport: new StdioServerTransport(),
    log: (message) => console.error(message),
  });
  const unsubscribe = createProcessShutdownSignals().subscribe(() => { void connection.close().catch(() => {}); });
  return {
    code: 0,
    render: 'none',
    data: { command: 'mcp-app-serve', accepted: true, transport },
    wait: connection.closed.finally(unsubscribe),
  };
}

export function mcpAppConfigCommand(context: CommandContext): CommandResult {
  if (context.positional.length > 0) {
    return {
      code: 1,
      data: { command: 'mcp-app-config', mutated: false },
      message: `Usage: ${BIN} mcp-app config`,
    };
  }
  const sourceRuntime = /^bun(?:-debug)?$/.test(path.basename(process.execPath));
  const config = renderMcpAppConfig({
    command: process.execPath,
    serverName: BIN,
    ...(sourceRuntime ? { argsPrefix: [path.resolve(import.meta.dir, '..', 'index.ts')] } : {}),
  });
  return {
    code: 0,
    data: { command: 'mcp-app-config', mutated: false, config },
    message: JSON.stringify(config, null, 2),
  };
}
