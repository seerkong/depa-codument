import { BIN, DISPLAY_NAME, SKILL_DEMO, SKILLS, WORKSPACE_DIR } from '../identity';
import { readGlobalGuidanceAssets, createCodumentGuidanceOperations } from 'depa-codument-product-capsule/global-guidance';
import { CODUMENT_AGENT_SKILL_DIRECTORIES, type CodumentInstallAgent } from 'depa-codument-product-capsule/workspace-install';
import type { ResourceEffect } from './effects/resource';
import { installTemplates, installInstructionBlocks } from 'halfcode-lite-cli-logic/install';
import type { WorkspaceEffect } from './effects/workspace';
import type { BrowserTransport } from './effects/browser-provider';
import type { OpenCliSubtransport } from './effects/opencli';

export const SUPPORTED_AGENTS = ['eidolon', 'opencode', 'codex'] as const;
export type CLITool = typeof SUPPORTED_AGENTS[number];
export const DEFAULT_AGENTS: readonly CLITool[] = ['codex'];

export const GLOBAL_SKILLS_RESOURCE_ROOT = 'agents/global/skills';
export const WORKSPACE_SKILLS_RESOURCE_ROOT = 'agents/workspace/skills';
export const PRIVATE_WORKSPACE_RESOURCE_ROOT = 'private/workspace';
const RETIRED_WORKSPACE_SKILL_DIRS = [`${BIN}-workspace`] as const;

export type InstallAgent = CodumentInstallAgent;

export interface InstallTarget {
  agent: InstallAgent;
  skillsDir: string;
}

/** Default installation is Codex; explicit selection supports product agents. */
export const INSTALL_TARGETS: readonly InstallTarget[] = Object.freeze([
  Object.freeze({ agent: 'codex', skillsDir: '.agents/skills' }),
]);
export const INSTALL_AGENTS: readonly InstallAgent[] = Object.freeze(INSTALL_TARGETS.map(({ agent }) => agent));

export function globalInstallTargets(agent?: string): readonly InstallTarget[] {
  if (agent === undefined) return INSTALL_TARGETS;
  const names = [...new Set(agent.split(',').map(name => name.trim()))];
  if (names.some(name => !Object.hasOwn(CODUMENT_AGENT_SKILL_DIRECTORIES, name))) throw new Error('Unsupported agent selection.');
  return names.map(name => ({ agent: name as InstallAgent, skillsDir: CODUMENT_AGENT_SKILL_DIRECTORIES[name as InstallAgent] }));
}

export const SKILLS_DIR_BY_AGENT: Record<CLITool, string> = {
  eidolon: '.eidolon/skills',
  opencode: '.opencode/skills',
  codex: '.agents/skills',
};

export const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'] as const;
export const CONFIG_FILE = `${WORKSPACE_DIR}/config.json`;

export interface ResolvedSkillsTarget {
  agent: CLITool | string;
  skillsDir: string;
}

export interface CapsuleRecord {
  name: string;
  root: string;
}

export interface CliToolsConfig {
  tools: CLITool[];
  capsules?: CapsuleRecord[];
  pageSources?: {
    skills: boolean;
    workspace: boolean;
  };
  configuration?: {
    defaultProfile?: string;
  };
  browser?: {
    transport: BrowserTransport;
    'ego-browser'?: {
      [key: string]: unknown;
    };
    opencli?: {
      transport: OpenCliSubtransport;
    };
    'mdd-browser-robot'?: {
      transport: 'chrome-extension';
    };
  };
  updated_at: string;
}

export interface SkillInstallReceipt {
  agent: string;
  directory: string;
  written: number;
}

function isCliTool(value: string): value is CLITool {
  return (SUPPORTED_AGENTS as readonly string[]).includes(value);
}

