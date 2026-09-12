import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

// Immutable recovery material, not a second source owner. No automatic restore.
const roots = {
  H: '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite',
  C: '/Users/kongweixian/infra-dev/depa-codument',
};
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const git = (root: string, args: string[]) => {
  const result = Bun.spawnSync(['git', '-C', root, ...args]);
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString();
};
const out = resolve(import.meta.dir, '../verification/cross-repo-baseline');
const mode = process.argv[2];
if (!['capture', 'check'].includes(mode)) throw new Error('Usage: cross-repo-baseline.ts capture|check');
for (const [id, root] of Object.entries(roots)) {
  const scope = id === 'C' ? ['src', 'codument', 'project'] : ['.'];
  const paths = [...new Set(git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...scope]).split('\0').filter(Boolean))].sort();
  const entries = paths.map((path) => {
    const full = resolve(root, path);
    if (relative(root, full).startsWith('../')) throw new Error(`Out of root: ${path}`);
    let stat;
    try { stat = lstatSync(full); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { path, kind: 'missing', hash: 'MISSING', mode: 0, bytes: '' };
    }
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error(`Unsupported source: ${path}`);
    const bytes = stat.isSymbolicLink() ? Buffer.from(readlinkSync(full)) : readFileSync(full);
    return { path, kind: stat.isSymbolicLink() ? 'symlink' : 'file', mode: stat.mode & 0o777, hash: hash(bytes), bytes: bytes.toString('base64') };
  });
  const digest = hash(entries.map((entry) => entry.path + '\0' + entry.hash).join('\n'));
  const snapshot = { root, head: git(root, ['rev-parse', 'HEAD']).trim(), status: git(root, ['status', '--short']), digest, entries };
  const archive = resolve(out, `${id}.json.gz`);
  if (mode === 'capture') {
    if (existsSync(archive)) throw new Error(`Refusing to overwrite recovery material: ${archive}`);
    mkdirSync(out, { recursive: true });
    writeFileSync(archive, gzipSync(JSON.stringify(snapshot)));
    const { entries: _, ...summary } = snapshot;
    writeFileSync(resolve(out, `${id}.json`), JSON.stringify({ ...summary, archiveSha256: hash(readFileSync(archive)), files: entries.map(({ bytes, ...entry }) => entry) }, null, 2) + '\n');
  } else {
    const baseline = JSON.parse(gunzipSync(readFileSync(archive)).toString()) as typeof snapshot;
    for (const entry of baseline.entries) {
      if (entry.kind !== 'missing' && hash(Buffer.from(entry.bytes, 'base64')) !== entry.hash) throw new Error(`Corrupt recovery bytes: ${entry.path}`);
    }
    const actual = new Map(entries.map((entry) => [entry.path, entry]));
    const changed = baseline.entries.filter((entry) => actual.get(entry.path)?.hash !== entry.hash || actual.get(entry.path)?.mode !== entry.mode).map((entry) => entry.path);
    const known = new Set(baseline.entries.map((entry) => entry.path));
    const added = paths.filter((path) => !known.has(path));
    console.log(JSON.stringify({ id, baseline: baseline.digest, changed, added }));
  }
  console.log(JSON.stringify({ id, head: snapshot.head, count: entries.length, digest }));
}
