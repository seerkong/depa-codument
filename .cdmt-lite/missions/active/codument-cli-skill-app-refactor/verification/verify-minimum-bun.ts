import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Download a pinned test runtime into a disposable directory, never change the user's Bun installation.
assert.equal(process.platform, 'darwin');
assert.equal(process.arch, 'arm64');
const version = '1.3.0';
const label = process.argv[2] ?? 'round-11-minimum-bun';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid evidence label');
const tarball = 'https://registry.npmjs.org/@oven/bun-darwin-aarch64/-/bun-darwin-aarch64-1.3.0.tgz';
const downloadUrl = process.argv[3] === '--curl-mirror'
  ? 'https://registry.npmmirror.com/@oven/bun-darwin-aarch64/-/bun-darwin-aarch64-1.3.0.tgz' : tarball;
const integrity = 'sha512-WeXSaL29ylJEZMYHHW28QZ6rgAbxQ1KuNSZD9gvd3fPlo0s6s2PglvPArjjP07nmvIK9m4OffN0k4M98O7WmAg==';
const temporary = await mkdtemp(join(tmpdir(), 'halfcode-minimum-bun-'));
const root = '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite';
async function run(command: string[], cwd: string, timeoutMs = 180_000): Promise<string> {
  const child = Bun.spawn(command, { cwd, env: { ...process.env, PATH: join(temporary, 'package/bin') + ':/Users/kongweixian/.bun/bin:/usr/local/bin:/usr/bin:/bin' }, stdout: 'pipe', stderr: 'pipe' });
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
  if (code !== 0) throw new Error(JSON.stringify({ command, code, stdout, stderr }));
  return stdout + stderr;
}
try {
  const archive = join(temporary, 'bun.tgz');
  if (process.argv[3] === '--curl' || process.argv[3] === '--curl-mirror') {
    await run(['/usr/bin/curl', '--fail', '--location', '--silent', '--show-error', '--connect-timeout', '15', '--max-time', '240', '--output', archive, downloadUrl], temporary, 270_000);
  } else {
    const response = await fetch(tarball, { signal: AbortSignal.timeout(60_000) });
    assert.ok(response.ok);
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  }
  assert.equal('sha512-' + createHash('sha512').update(await readFile(archive)).digest('base64'), integrity);
  console.log(JSON.stringify({ stage: 'runtime-downloaded-and-verified', version, downloadUrl, integrity }));
  await run(['tar', '-xzf', archive, '-C', temporary], temporary);
  const binary = join(temporary, 'package/bin/bun');
  assert.equal((await run([binary, '--version'], temporary)).trim(), version);
  const binaryDigest = createHash('sha256').update(await readFile(binary)).digest('hex');
  const releaseSetChecks = process.argv.includes('--same-release-set');
  const releaseIndex = process.argv.indexOf('--release-set');
  const releaseDirectory = releaseIndex < 0 ? join(import.meta.dir, 'host-release-round-15') : process.argv[releaseIndex + 1];
  const productIndex = process.argv.indexOf('--product-set');
  const productDirectory = productIndex < 0 ? join(import.meta.dir, 'round-15-codument-final-adoption-artifacts') : process.argv[productIndex + 1];
  assert.ok(releaseDirectory && productDirectory, 'Release/product directory missing');
  const checks = releaseSetChecks ? [
    ['notes', [join(import.meta.dir, 'verify-notes-release.ts'), label + '-notes-consumer', '--release-set', releaseDirectory]],
    ['halfcode', [join(import.meta.dir, 'verify-halfcode-release.ts'), releaseDirectory, label + '-halfcode-consumer']],
    ['codument', [join(import.meta.dir, 'verify-codument-release.ts'), label + '-codument-consumer', '--full-cli', '--product-set', productDirectory, '--release-set', releaseDirectory]],
  ] as const : [
    ['cli', ['run', 'scripts/verify-public-cli.ts']],
    ['resources', ['run', 'scripts/verify-public-cli.ts', '--resources', '--legacy-fixture', join(import.meta.dir, 'legacy-frozen-fixtures.json')]],
    ['optionals', ['run', 'scripts/verify-public-optionals.ts', ...(process.argv.includes('--product-cli') ? ['--halfcode-product-cli'] : [])]],
  ] as const;
  const cloneChecks: readonly (readonly [string, readonly string[]])[] = process.argv.includes('--clone-producers') ? [
    ['halfcode-clone', [join(import.meta.dir, 'verify-clone-release.ts'), label + '-halfcode-clone-consumer', releaseDirectory, root]],
    ['codument-clone', [join(import.meta.dir, 'verify-clone-release.ts'), label + '-codument-clone-consumer', releaseDirectory, '/Users/kongweixian/infra-dev/depa-codument/project']],
  ] : [];
  for (const [name, args] of [...checks, ...cloneChecks]) {
    const output = await run([binary, ...args], root);
    await writeFile(join(import.meta.dir, 'logs', `${label}-${name}.log`), `runtime: ${version}\nbinarySha256: ${binaryDigest}\narchiveIntegrity: ${integrity}\ndownloadUrl: ${downloadUrl}\nexit: 0\n${output}`, { flag: 'wx' });
    console.log(JSON.stringify({ suite: name, runtime: version, binaryDigest, exit: 0 }));
  }
} catch (error) {
  await writeFile(join(import.meta.dir, 'logs', `${label}-failure.log`), String(error), { flag: 'wx' });
  throw error;
} finally { await rm(temporary, { recursive: true, force: true }); }