function uniqueAgents(values: readonly string[]): CLITool[] {
  const seen = new Set<CLITool>();
  const agents: CLITool[] = [];
  for (const value of values) {
    const agent = value.trim().toLowerCase();
    if (!isCliTool(agent) || seen.has(agent)) continue;
    seen.add(agent);
    agents.push(agent);
  }
  return agents;
}

export function parseAgents(value: string | undefined, fallback: readonly CLITool[] = DEFAULT_AGENTS): CLITool[] {
  const raw = value
    ? value.split(',').map((agent) => agent.trim().toLowerCase()).filter(Boolean)
    : fallback;
  const agents = uniqueAgents(raw);
  return agents.length > 0 ? agents : [...fallback];
}

export function resolveSkillsTargets(
  options: Readonly<Record<string, string | boolean>>,
  fallbackAgents: readonly CLITool[] = DEFAULT_AGENTS,
): ResolvedSkillsTarget[] {
  const explicit = typeof options['skills-dir'] === 'string' ? String(options['skills-dir']) : undefined;
  const agents = parseAgents(typeof options.agent === 'string' ? String(options.agent) : undefined, fallbackAgents);
  if (explicit) return [{ agent: agents.join(','), skillsDir: explicit }];
  return agents.map((agent) => ({ agent, skillsDir: SKILLS_DIR_BY_AGENT[agent] }));
}

export function toPortablePath(value: string): string {
  return value.split('\\').join('/');
}

export function managedInstructionBody(): string {
  return `# ${DISPLAY_NAME}

在当前项目里使用本工具前，先读本块。

输出：默认 YAML frontmatter + 正文；需要机器读取时加 \`--json\`。

常用命令：
- \`${BIN} status\` 查看工作区
- \`${BIN} invoke --fqn <FQN> --skills-dir <scan-root> --input '<json>' --json\` 按 FQN 调用编译能力
- \`${BIN} exec --code '<expression>' --skills-dir <scan-root> --json\` 仅调试
- \`${BIN} upgrade-workspace\` 刷新本块和 workspace skills
- \`${BIN} demo [name]\` 验证安装

先读全局 skill \`${BIN}\`（只装全局，不经 init 进工作区）。invoke 的扫描根必须由当前 agent 传入 \`--skills-dir\`。要起本 CLI 的演示页时说「启动 ${BIN} serve」，不要说泛化的「启动 serve」。

业务 schema 与口径以各 agent 已加载的业务 skill 为准，不要在本 CLI 仓库另写一份。

Skills：
- 全局 \`${BIN}\`：安装、invoke 协议、演示页 serve、各 agent skills 根对照表
- ${SKILL_DEMO}：演示调用

保留本受管块，\`${BIN} upgrade-workspace\` 会刷新它。`;
}

function parseCapsuleRecords(value: unknown): CapsuleRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as { name?: unknown; root?: unknown };
    if (typeof record.root !== 'string' || !record.root) return [];
    return [{
      name: typeof record.name === 'string' && record.name ? record.name : 'capsule',
      root: record.root,
    }];
  });
}

export async function readWorkspaceConfig(workspace: WorkspaceEffect): Promise<CliToolsConfig> {
  const raw = await workspace.readText(CONFIG_FILE);
  if (!raw) return { tools: [], pageSources: { skills: true, workspace: false }, updated_at: '' };
  try {
    const parsed = JSON.parse(raw) as { tools?: unknown; capsules?: unknown; pageSources?: unknown; configuration?: unknown; browser?: unknown; updated_at?: unknown };
    const pageSources = parsed.pageSources && typeof parsed.pageSources === 'object' && !Array.isArray(parsed.pageSources)
      ? parsed.pageSources as { skills?: unknown; workspace?: unknown }
      : {};
    const browser = parsed.browser === undefined
      ? undefined
      : parseBrowserConfig(parsed.browser);
    const configuration = parsed.configuration === undefined
      ? undefined
      : parseConfigurationConfig(parsed.configuration);
    return {
      tools: Array.isArray(parsed.tools) ? uniqueAgents(parsed.tools.map((tool) => String(tool))) : [],
      capsules: parseCapsuleRecords(parsed.capsules),
      pageSources: {
        skills: pageSources.skills !== false,
        workspace: pageSources.workspace === true,
      },
      ...(browser ? { browser } : {}),
      ...(configuration ? { configuration } : {}),
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : '',
    };
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { tools: [], pageSources: { skills: true, workspace: false }, updated_at: '' };
  }
}

