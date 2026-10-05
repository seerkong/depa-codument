export * from 'halfcode-lite-mcp-app-capsule';
import { createMcpAppServer as createServer, createMcpAppToolCatalog as createCatalog,
  createMcpAppConnection as createConnection, serveMcpApp as serve, buildMcpAppHtml as buildHtml,
  type McpAppRuntime, type ServeMcpAppOptions } from 'halfcode-lite-mcp-app-capsule';

export const APP_RESOURCE_URI = 'ui://codument/pages/app.html';
function productRuntime(runtime: McpAppRuntime): McpAppRuntime {
  return { ...runtime, appResourceUri: APP_RESOURCE_URI };
}
export const createMcpAppServer = (runtime: McpAppRuntime) => createServer(productRuntime(runtime));
export const createMcpAppToolCatalog = (runtime: McpAppRuntime) => createCatalog(productRuntime(runtime));
export const createMcpAppConnection = (runtime: McpAppRuntime, options: ServeMcpAppOptions) => createConnection(productRuntime(runtime), options);
export const serveMcpApp = (runtime: McpAppRuntime, options: ServeMcpAppOptions) => serve(productRuntime(runtime), options);
export function buildMcpAppHtml(scripts: readonly string[] = []) {
  return buildHtml(scripts, { name: 'codument-page', version: '0.1.0' });
}
export const buildDefaultMcpAppHtml = buildMcpAppHtml;
