import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

export const MODEL = 'gpt-5.6-terra';
export const EFFORT = 'medium';
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
  const env = isolatedEnvironment(root);
  writeJson(path.join(root, 'provenance.json'), { source, sha256: sha(source), harnessSha256: treeHash(import.meta.dir), model: MODEL, effort: EFFORT, caseId });
  return { root, workspace, home, bin, env };
}
function isolatedEnvironment(root: string): NodeJS.ProcessEnv {
  const home = path.join(root,'home');
  return {
    PATH: `${root}/bin:${path.dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: home, CODUMENT_HOME: home, CODEX_HOME: path.join(home, '.codex'),
    TMPDIR: path.join(home, 'tmp'), XDG_CACHE_HOME: path.join(home, 'cache'),
    BUN_INSTALL_CACHE_DIR: path.join(home, 'cache/bun'), npm_config_cache: path.join(home, 'cache/npm'),
    UV_CACHE_DIR: path.join(home, 'cache/uv'), PIP_CACHE_DIR: path.join(home, 'cache/pip'),
    LANG: 'en_US.UTF-8', TERM: 'dumb', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'E2E', GIT_AUTHOR_EMAIL: 'e2e@example.invalid', GIT_COMMITTER_NAME: 'E2E', GIT_COMMITTER_EMAIL: 'e2e@example.invalid',
  };
}
export function loadRun(root: string, candidate: string, caseId: string): Run {
  root = assertTemporary(root);
  const provenance = JSON.parse(fs.readFileSync(path.join(root,'provenance.json'),'utf8'));
  if(provenance.caseId!==caseId || provenance.model!==MODEL || provenance.sha256!==sha(candidate)) throw new Error('Resume identity mismatch');
  const bin = path.join(root,'bin/depa-codument');
  if(sha(bin)!==provenance.sha256) throw new Error('Candidate drift');
  const reverify = provenance.kind === 'ui-reverification';
  const workspace = reverify ? provenance.sourceWorkspace : path.join(root,'workspace');
  if (reverify) {
    if (typeof workspace !== 'string' || !path.isAbsolute(workspace) || !fs.existsSync(workspace)) throw new Error('Invalid historical UI re-verification workspace');
    if (!/^\/(private\/)?tmp\/depa-codument-e2e-[^/]+\/workspace$/.test(fs.realpathSync(workspace))) throw new Error('Unsafe historical UI re-verification workspace');
  }
  return { root, workspace, home:path.join(root,'home'), bin, env:isolatedEnvironment(root), readonlyWorkspace: reverify };
}
/** macOS outer boundary also constrains verifier commands and Codex internal writes. */
export function sandbox(run: Run, argv: string[], mode: boolean | 'setup' | 'review' = false): string[] {
  if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/sandbox-exec')) throw new Error('Verified macOS sandbox required; no unsafe fallback');
  assertTemporary(run.root);
  const writable = [path.join(run.home, 'cache'), path.join(run.home, 'tmp')];
  if (mode !== 'review' && !run.readonlyWorkspace) writable.push(run.workspace);
  const agent = mode === true || mode === 'review';
  if (agent) writable.push(path.join(run.home, '.codex'));
  if (mode === 'setup') writable.push(run.home);
  const realHome = os.homedir();
  const runtimePaths = ['.bun/bin', '.bun/install/global/node_modules', '.local/bin', '.local/share/uv/python'].map(p => path.join(realHome,p));
  const profile = `(version 1)(allow default)(deny file-write*)` +
    `(allow file-write* (literal "/dev/null") (literal "/dev/tty") ${writable.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})` +
    `(deny file-read* (subpath ${JSON.stringify(realHome)}))` +
    `(allow file-read-metadata (subpath ${JSON.stringify(realHome)}))` +
    `(allow file-read* ${runtimePaths.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})` +
    (agent ? '' : `(deny file-read* (subpath ${JSON.stringify(path.join(run.home,'.codex'))}))`);
  return ['/usr/bin/sandbox-exec', '-p', profile, ...argv];
}
export async function setup(run: Run, nested = false): Promise<void> {
  const repos = nested ? ['main-repo', 'inventory-repo'].map(p => path.join(run.workspace, p)) : [run.workspace];
  for (const [i, cwd] of repos.entries()) {
    fs.mkdirSync(cwd, { recursive: true });
    for (const [name, argv] of [
      ['git', ['git', '-c', 'init.templateDir=', 'init', '-q']],
      ['init', [run.bin, 'init', '--agent=codex', '--json']],
    ] as const) {
      const result = await execute({ argv: sandbox(run, [...argv], 'setup'), cwd, env: run.env, log: path.join(run.root, `logs/setup-${i}-${name}.log`) });
      if (result.code) throw new Error(`Setup ${name} failed: ${result.code}`);
    }
    if (fs.existsSync(path.join(cwd, 'codument/std'))) throw new Error('Workspace std unexpectedly distributed');
    if (!fs.existsSync(path.join(cwd, 'codument/SKILL.md'))) throw new Error('Workspace SkillApp missing');
    const profiles = fs.readFileSync(path.join(cwd,'codument/config/attractor-profiles.xnl'),'utf8');
    for (const match of profiles.matchAll(/skill:\/\/depa-codument\/([^"\s]+)/g)) {
      if (!fs.existsSync(path.join(run.home,'.agents/skills/depa-codument',match[1]!))) throw new Error('Dangling initialized global reference: '+match[1]);
    }
  }
  const skill = path.join(run.home, '.agents/skills/depa-codument');
  if (!fs.existsSync(path.join(skill, 'references/std/compat/operation-alias.md'))) throw new Error('Global App alias missing');
  for (const retired of ['std', 'references/std/operations', 'references/std/commands', 'references/std/kernel-pointer.md']) {
    if (fs.existsSync(path.join(skill, retired))) throw new Error(`Retired global asset: ${retired}`);
  }
  writeJson(path.join(run.root, 'installation.json'), { skill, hash: treeHash(skill), files: files(skill).length });
}
export function installAuthentication(run: Run, authSource: string): void {
  // Copy only the auth file, never config, history, plugins or personal instructions.
  const auth = path.join(run.home, '.codex/auth.json');
  fs.copyFileSync(authSource, auth); fs.chmodSync(auth, 0o600);
}
export function removeAuthentication(run: Run): void {
  const auth = path.join(run.home, '.codex/auth.json');
  if (fs.existsSync(auth)) fs.unlinkSync(auth);
}
export function codexArgs(run: Run, codex: string, prompt: string, name: string, outputFile = path.join(run.workspace, `.e2e-${name}-last.md`)): string[] {
  return [codex, 'exec', '--ignore-user-config', '--ignore-rules', '--json',
    '-m', MODEL, '-c', `model_reasoning_effort="${EFFORT}"`,
    '-c', 'approval_policy="never"', '-c', 'sandbox_workspace_write.network_access=true',
    '-c', 'sandbox_workspace_write.exclude_slash_tmp=true', '-c', 'sandbox_workspace_write.exclude_tmpdir_env_var=true',
    '-c', 'shell_environment_policy.inherit="all"',
    // Seatbelt is already applied to the whole process tree; macOS rejects reapplying it.
    '--sandbox', 'danger-full-access', '-C', run.workspace, '--skip-git-repo-check',
    '-o', outputFile, prompt];
}
export interface Usage { input: number; cached: number; output: number }
export interface CommandExecution { command: string; argv?: readonly string[]; exitCode: number | null }
export function readEvents(file: string): { usage: Usage | null; failed: boolean; completed: boolean; reconnects: string[]; threadId?: string; commands: string[]; executions: CommandExecution[] } {
  const result: ReturnType<typeof readEvents> = { usage: null, failed: false, completed: false, reconnects: [], commands: [], executions:[] };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'thread.started') result.threadId = e.thread_id;
    if (e.type === 'turn.started') result.completed = false;
    if (e.type === 'turn.failed') result.failed = true;
    if (e.type === 'error') {
      // Codex emits reconnect notifications as error events even when the same
      // turn subsequently completes. Only this observed nonterminal shape is
      // recoverable; unknown errors and terminal failures remain failures.
      if (typeof e.message === 'string' && /^Reconnecting\.\.\. \d+\/\d+ \(/.test(e.message)) result.reconnects.push(e.message);
      else result.failed = true;
    }
    if (e.type === 'turn.completed') result.completed = true;
    if (e.type === 'turn.completed' && e.usage) {
      result.usage ??= { input: 0, cached: 0, output: 0 };
      result.usage.input += e.usage.input_tokens;
      result.usage.cached += e.usage.cached_input_tokens ?? 0;
      result.usage.output += e.usage.output_tokens;
    }
    if (e.type === 'item.completed' && e.item?.type === 'command_execution') {
      result.commands.push(e.item.command);
      result.executions.push({command:e.item.command,exitCode:e.item.exit_code ?? null});
    }
  }
  if (!result.completed) result.failed = true;
  return result;
}
export const defaultAuth = () => path.join(os.homedir(), '.codex/auth.json');