function parseConfigurationConfig(value: unknown): NonNullable<CliToolsConfig['configuration']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${CONFIG_FILE}: configuration must be an object`);
  }
  const defaultProfile = (value as Record<string, unknown>).defaultProfile;
  if (defaultProfile !== undefined && (typeof defaultProfile !== 'string' || !defaultProfile.trim())) {
    throw new Error(`${CONFIG_FILE}: configuration.defaultProfile must be a non-empty string when provided`);
  }
  return defaultProfile === undefined ? {} : { defaultProfile: defaultProfile.trim() };
}

export async function readCliToolsConfig(workspace: WorkspaceEffect): Promise<CLITool[]> {
  return (await readWorkspaceConfig(workspace)).tools;
}

function parseBrowserConfig(value: unknown): NonNullable<CliToolsConfig['browser']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${CONFIG_FILE}: browser must be an object`);
  }
  const transport = (value as { transport?: unknown }).transport;
  if (transport !== 'ego-browser' && transport !== 'opencli' && transport !== 'mdd-browser-robot') {
    throw new Error(`${CONFIG_FILE}: browser.transport must be ego-browser, opencli, or mdd-browser-robot`);
  }
  const record = value as Record<string, unknown>;
  const ego = record['ego-browser'];
  if (ego !== undefined && (!ego || typeof ego !== 'object' || Array.isArray(ego))) {
    throw new Error(`${CONFIG_FILE}: browser.ego-browser must be an object`);
  }
  const opencli = record.opencli;
  if (opencli !== undefined && (!opencli || typeof opencli !== 'object' || Array.isArray(opencli))) {
    throw new Error(`${CONFIG_FILE}: browser.opencli must be an object`);
  }
  let opencliConfig: { transport: OpenCliSubtransport } | undefined;
  if (opencli !== undefined || transport === 'opencli') {
    const subtransport = (opencli as Record<string, unknown> | undefined)?.transport ?? 'plugin';
    if (subtransport !== 'plugin' && subtransport !== 'browser-eval') {
      throw new Error(`${CONFIG_FILE}: browser.opencli.transport must be plugin or browser-eval`);
    }
    opencliConfig = { transport: subtransport };
  }
  const mdd = record['mdd-browser-robot'];
  if (mdd !== undefined && (!mdd || typeof mdd !== 'object' || Array.isArray(mdd))) {
    throw new Error(`${CONFIG_FILE}: browser.mdd-browser-robot must be an object`);
  }
  let mddConfig: { transport: 'chrome-extension' } | undefined;
  if (mdd !== undefined || transport === 'mdd-browser-robot') {
    if (!mdd || typeof mdd !== 'object' || Array.isArray(mdd)) {
      throw new Error(`${CONFIG_FILE}: browser.mdd-browser-robot must be an object`);
    }
    if ((mdd as Record<string, unknown>).transport !== 'chrome-extension') {
      throw new Error(`${CONFIG_FILE}: browser.mdd-browser-robot.transport must be chrome-extension`);
    }
    mddConfig = { transport: 'chrome-extension' };
  }
  return {
    transport,
    ...(ego ? { 'ego-browser': ego as Record<string, unknown> } : {}),
    ...(opencliConfig ? { opencli: opencliConfig } : {}),
    ...(mddConfig ? { 'mdd-browser-robot': mddConfig } : {}),
  };
}

