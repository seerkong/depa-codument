import {
  buildMcpAppHtml,
  createMcpPageTargetStore,
  type McpAppRuntime,
  type PageTargetRegistry,
  type SopPort,
} from 'depa-codument-mcp-app-capsule';
import { BIN } from '../../identity';
import { VERSION } from '../../version';
import type { CommandRuntime } from '../contracts/command';
import type { PageWorkflowSelector } from '../resources/definitions';

export interface CliMcpAppRuntimeOptions {
  readonly targets?: PageTargetRegistry;
  readonly renderApp?: () => Promise<string>;
}

export function createCliMcpAppRuntime(
  runtime: CommandRuntime,
  options: CliMcpAppRuntimeOptions = {},
): McpAppRuntime {
  const pages = runtime.page?.pages;
  const automation = runtime.page?.automation;
  const workflows = runtime.page?.workflows;
  const sops = runtime.sop;
  if (!pages) throw new Error('Page resource catalog is not configured');
  if (!automation) throw new Error('Page automation catalog is not configured');
  if (!workflows) throw new Error('PageWorkflow coordinator is not configured');
  if (!sops) throw new Error('SOP resource catalog is not configured');
  const targets = options.targets ?? createMcpPageTargetStore();
  const sopPort: SopPort = Object.freeze({
    async get(fqn: string) {
      const document = await sops.get(fqn);
      return Object.freeze({
        fqn: document.fqn,
        profile: document.profile,
        markdown: document.markdown,
        contentDigest: document.contentDigest,
        diagnostics: document.diagnostics,
      });
    },
  });
  const renderInstalledApp = async () => {
    const scripts: string[] = [];
    for (const page of await pages.list()) {
      if (page.mcpApp?.status !== 'ready' || !page.mcpApp.viewAsset) continue;
      const asset = await pages.asset(page.name, page.mcpApp.viewAsset);
      if (!asset || !asset.contentType.startsWith('text/javascript')) {
        throw new Error(`MCP App view asset is unavailable: ${page.name}/${page.mcpApp.viewAsset}`);
      }
      scripts.push(new TextDecoder().decode(asset.body));
    }
    return buildMcpAppHtml(scripts);
  };
  return {
    hostSkill: BIN,
    hostVersion: VERSION,
    targets,
    pages: {
      list: async () => (await pages.list()).map((page) => ({
        name: page.name,
        description: page.description,
        status: page.status,
        ...(page.entryUrl ? { entryUrl: page.entryUrl } : {}),
        ...(page.mcpApp?.sopFqn ? { sopFqn: page.mcpApp.sopFqn } : {}),
        ...(page.agentAction ? { agentAction: page.agentAction } : {}),
        ...(page.mcpApp ? { appReady: page.mcpApp.status === 'ready' } : {}),
      })),
      renderApp: options.renderApp ?? renderInstalledApp,
    },
    automation: {
      list: () => automation.list(),
    },
    sops: sopPort,
    workflows: {
      start: (request) => workflows.start({
        ...request,
        selector: request.selector as PageWorkflowSelector | undefined,
      }, targets),
      get: (runId) => workflows.get(runId),
    },
  };
}
