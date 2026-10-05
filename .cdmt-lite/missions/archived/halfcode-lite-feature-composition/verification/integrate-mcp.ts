import {readFileSync,writeFileSync} from 'node:fs';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
for(const root of [upstream,'/Users/kongweixian/infra-dev/depa-codument/project']){
 const base=`${root}/packages/cli/src/cli`;
 const path=`${base}/command-registry.ts`;let registry=readFileSync(path,'utf8');
 const start=registry.indexOf("  group('mcp-app',"),end=registry.indexOf('  ...createLocalFunctionCommands',start);
 if(start<0||end<0)throw Error('MCP group missing');
 registry=registry.slice(0,start)+"  ...createMcpAppCommands<CommandRuntime>({bin:BIN,bind:bindMcpAppFeature}),\n"+registry.slice(end);
 registry=registry.replace("import { mcpAppConfigCommand, mcpAppServeCommand } from './commands/mcp-app';\n",'');
 registry="import {createMcpAppCommands} from 'halfcode-lite-mcp-app-capsule/commands';\nimport {bindMcpAppFeature} from './mcp-app-feature';\n"+registry;
 writeFileSync(path,registry);
 writeFileSync(`${base}/mcp-app-feature.ts`,`import * as path from 'node:path';
import type {McpAppCommandRuntime} from 'halfcode-lite-mcp-app-capsule/commands';
import {createStdioMcpAppConnection} from 'halfcode-lite-mcp-app-capsule/stdio';
import {createProcessShutdownSignals} from 'halfcode-lite-cli-host-support/shutdown';
import type {CommandRuntime} from './contracts/command';
import {createCliMcpAppRuntime} from './runtime/mcp-app';
export function bindMcpAppFeature(runtime:CommandRuntime):McpAppCommandRuntime {
 const sourceRuntime=/^bun(?:-debug)?$/.test(path.basename(process.execPath));
 return {
 config:{command:process.execPath,...(sourceRuntime?{argsPrefix:[path.resolve(import.meta.dir,'index.ts')]}:{})},
 connect:()=>createStdioMcpAppConnection(createCliMcpAppRuntime(runtime),{signals:createProcessShutdownSignals(),closeOnEof:${root===upstream},log:message=>console.error(message)}),
 };
}
`);
 writeFileSync(`${base}/commands/mcp-app.ts`,`import {createMcpAppHandlers} from 'halfcode-lite-mcp-app-capsule/commands';
import {bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
import {bindMcpAppFeature} from '../mcp-app-feature';
import {BIN} from '../../identity';
const handlers=createMcpAppHandlers(BIN);
export const mcpAppServeCommand=bindCommandRuntime(handlers.mcpAppServeCommand,bindMcpAppFeature);
export const mcpAppConfigCommand=bindCommandRuntime(handlers.mcpAppConfigCommand,bindMcpAppFeature);
`);
 const p=`${root}/packages/cli/package.json`;const m=JSON.parse(readFileSync(p,'utf8'));m.dependencies['halfcode-lite-mcp-app-capsule']=root===upstream?'workspace:*':'0.2.0';writeFileSync(p,JSON.stringify(m,null,2)+'\n');
}
const p=`${upstream}/packages/mcp-app-capsule/package.json`;const m=JSON.parse(readFileSync(p,'utf8'));m.exports['./commands']='./src/commands.ts';m.exports['./stdio']='./src/support/stdio-connection.ts';m.dependencies['halfcode-lite-cli-host-contract']='workspace:*';m.dependencies['halfcode-lite-cli-host-logic']='workspace:*';writeFileSync(p,JSON.stringify(m,null,2)+'\n');
