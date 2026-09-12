import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

const root = '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite';
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const baseline = JSON.parse(readFileSync(join(import.meta.dir, 'cross-repo-baseline/H.json'), 'utf8'));
const relocation = JSON.parse(readFileSync(join(import.meta.dir, 'cross-repo-public-relocation.json'), 'utf8')) as Array<{
  target: string; source: string; inputSha256: string | null;
}>;
const before = new Map<string, { hash: string; mode: number }>(baseline.files.map((file: { path: string }) => [file.path, file]));
const origins = new Map(relocation.map((file) => [file.target, file]));
const liveRelocation = JSON.parse(readFileSync(join(import.meta.dir, 'cross-repo-live-relocation.json'), 'utf8'));
for (const file of liveRelocation.files) origins.set(join(root, file.target), {
  target: join(root, file.target), source: join(liveRelocation.sourceRoot, file.source), inputSha256: file.digest,
});
const git = Bun.spawnSync(['git', '-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z']);
if (git.exitCode) throw new Error(git.stderr.toString());
const paths = [...new Set(git.stdout.toString().split('\0').filter(Boolean))].sort();
const all = paths.map((path) => {
  const target = join(root, path);
  const stat = lstatSync(target);
  const outputSha256 = hash(stat.isSymbolicLink() ? readlinkSync(target) : readFileSync(target));
  const input = before.get(path);
  const origin = origins.get(target);
  return { path, outputSha256, mode: stat.mode & 0o777, baselineSha256: input?.hash ?? null,
    origin: origin ? { source: origin.source, inputSha256: origin.inputSha256 } : input ? 'retained upstream file' : 'new public composition or verification',
    changed: input?.hash !== outputSha256 || input?.mode !== (stat.mode & 0o777) };
});
console.log(JSON.stringify({ root, baseline: baseline.digest,
  currentDigest: hash(all.map((file) => file.path + '\0' + file.outputSha256).join('\n')),
  currentCount: all.length, changed: all.filter((file) => file.changed),
  removed: [...before.keys()].filter((path) => !paths.includes(path)),
}, null, 2));
