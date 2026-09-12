import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const candidate = '/private/tmp/depa-codument-verification-eF1WjC/depa-codument-candidate';
const target = '/Users/kongweixian/.local/bin/depa-codument';
const oldBin = '/Users/kongweixian/.local/bin/codument';
const hash = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex');
const oldHash = await hash(oldBin);
assert.equal(oldHash, '05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8');
assert.ok((await lstat(target)).isFile());
const previousHash = await hash(target);
assert.equal(previousHash, '7b5abdf078cd211e3e56630e978be016814fc51ea08e6ee4f1453e89e2503d90');
const candidateHash = await hash(candidate);
const backup = await mkdtemp('/Users/kongweixian/.local/bin/.depa-codument-install-');
const previous = join(backup, 'depa-codument.previous');
const staged = join(backup, 'depa-codument.next');
await copyFile(target, previous);
await copyFile(candidate, staged);
await chmod(staged, 0o755);
assert.equal(await hash(staged), candidateHash);
assert.equal(await hash(target), previousHash);
await rename(staged, target);
try {
  const child = Bun.spawn([target, '-w', '/private/tmp/depa-codument-verification-eF1WjC', 'upgrade-global', '--agent=claude,codex,eidolon', '--json'], {
    env: { ...process.env, CODUMENT_HOME: '/Users/kongweixian' }, stdout: 'pipe', stderr: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  assert.equal(code, 0, stdout + stderr);
  assert.equal(await hash(oldBin), oldHash);
  const receipt = { candidateHash, target, binaryBackup: previous, global: JSON.parse(stdout), oldBinUnchanged: true };
  await writeFile(join(import.meta.dir, 'logs/round-44-global-install.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(receipt));
} catch (error) {
  if (await hash(target) === candidateHash) {
    await copyFile(previous, staged);
    await rename(staged, target);
  }
  throw error;
}
