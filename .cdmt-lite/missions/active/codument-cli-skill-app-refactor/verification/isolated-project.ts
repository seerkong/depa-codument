import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const source = resolve(import.meta.dir, '../../../../..');
const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label ?? '')) throw new Error('Unique verification label required');
const within = (root: string, target: string) => { const p = relative(root, target); return !isAbsolute(p) && p !== '..' && !p.startsWith('../'); };
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
async function fingerprint(root: string): Promise<string> {
  const rows: string[] = [];
  async function walk(path: string) {
    const stat = await fs.lstat(path);
    if (stat.isSymbolicLink()) rows.push(`${relative(root, path)}:${stat.mode}:link:${await fs.readlink(path)}`);
    else if (stat.isDirectory()) { rows.push(`${relative(root, path)}:${stat.mode}:dir`); for (const name of (await fs.readdir(path)).sort()) await walk(join(path, name)); }
    else rows.push(`${relative(root, path)}:${stat.mode}:${digest(await fs.readFile(path))}`);
  }
  await walk(root); return digest(rows.join('\n'));
}
const oldBin = '/Users/kongweixian/.local/bin/codument';
const observeProtected = async () => ({ workspace: await fingerprint(join(source, 'codument')),
  oldBin: await fingerprint(oldBin), oldBinBytes: digest(await fs.readFile(oldBin)) });
const protectedBefore = await observeProtected();
const temporary = await fs.realpath(await fs.mkdtemp('/tmp/depa-codument-verification-'));
const target = join(temporary, 'depa-codument'), home = join(temporary, 'home');
await fs.mkdir(target); await fs.mkdir(home);
const copied: { path: string; sha256?: string; link?: string }[] = [];
async function copy(path: string) {
  if (!within(source, path)) throw new Error('Source escape');
  const local = relative(source, path), destination = join(target, local), stat = await fs.lstat(path);
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    for (const name of await fs.readdir(path)) await copy(join(path, name));
    await fs.chmod(destination, stat.mode & 0o777);
  } else if (stat.isSymbolicLink()) {
    const resolved = await fs.realpath(path);
    if (!within(source, resolved)) throw new Error('External link cannot enter writable verification copy: ' + local);
    const link = relative(dirname(destination), join(target, relative(source, resolved)));
    await fs.mkdir(dirname(destination), { recursive: true }); await fs.symlink(link, destination);
    copied.push({ path: local, link });
  } else if (stat.isFile()) {
    const bytes = await fs.readFile(path);
    await fs.mkdir(dirname(destination), { recursive: true }); await fs.writeFile(destination, bytes, { flag: 'wx', mode: stat.mode & 0o777 });
    if ((await fs.stat(destination)).ino === stat.ino) throw new Error('Shared inode');
    copied.push({ path: local, sha256: digest(bytes) });
  } else throw new Error('Unsupported snapshot file: ' + local);
}
try {
  const listing = Bun.spawnSync(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: source });
  if (listing.exitCode) throw new Error('Cannot enumerate working tree');
  for (const file of [...new Set(listing.stdout.toString().split('\0').filter(Boolean))].sort()) {
    if (file.startsWith('.cdmt-lite/') || file.startsWith('codument/')) continue; // Dogfood is copied completely below.
    if (!await fs.exists(join(source, file))) continue; // A tracked deletion stays deleted.
    await copy(join(source, file));
  }
  await copy(join(source, 'codument'));
  for (const lock of ['project/bun.lock', 'project/bun.lockb']) {
    if (await fs.exists(join(source, lock)) && !await fs.exists(join(target, lock))) await copy(join(source, lock));
  }
  await copy(join(source, 'project/node_modules'));
  for (const name of await fs.readdir(join(source, 'project/packages'))) {
    const packageRoot = join(source, 'project/packages', name);
    if (await fs.exists(join(target, 'project/packages', name, 'package.json')) && await fs.exists(join(packageRoot, 'node_modules'))) await copy(join(packageRoot, 'node_modules'));
  }
  if (await fingerprint(join(target, 'codument')) !== protectedBefore.workspace) throw new Error('Dogfood copy differs before migration');
  // Independent Git discovery for clone tests: no original history or hooks.
  const initialized = Bun.spawnSync(['git', '-c', 'init.templateDir=', 'init', '--quiet', target], {
    env: { PATH: '/usr/bin:/bin', HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  });
  if (initialized.exitCode) throw new Error('Cannot initialize isolated Git context: ' + initialized.stderr.toString());
  const entry = join(target, 'project/packages/cli/src/cli/index.ts');
  const probe = Bun.spawn([process.execPath, entry, '-w', target, 'upgrade-workspace', '--json'], {
    cwd: target, stdout: 'pipe', stderr: 'pipe', env: { PATH: '/usr/bin:/bin', HOME: home, CODUMENT_HOME: home,
      TMPDIR: temporary, XDG_CONFIG_HOME: join(home, '.config'), XDG_CACHE_HOME: join(home, '.cache'), CODEX_BIN: '/must-not-start/codex' },
  });
  const timer = setTimeout(() => probe.kill('SIGKILL'), 60_000);
  const [code, stdout, stderr] = await Promise.all([probe.exited, new Response(probe.stdout).text(), new Response(probe.stderr).text()]).finally(() => clearTimeout(timer));
  if (code !== 0 && code !== 2) throw new Error(`Isolated upgrade failed: ${code}\n${stdout}\n${stderr}`);
  const receipt = JSON.parse(stdout);
  if (JSON.stringify(await observeProtected()) !== JSON.stringify(protectedBefore)) throw new Error('Protected original changed');
  const report = { target, home, temporary, source, copiedFiles: copied.length, sourceManifestDigest: digest(JSON.stringify(copied)),
    exclusions: ['original .git metadata (independent unborn repository created)', '.cdmt-lite control-plane', 'gitignored outputs except full codument assets, original project lock and project/package node_modules'],
    protectedBefore, protectedUnchanged: true, code, receipt, stderr };
  await fs.writeFile(join(temporary, 'snapshot.json'), JSON.stringify({ ...report, files: copied }, null, 2));
  await fs.writeFile(join(import.meta.dir, 'logs', label + '.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ ...report, receipt: { status: receipt.status, resources: receipt.resources, diagnosticCount: receipt.diagnostics?.length } }));
} catch (error) {
  console.error(JSON.stringify({ temporary, retainedForDiagnosis: true, protectedUnchanged: JSON.stringify(await observeProtected()) === JSON.stringify(protectedBefore) }));
  throw error;
}
