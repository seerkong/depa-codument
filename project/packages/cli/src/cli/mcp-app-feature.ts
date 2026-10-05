import * as path from 'node:path';
import type { McpAppCommandRuntime } from 'halfcode-lite-mcp-app-capsule/commands';
import { createStdioMcpAppConnection } from 'halfcode-lite-mcp-app-capsule/stdio';
import { createProcessShutdownSignals } from 'halfcode-lite-cli-support/shutdown';
import type { CommandRuntime } from './contracts/command';
import { createCliMcpAppRuntime } from './runtime/mcp-app';
export function bindMcpAppFeature(runtime: CommandRuntime): McpAppCommandRuntime {
    const sourceRuntime = /^bun(?:-debug)?$/.test(path.basename(process.execPath));
    return {
        config: { command: process.execPath, ...(sourceRuntime ? { argsPrefix: [path.resolve(import.meta.dir, 'index.ts')] } : {}) },
        connect: () => createStdioMcpAppConnection(createCliMcpAppRuntime(runtime), { signals: createProcessShutdownSignals(), closeOnEof: false, log: message => console.error(message) }),
    };
}
