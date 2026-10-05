import {createMcpAppHandlers} from 'halfcode-lite-mcp-app-capsule/commands';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {bindMcpAppFeature} from '../mcp-app-feature';
import {BIN} from '../../identity';
const handlers=createMcpAppHandlers(BIN);
export const mcpAppServeCommand=bindCommandRuntime(handlers.mcpAppServeCommand,bindMcpAppFeature);
export const mcpAppConfigCommand=bindCommandRuntime(handlers.mcpAppConfigCommand,bindMcpAppFeature);
