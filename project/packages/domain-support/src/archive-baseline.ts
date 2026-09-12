import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { KnowledgeBaselinePort } from 'depa-codument-domain-contract';

/** Reads pinned Git objects directly. No checkout, temporary source tree,
 * filters, network, or interpretation of historical knowledge syntax. */
export function createGitKnowledgeBaselinePort(spec: {readonly workspaceRoot: string; readonly env: Readonly<Record<string, string | undefined>>}): KnowledgeBaselinePort {
  if (!path.isAbsolute(spec.workspaceRoot)) throw new Error('Knowledge baseline workspace root must be absolute.');
  const root = path.resolve(spec.workspaceRoot);
  const env: Record<string, string | undefined> = {...spec.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0',
    GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: ''};
  // Repository routing is owned by workspaceRoot, not a parent Git process.
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE', 'GIT_CEILING_DIRECTORIES', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS']) delete env[key];
  for (const key of Object.keys(env)) if (/^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(key)) delete env[key];
  const text = (bytes: Uint8Array) => new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  async function git(args: string[]): Promise<Uint8Array> {
    const child = Bun.spawn(['git', '--no-pager', ...args], {cwd: root, env, stdout: 'pipe', stderr: 'pipe', stdin: 'ignore'});
    let timedOut = false;
    const timer = setTimeout(() => {timedOut = true; child.kill('SIGKILL');}, 30_000);
    const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).arrayBuffer(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
    if (timedOut || code !== 0) throw new Error(`Unable to read knowledge Git baseline (${timedOut ? 'timeout' : `exit ${code}`}): ${error.trim()}`);
    return new Uint8Array(output);
  }
  function portable(file: string) {
    if (!file || file.includes('\\') || /[\x00-\x1f\x7f]/.test(file) || file.split('/').some(segment => !segment || segment === '.' || segment === '..')) throw new Error('Knowledge Git path must be a portable relative source path.');
    return file;
  }
  return {
    async read(input) {
      const {family, commit: requestedCommit} = structuredClone(input);
      if (!['modeling', 'engineering'].includes(family) || typeof requestedCommit !== 'string' || !requestedCommit
        || requestedCommit.startsWith('-') || /[\x00-\x20\x7f]/.test(requestedCommit)) throw new Error('Invalid knowledge baseline family or commit.');
      const commit = text(await git(['rev-parse', '--verify', '--end-of-options', `${requestedCommit}^{commit}`])).trim();
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) throw new Error('Git did not return one immutable commit identity.');
      const prefix = text(await git(['rev-parse', '--show-prefix'])).replace(/\r?\n$/, '');
      const repositoryPath = portable(`${prefix}codument/${family}`);
      const tree = text(await git(['ls-tree', '-r', '-z', '--full-tree', commit, '--', `:(literal)${repositoryPath}`]));
      const sources = new Map<string, string>(), blobIds = new Map<string, string>();
      for (const row of tree.split('\0').filter(Boolean)) {
        const match = /^(\d{6}) (\S+) ([a-f0-9]{40}|[a-f0-9]{64})\t([\s\S]+)$/.exec(row);
        if (!match) throw new Error('Git returned an ambiguous knowledge tree entry.');
        const [, mode, type, oid, file] = match;
        if (file === repositoryPath) throw new Error('Historical knowledge root is not a directory.');
        if (!file.startsWith(repositoryPath + '/')) throw new Error('Git baseline entry is outside the selected knowledge root.');
        const relative = portable(file.slice(repositoryPath.length + 1));
        if (relative.split('/').some(segment => segment.startsWith('.'))) continue;
        if (!['100644', '100755'].includes(mode) || type !== 'blob') throw new Error(`Historical knowledge contains a link or unsupported entry: ${relative}`);
        if (!/\.(xnl|xml)$/i.test(relative)) continue;
        if (sources.has(relative)) throw new Error('Duplicate historical knowledge source.');
        const bytes = await git(['cat-file', 'blob', oid]);
        const digest = createHash(oid.length === 40 ? 'sha1' : 'sha256').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
        if (digest !== oid) throw new Error(`Knowledge Git blob integrity mismatch: ${relative}`);
        sources.set(relative, text(bytes)); blobIds.set(relative, oid);
      }
      return Object.freeze({family, commit, repositoryPath, sources, blobIds});
    },
  };
}
