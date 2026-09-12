import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const project = resolve(import.meta.dir, '../../../../..', 'project');
const scratch = mkdtempSync(join(tmpdir(), 'depa-codument-bin-isolation-'));
const legacy = '/Users/kongweixian/.local/bin/codument';
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const original = { sha: sha(legacy), mode: lstatSync(legacy).mode };
const source = resolve(project, 'dist/depa-codument');
assert(existsSync(source));
assert(!existsSync(resolve(project, 'dist/codument')));
const native = JSON.parse(readFileSync(resolve(project, 'packages/runtime-darwin-arm64/package.json'), 'utf8'));
assert.deepEqual(native.bin, { 'depa-codument': 'bin/depa-codument' });
const pkg = join(scratch, 'package');
const prefix = join(scratch, 'prefix');
mkdirSync(join(pkg, 'bin'), { recursive: true });
mkdirSync(join(prefix, 'bin'), { recursive: true });
copyFileSync(source, join(pkg, 'bin/depa-codument'));
// This tests the installation bin layer, not the already separately tested dependency closure.
writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: native.name, version: native.version, bin: native.bin, files: ['bin/depa-codument'] }));
const sentinel = join(prefix, 'bin/codument');
writeFileSync(sentinel, '#!/bin/sh\nprintf "legacy-session-preserved\\n"\n');
chmodSync(sentinel, 0o755);
const sentinelHash = sha(sentinel);
async function run(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { cwd: scratch, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, npm_config_cache: join(scratch, 'npm-cache') } });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  assert.equal(code, 0, stderr || stdout);
  return stdout;
}
await run(['npm', 'install', '--global', '--prefix', prefix, '--ignore-scripts', '--offline', '--no-audit', '--no-fund', pkg]);
assert.equal(sha(sentinel), sentinelHash);
assert.equal((await run([sentinel])).trim(), 'legacy-session-preserved');
const installed = join(prefix, 'bin/depa-codument');
assert.equal(sha(installed), sha(source));
const version = (await run([installed, '--version'])).trim();
const help = await run([installed, '--help']);
assert(help.includes('depa-codument'));
const packedTargets: string[] = [];
for (const target of ['darwin-arm64', 'darwin-x64', 'windows-x64']) {
  const packageRoot = resolve(project, `packages/runtime-${target}`);
  const pack = JSON.parse(await run(['npm', 'pack', '--dry-run', '--json', '--ignore-scripts', packageRoot]));
  const binaryFiles = pack[0].files.map((file: { path: string }) => file.path).filter((file: string) => file.startsWith('bin/'));
  assert.deepEqual(binaryFiles, [target === 'windows-x64' ? 'bin/depa-codument.exe' : 'bin/depa-codument']);
  packedTargets.push(target);
}
assert.deepEqual({ sha: sha(legacy), mode: lstatSync(legacy).mode }, original);
const report = { scope: 'actual-compiled-binary-and-isolated-bin-installation', scratch, version, binarySha256: sha(source), packedTargets, oldSentinelUnchanged: true, realLegacyUnchanged: original, dependencyClosure: 'NOT_RERUN', globalInstallation: 'NOT_TOUCHED' };
writeFileSync(join(import.meta.dir, 'logs/round-35-bin-isolation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
