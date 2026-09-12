import { installCodumentWorkspace, mergeWorkspaceAgents, refreshWorkspaceAgents, resolveWorkspaceInstallTargets } from 'depa-codument-domain-logic';
import { createFileWorkspaceInstallPort } from 'depa-codument-domain-support';
import type { WorkspaceInstallDefinition, WorkspaceInstallOptions } from 'depa-codument-domain-contract';
export type { WorkspaceInstallOptions } from 'depa-codument-domain-contract';
export { CODUMENT_AGENT_SKILL_DIRECTORIES, type CodumentInstallAgent } from 'depa-codument-domain-contract';
import { createCodumentWorkspaceBlueprint, createCodumentWorkspaceInspector } from './workspace-app';
import { CODUMENT_WORKSPACE_ASSETS } from './workspace-assets';
import { relocateGlobalStandardReferences } from './global-reference-relocations';

const WORKSPACE_SKILL = `---
name: codument
description: 当前项目的 Codument 迭代资产 SkillApp；操作指导由全局 depa-codument Skill 提供。
---

# 项目资产

本目录 manifest.xnl 声明项目正式资源；@/ 表示项目根。Track、Mission、行为、决策、配置与知识属于本项目。
加载全局 depa-codument Skill，调用其顶层 CommandOperation 获得操作指导；references/std/ 属于全局 Skill，不在本目录维护第二份。
Kind 由产品包内置；不复制 KindDefinitions，不删除 Hook、GapLoop、AttractorCheck 或 fresh verify。
`;

function workspaceAssetSource(path: string, source: string): string {
  if (path === 'codument/SKILL.md') return WORKSPACE_SKILL;
  if (path.endsWith('/README.md')) {
    // These authored assets already describe the current App layout. Do not
    // rewrite the std/ substring inside an already canonical references/std/ URI.
    return relocateGlobalStandardReferences(source);
  }
  return relocateGlobalStandardReferences(source.replaceAll('vfs://@/codument/std/', 'skill://depa-codument/references/std/'));
}

export const CODUMENT_AGENTS_BLOCK = `<!-- codument:begin -->

# Codument Instructions

在 Codument 工具内部上下文中，\`@\` 表示当前项目根目录。
涉及 Codument 工作前，加载全局 \`depa-codument\` Skill，并读取 \`@/codument/SKILL.md\` 了解项目资产边界。
操作入口为 \`depa-codument <operation>\`；标准在全局 Skill 的 references/std/，不再分发到项目 codument/std/。
正式业务资源只在 \`codument/\`；全局 Skill 只指导操作，不拥有本项目业务数据。
产品方向吸引子：\`@/codument/attractors/product.md\`
项目实现吸引子：\`@/codument/attractors/project.md\`

保留本受管块；更新走明确的 workspace migration，不覆盖未受管内容。

<!-- codument:end -->
`;

/** Bundled text assets are embedded by Bun as well as included in the npm source
 * closure. Ordinary query runtime does not import this installation entry. */
export function createCodumentWorkspaceInstallDefinition(options: WorkspaceInstallOptions = {}): WorkspaceInstallDefinition {
  const blueprint = createCodumentWorkspaceBlueprint(options.appId);
  return {
    appDirectories: blueprint.directories,
    appFiles: [{ path: 'manifest.xnl', source: blueprint.manifest }, ...CODUMENT_WORKSPACE_ASSETS
      .filter(asset => asset.path.startsWith('codument/') && !asset.path.startsWith('codument/std/'))
      .map(asset => ({ path: asset.path.slice('codument/'.length), source: workspaceAssetSource(asset.path, asset.source) }))],
    skillFiles: [],
    agentsBlock: CODUMENT_AGENTS_BLOCK,
    options,
  };
}

/** Product installation composition; initialization never upgrades an existing App. */
export function createCodumentWorkspaceInstaller(workspaceRoot: string) {
  const files = createFileWorkspaceInstallPort(workspaceRoot, mergeWorkspaceAgents, resolveWorkspaceInstallTargets);
  return Object.freeze({ install: (options?: WorkspaceInstallOptions) => installCodumentWorkspace({ files,
    inspect: root => createCodumentWorkspaceInspector(root).inspect() }, createCodumentWorkspaceInstallDefinition(options)) });
}

/** Post-App upgrade phase: guarded root instructions and exact old thin Skill retirement. */
export function createCodumentWorkspaceGuidanceUpdater(workspaceRoot: string) {
  const files = createFileWorkspaceInstallPort(workspaceRoot, refreshWorkspaceAgents, resolveWorkspaceInstallTargets);
  return Object.freeze({ upgrade: (options?: WorkspaceInstallOptions) => installCodumentWorkspace({ files,
    inspect: root => createCodumentWorkspaceInspector(root).inspect() }, {
    ...createCodumentWorkspaceInstallDefinition(options), retainRecovery: true,
    retiredSkillFiles: CODUMENT_WORKSPACE_ASSETS.filter(asset => asset.path.startsWith('skills/codument-'))
      .map(asset => ({ path: asset.path.slice('skills/'.length), source: asset.source })),
  }) });
}
