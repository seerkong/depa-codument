import { CODUMENT_AGENT_SKILL_DIRECTORIES, type CodumentInstallAgent, type WorkspaceInstallDefinition, type WorkspaceInstallOptions, type WorkspaceInstallTargets, type WorkspaceInstallResult, type WorkspaceInstallRuntime } from 'depa-codument-domain-contract';

/** Preserve stored selection. Changing it in an existing App is an upgrade, not
 * an idempotent initialization; unknown config is retained and sent to review. */
export function resolveWorkspaceInstallTargets(options: WorkspaceInstallOptions = {}, stored?: string): WorkspaceInstallTargets {
  const observed = stored === undefined ? undefined : JSON.parse(stored);
  if (observed !== undefined && (!observed || !Array.isArray(observed.tools))) throw new Error('Invalid stored agent installation configuration; review is required.');
  const agents = [...new Set(options.agents ?? observed?.tools ?? ['claude'])] as CodumentInstallAgent[];
  if (!agents.length || agents.some(agent => !Object.hasOwn(CODUMENT_AGENT_SKILL_DIRECTORIES, agent))) throw new Error('Unsupported or empty agent selection.');
  const explicitDirectory = options.skillsDirectory ?? observed?.skills_directory;
  if (explicitDirectory !== undefined && (typeof explicitDirectory !== 'string' || !explicitDirectory.trim())) throw new Error('Invalid agent skills directory.');
  if (observed && (JSON.stringify(agents) !== JSON.stringify(observed.tools) || explicitDirectory !== observed.skills_directory)) throw new Error('Changing stored agent installation targets requires reviewed migration.');
  return {
    directories: explicitDirectory ? [explicitDirectory] : agents.map(agent => CODUMENT_AGENT_SKILL_DIRECTORIES[agent]),
    instructionFiles: agents.includes('claude') ? ['AGENTS.md', 'CLAUDE.md'] : ['AGENTS.md'],
    configuration: stored ?? JSON.stringify({ tools: agents, ...(explicitDirectory ? { skills_directory: explicitDirectory } : {}) }, null, 2) + '\n',
  };
}

/** Content policy only; publication and rollback belong to the filesystem port. */
export function mergeWorkspaceAgents(source: string, block: string): string {
  const begin = '<!-- codument:begin -->', end = '<!-- codument:end -->';
  const starts = source.split(begin).length - 1, ends = source.split(end).length - 1;
  if (!block.startsWith(begin) || !block.trimEnd().endsWith(end)) throw new Error('Invalid Codument managed block.');
  if (!starts && !ends) return source + (source && !source.endsWith('\n') ? '\n' : '') + (source ? '\n' : '') + block;
  if (starts !== 1 || ends !== 1 || source.indexOf(end) < source.indexOf(begin)) throw new Error('Ambiguous Codument AGENTS block; review is required.');
  // Initialization is not an upgrade. Preserve an existing product managed block,
  // including independently configured guidance; refresh belongs to migration.
  return source;
}

/** Explicit upgrade owns only the delimited product block, never surrounding user rules. */
export function refreshWorkspaceAgents(source: string, block: string): string {
  const checked = mergeWorkspaceAgents(source, block);
  if (checked !== source) return checked;
  const begin = source.indexOf('<!-- codument:begin -->');
  const end = source.indexOf('<!-- codument:end -->') + '<!-- codument:end -->'.length;
  return source.slice(0, begin) + block.trimEnd() + source.slice(end);
}

export async function installCodumentWorkspace(runtime: WorkspaceInstallRuntime, definition: WorkspaceInstallDefinition): Promise<WorkspaceInstallResult> {
  const prepared = await runtime.files.prepare(definition);
  try {
    const inspection = await runtime.inspect(prepared.validationRoot);
    if (!inspection.ready) throw new Error(`Workspace installation requires migration or review: ${inspection.findings.filter(f => f.severity === 'error').map(f => `${f.file}: ${f.message}`).join('; ')}`);
    if (definition.options?.appId && inspection.appId !== definition.options.appId) throw new Error('Changing an existing App identity requires reviewed migration.');
    const committed = await prepared.commit();
    return { ...committed, inspection };
  } catch (error) {
    try { await prepared.abort(); }
    catch (recoveryError) { throw new AggregateError([error, recoveryError], 'Workspace install failed; recovery material was retained.'); }
    throw error;
  }
}
