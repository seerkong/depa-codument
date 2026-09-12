import type { WorkspaceAppInspection } from './workspace-app';

export interface WorkspaceInstallFile { readonly path: string; readonly source: string }
export const CODUMENT_AGENT_SKILL_DIRECTORIES = {
  claude: '.claude/skills', codeflicker: '.codeflicker/skills', eidolon: '.eidolon/skills',
  opencode: '.opencode/skills', sparrow: '.sparrow/skills', codex: '.agents/skills',
} as const;
export type CodumentInstallAgent = keyof typeof CODUMENT_AGENT_SKILL_DIRECTORIES;
export interface WorkspaceInstallOptions {
  readonly appId?: string;
  readonly agents?: readonly CodumentInstallAgent[];
  /** Internal installer owns workspace-local targets only; no global installation. */
  readonly skillsDirectory?: string;
}
/** Initial creation only. Existing App authorities are never template updates. */
export interface WorkspaceInstallDefinition {
  /** Paths relative to each selected Skill target; exact reviewed thin sources only. */
  readonly retiredSkillFiles?: readonly WorkspaceInstallFile[];
  readonly retainRecovery?: boolean;
  readonly appFiles: readonly WorkspaceInstallFile[];
  readonly appDirectories: readonly string[];
  readonly skillFiles: readonly WorkspaceInstallFile[];
  readonly agentsBlock: string;
  readonly options?: WorkspaceInstallOptions;
}
export interface WorkspaceInstallTargets {
  readonly directories: readonly string[];
  readonly instructionFiles: readonly string[];
  readonly configuration: string;
}
export interface WorkspaceInstallResult {
  readonly backupPath?: string;
  readonly createdApp: boolean;
  readonly writtenFiles: readonly string[];
  readonly inspection: WorkspaceAppInspection;
}
export interface PreparedWorkspaceInstall {
  /** Isolated candidate for a fresh App; existing App otherwise. */
  readonly validationRoot: string;
  commit(): Promise<{ readonly createdApp: boolean; readonly writtenFiles: readonly string[]; readonly backupPath?: string }>;
  abort(): Promise<void>;
}
export interface WorkspaceInstallPort {
  prepare(definition: WorkspaceInstallDefinition): Promise<PreparedWorkspaceInstall>;
}
export interface WorkspaceInstallRuntime {
  readonly files: WorkspaceInstallPort;
  readonly inspect: (root: string) => Promise<WorkspaceAppInspection>;
}
