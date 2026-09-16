import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolveAgentRuntime, type AgentRuntime } from './agent-runtime';

/** Default agent identity; the run's provenance records which runtime actually ran. */
export const AGENT: AgentRuntime = resolveAgentRuntime(process.env.E2E_AGENT);
export const MODEL = AGENT.model;
export const EFFORT = AGENT.effort;
export const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export const writeJson = (file: string, data: unknown) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
export function files(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(e => {
    const file = path.join(root, e.name);
    if (e.isSymbolicLink()) throw new Error(`Unexpected symlink: ${file}`);
    return e.isDirectory() ? files(file) : [file];
  }).sort();
}
export function treeHash(root: string): string {
  return createHash('sha256').update(files(root).map(f => `${path.relative(root, f)}:${sha(f)}`).join('\n')).digest('hex');
}
export function assertTemporary(root: string): string {
  const real = fs.realpathSync(root);
  if (!/^\/(private\/)?tmp\/depa-codument-e2e-[^/]+$/.test(real)) throw new Error(`Unsafe run root: ${root}`);
  if (!fs.existsSync(path.join(real, 'run-owner.json'))) throw new Error('Missing run ownership receipt');
  return real;
}
export interface Execution {
  argv: string[]; cwd: string; env: NodeJS.ProcessEnv; log: string; timeoutMs?: number; input?: string;
}
export interface ExecutionResult { code: number; timedOut: boolean; elapsedMs: number }
/** Commands are not shell strings. The process group owns all descendants. */
export async function execute(spec: Execution): Promise<ExecutionResult> {
  const start = Date.now();
  const out = fs.openSync(spec.log, 'wx', 0o600);
  let timedOut = false;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(spec.argv[0]!, spec.argv.slice(1), {
        cwd: spec.cwd, env: spec.env, detached: true, stdio: ['pipe', out, out],
      });
      const killGroup = () => { try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* already exited */ } };
      const timeout = setTimeout(() => { timedOut = true; killGroup(); }, spec.timeoutMs ?? 120_000);
      const interrupt = () => killGroup();
      process.once('SIGTERM', interrupt);
      process.once('SIGINT', interrupt);
      const cleanup = () => { clearTimeout(timeout); process.off('SIGTERM', interrupt); process.off('SIGINT', interrupt); killGroup(); };
      child.on('error', error => { cleanup(); reject(error); });
      child.on('close', code => { cleanup(); resolve({ code: timedOut ? 124 : code ?? 1, timedOut, elapsedMs: Date.now() - start }); });
      child.stdin!.on('error', () => { /* early child exit */ });
      child.stdin!.end(spec.input ?? '');
    });
  } finally { fs.closeSync(out); }
}
export interface Run {
  root: string; workspace: string; home: string; bin: string; env: NodeJS.ProcessEnv; readonlyWorkspace?: boolean;
}
export function createRun(candidate: string, caseId: string): Run {
  if (!/^[a-z][a-z0-9-]*$/.test(caseId)) throw new Error('Invalid case ID');
  const source = fs.realpathSync(candidate);
  if (path.basename(source) === 'codument') throw new Error('Legacy binary rejected');
  const root = fs.realpathSync(fs.mkdtempSync('/tmp/depa-codument-e2e-'));
  fs.chmodSync(root, 0o700);
  writeJson(path.join(root, 'run-owner.json'), { caseId, createdAt: new Date().toISOString(), schema: 1 });
  const workspace = path.join(root, 'workspace');
  const home = path.join(root, 'home');
  for (const dir of ['workspace', 'bin', 'logs', 'home/.codex', 'home/cache', 'home/tmp']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const bin = path.join(root, 'bin/depa-codument');
  fs.copyFileSync(source, bin); fs.chmodSync(bin, 0o755);
  // Deliberately fail old-name fallback rather than silently exercising old sessions.
  fs.writeFileSync(path.join(root, 'bin/codument'), '#!/bin/sh\necho "E2E: legacy codument is forbidden" >&2\nexit 89\n', { mode: 0o755 });
  const env = isolatedEnvironment(root, AGENT);
  writeJson(path.join(root, 'provenance.json'), { source, sha256: sha(source), harnessSha256: treeHash(import.meta.dir), agent: AGENT.id, model: MODEL, effort: EFFORT, caseId });
  return { root, workspace, home, bin, env };
}
function isolatedEnvironment(root: string, agent: AgentRuntime): NodeJS.ProcessEnv {
  const home = path.join(root,'home');
  const env: NodeJS.ProcessEnv = {
    PATH: `${root}/bin:${path.dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: home, CODUMENT_HOME: home, CODEX_HOME: path.join(home, '.codex'),
    TMPDIR: path.join(home, 'tmp'), XDG_CACHE_HOME: path.join(home, 'cache'),
    BUN_INSTALL_CACHE_DIR: path.join(home, 'cache/bun'), npm_config_cache: path.join(home, 'cache/npm'),
    UV_CACHE_DIR: path.join(home, 'cache/uv'), PIP_CACHE_DIR: path.join(home, 'cache/pip'),
    LANG: 'en_US.UTF-8', TERM: 'dumb', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'E2E', GIT_AUTHOR_EMAIL: 'e2e@example.invalid', GIT_COMMITTER_NAME: 'E2E', GIT_COMMITTER_EMAIL: 'e2e@example.invalid',
  };
  // The eidolon runtime resolves its global root from this variable, so an
  // isolated trial never reads or writes the operator's real ~/.eidolon assets.
  if (agent.id === 'eidolon') env.EIDOLON_GLOBAL_DIR = path.join(home, '.eidolon');
  return env;
}
export function loadRun(root: string, candidate: string, caseId: string): Run {
  root = assertTemporary(root);
  const provenance = JSON.parse(fs.readFileSync(path.join(root,'provenance.json'),'utf8'));
  // An absent agent field is a pre-adapter trial; it can only have been codex.
  const observedAgent = provenance.agent ?? 'codex';
  if (observedAgent !== AGENT.id) throw new Error(`Resume agent mismatch: trial ran ${observedAgent}, current run is ${AGENT.id}`);
  if(provenance.caseId!==caseId || provenance.model!==MODEL || provenance.sha256!==sha(candidate)) throw new Error('Resume identity mismatch');
  const bin = path.join(root,'bin/depa-codument');
  if(sha(bin)!==provenance.sha256) throw new Error('Candidate drift');
  const reverify = provenance.kind === 'ui-reverification';
  const workspace = reverify ? provenance.sourceWorkspace : path.join(root,'workspace');
  if (reverify) {
    if (typeof workspace !== 'string' || !path.isAbsolute(workspace) || !fs.existsSync(workspace)) throw new Error('Invalid historical UI re-verification workspace');
    if (!/^\/(private\/)?tmp\/depa-codument-e2e-[^/]+\/workspace$/.test(fs.realpathSync(workspace))) throw new Error('Unsafe historical UI re-verification workspace');
  }
  return { root, workspace, home:path.join(root,'home'), bin, env:isolatedEnvironment(root, AGENT), readonlyWorkspace: reverify };
}
/** macOS outer boundary also constrains verifier commands and Codex internal writes. */
export function sandbox(run: Run, argv: string[], mode: boolean | 'setup' | 'review' = false): string[] {
  if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/sandbox-exec')) throw new Error('Verified macOS sandbox required; no unsafe fallback');
  assertTemporary(run.root);
  const writable = [path.join(run.home, 'cache'), path.join(run.home, 'tmp')];
  if (mode !== 'review' && !run.readonlyWorkspace) writable.push(run.workspace);
  const agent = mode === true || mode === 'review';
  if (agent) writable.push(path.join(run.home, '.codex'));
  // eidolon keeps its own private project state (authority/locks) in a
  // workdir `.eidolon`; in read-only reviewer mode the delivered workspace is
  // not writable, so that state must live inside the isolated tmp instead.
  if (AGENT.id === 'eidolon') writable.push(path.join(run.workspace, '.eidolon'));
  if (mode === 'setup') writable.push(run.home);
  const realHome = os.homedir();
  // Agent runtimes live under the real home but are part of the harness, not
  // workspace content; only their exact runtime roots are readable.
  const runtimePaths = ['.bun/bin', '.bun/install/global/node_modules', '.local/bin', '.local/share/uv/python'].map(p => path.join(realHome,p))
    .concat(AGENT.sandboxReadPaths());
  // The whole agent tree and every sibling trial copy live under the same /tmp
  // parent, so isolating the real home alone is not enough: without this deny the
  // agent can read the harness source and other trials' workspaces, which both
  // leaks how it will be judged and breaks trial independence. The run's own root
  // and the agent runtime's read-only roots are re-allowed afterwards (Seatbelt
  // resolves by last matching rule).
  // Sibling trials, verification copies and ui-suite clones all share the
  // `depa-codument-` prefix under the same temp parent; deny that family and
  // re-allow only this run's own root below.
  const tempParent = path.dirname(run.root);
  const familyPrefix = path.join(tempParent, 'depa-codument-');
  const profile = `(version 1)(allow default)(deny file-write*)` +
    `(allow file-write* (literal "/dev/null") (literal "/dev/tty") ${writable.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})` +
    `(deny file-read* (subpath ${JSON.stringify(realHome)}))` +
    `(allow file-read-metadata (subpath ${JSON.stringify(realHome)}))` +
    `(allow file-read* ${runtimePaths.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})` +
    `(deny file-read* (regex ${JSON.stringify('^' + escapeForSeatbeltRegex(familyPrefix))}))` +
    `(allow file-read* (subpath ${JSON.stringify(run.root)}))` +
    `(allow file-read* (subpath ${JSON.stringify(run.workspace)}))` +
    (agent ? '' : `(deny file-read* (subpath ${JSON.stringify(path.join(run.home,'.codex'))}))`);
  return ['/usr/bin/sandbox-exec', '-p', profile, ...argv];
}
/**
 * Seatbelt regexes are POSIX EREs; escape anything that would otherwise be a
 * metacharacter so a literal filesystem prefix stays literal.
 */
function escapeForSeatbeltRegex(value: string): string {
  return value.replace(/[.^$*+?()\[\]{}|\\]/g, '\\$&');
}
export async function setup(run: Run, nested = false): Promise<void> {
  const repos = nested ? ['main-repo', 'inventory-repo'].map(p => path.join(run.workspace, p)) : [run.workspace];
  for (const [i, cwd] of repos.entries()) {
    fs.mkdirSync(cwd, { recursive: true });
    for (const [name, argv] of [
      ['git', ['git', '-c', 'init.templateDir=', 'init', '-q']],
      ['init', [run.bin, ...AGENT.initArgs()]],
    ] as const) {
      const result = await execute({ argv: sandbox(run, [...argv], 'setup'), cwd, env: run.env, log: path.join(run.root, `logs/setup-${i}-${name}.log`) });
      if (result.code) throw new Error(`Setup ${name} failed: ${result.code}`);
    }
    if (fs.existsSync(path.join(cwd, 'codument/std'))) throw new Error('Workspace std unexpectedly distributed');
    if (!fs.existsSync(path.join(cwd, 'codument/SKILL.md'))) throw new Error('Workspace SkillApp missing');
    const profiles = fs.readFileSync(path.join(cwd,'codument/config/attractor-profiles.xnl'),'utf8');
    for (const match of profiles.matchAll(/skill:\/\/depa-codument\/([^"\s]+)/g)) {
      if (!fs.existsSync(path.join(AGENT.skillRoot(run),match[1]!))) throw new Error('Dangling initialized global reference: '+match[1]);
    }
  }
  const skill = AGENT.skillRoot(run);
  if (!fs.existsSync(path.join(skill, 'references/std/compat/operation-alias.md'))) throw new Error('Global App alias missing');
  for (const retired of ['std', 'references/std/operations', 'references/std/commands', 'references/std/kernel-pointer.md']) {
    if (fs.existsSync(path.join(skill, retired))) throw new Error(`Retired global asset: ${retired}`);
  }
  writeJson(path.join(run.root, 'installation.json'), { skill, hash: treeHash(skill), files: files(skill).length });
}
export function installAuthentication(run: Run, authSource: string | undefined): void {
  AGENT.prepare(run, authSource);
}
export function removeAuthentication(run: Run): void {
  AGENT.cleanup(run);
}
/**
 * Build one agent turn invocation. The prompt travels via stdin for runtimes
 * that read it there, so a long prompt never lands in the process argv.
 */
export function agentInvocation(run: Run, prompt: string, name: string, outputFile: string, log: string, extraArgs: string[] = []) {
  return AGENT.invocation(run, prompt, name, outputFile, log, extraArgs);
}
export function readEvents(file: string) { return AGENT.readEvents(file); }
export type AgentEvents = ReturnType<typeof readEvents>;
/** Re-exported so report.ts keeps one Usage/CommandExecution shape across runtimes. */
export type { Usage, CommandExecution } from './agent-runtime';
export const defaultAuth = () => AGENT.defaultAuth();