export async function writeCliToolsConfig(
  workspace: WorkspaceEffect,
  tools: readonly CLITool[],
  capsules?: readonly CapsuleRecord[],
): Promise<void> {
  const previous = await readWorkspaceConfig(workspace);
  const config: CliToolsConfig = {
    tools: [...tools],
    capsules: capsules ? [...capsules] : previous.capsules,
    pageSources: previous.pageSources ?? { skills: true, workspace: false },
    ...(previous.configuration ? { configuration: previous.configuration } : {}),
    ...(previous.browser ? { browser: previous.browser } : {}),
    updated_at: new Date().toISOString(),
  };
  await workspace.writeText(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

export async function workspaceInitialized(workspace: WorkspaceEffect): Promise<boolean> {
  return workspace.exists(CONFIG_FILE);
}

export async function injectInstructionBlocks(
  workspace: WorkspaceEffect,
  files: readonly string[] = INSTRUCTION_FILES,
): Promise<string[]> {
  return installInstructionBlocks(workspace, files, { marker: BIN, body: managedInstructionBody() });
}

export async function installSkillTemplates(
  resources: ResourceEffect,
  skills: WorkspaceEffect,
  resourceRoot = WORKSPACE_SKILLS_RESOURCE_ROOT,
): Promise<number> {
  const receipt = await installTemplates(resources, skills, {
    sourceRoot: resourceRoot, overwrite: true, resetPackagedDirectories: true,
  });
  return receipt.written;
}

export async function assertWorkspaceDirAvailable(workspace: WorkspaceEffect): Promise<void> {
  if (await workspace.kind(WORKSPACE_DIR) === 'file') {
    throw new Error(
      `Cannot create workspace directory '${WORKSPACE_DIR}': a file with that name already exists. `
      + `Run \`${BIN} init\` from the project root, not from a directory that contains the '${BIN}' binary.`,
    );
  }
}

export async function installWorkspaceTemplates(
  resources: ResourceEffect,
  workspace: WorkspaceEffect,
  force: boolean,
): Promise<{ written: number; skipped: number }> {
  await assertWorkspaceDirAvailable(workspace);
  return installTemplates(resources, workspace, {
    sourceRoot: PRIVATE_WORKSPACE_RESOURCE_ROOT, destinationRoot: WORKSPACE_DIR, overwrite: force,
  });
}

export async function installSkillsForTargets(
  resources: ResourceEffect,
  workspaceOf: (root?: string) => WorkspaceEffect,
  targets: readonly ResolvedSkillsTarget[],
): Promise<SkillInstallReceipt[]> {
  const receipts: SkillInstallReceipt[] = [];
  for (const target of targets) {
    const skills = workspaceOf(target.skillsDir);
    const { written } = await installTemplates(resources, skills, {
      sourceRoot: WORKSPACE_SKILLS_RESOURCE_ROOT, overwrite: true, resetPackagedDirectories: true,
      retiredDirectories: RETIRED_WORKSPACE_SKILL_DIRS,
    });
    receipts.push({
      agent: String(target.agent),
      directory: toPortablePath(target.skillsDir),
      written,
    });
  }
  return receipts;
}

export async function installGlobalSkills(
  _resources: ResourceEffect,
  workspaceOf: (root?: string) => WorkspaceEffect,
  targets: readonly InstallTarget[] = INSTALL_TARGETS,
): Promise<SkillInstallReceipt[]> {
  const assets = await readGlobalGuidanceAssets();
  await createCodumentGuidanceOperations(); // Validate the App before replacing any installed directory.
  const receipts: SkillInstallReceipt[] = [];
  for (const target of targets) {
    const skills = workspaceOf(target.skillsDir);
    await skills.remove(BIN);
    for (const asset of assets) await skills.writeText(`${BIN}/${asset.path}`, asset.source);
    receipts.push({ agent: target.agent, directory: target.skillsDir, written: assets.length });
  }
  return receipts;
}
