import { cp, lstat, mkdir, mkdtemp, readlink, realpath, readdir, writeFile } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';

const source = '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite';
const compilerLink = join(source, 'node_modules/halfcode-compiler.xnl');
const target = await realpath(process.argv[2] ?? await mkdtemp('/tmp/halfcode-contract-011-'));
if (!target.startsWith('/private/tmp/halfcode-contract-011-')) throw new Error('Snapshot target outside temporary prefix');
const inside = (path: string) => { const p = relative(source, path); return !isAbsolute(p) && p !== '..' && !p.startsWith('../'); };
async function checkLinks(path: string): Promise<void> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) {
    if (path === compilerLink) return; // Copy this observed vendor as independent bytes below.
    if (isAbsolute(await readlink(path)) || !inside(await realpath(path))) throw new Error('External snapshot link: ' + path);
  } else if (stat.isDirectory()) for (const name of await readdir(path)) await checkLinks(join(path, name));
}
const listing = Bun.spawnSync(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: source });
if (listing.exitCode) throw new Error('Git inventory failed');
for (const name of [...new Set(listing.stdout.toString().split('\0').filter(Boolean))]) {
  if (name.startsWith('codument/') || name.startsWith('.cdmt-lite/')) continue;
  const path = join(source, name);
  if (!await Bun.file(path).exists()) continue;
  await checkLinks(path);
  await mkdir(join(target, name, '..'), { recursive: true });
  await cp(path, join(target, name), { verbatimSymlinks: true, force: true });
}
for (const name of ['node_modules', ... (await readdir(join(source, 'packages'))).map(p => 'packages/' + p + '/node_modules')]) {
  try { await lstat(join(source, name)); } catch { continue; }
  try { await lstat(join(target, name)); continue; } catch { /* New isolated dependency directory. */ }
  await checkLinks(join(source, name));
  await cp(join(source, name), join(target, name), { recursive: true, verbatimSymlinks: true, errorOnExist: true, filter: path => path !== compilerLink });
}
// The development compiler link has further workspace links. Use the already
// installed immutable 0.3.0 distribution, not a writable external compiler tree.
const compilerSource = '/Users/kongweixian/infra-dev/depa-codument/project/node_modules/.bun/halfcode-compiler.xnl@0.3.0/node_modules/halfcode-compiler.xnl';
await checkLinks(compilerSource);
await cp(compilerSource, join(target, 'node_modules/halfcode-compiler.xnl'), { recursive: true, force: true });
for (const name of ['bun.lock']) if (await Bun.file(join(source, name)).exists()) await cp(join(source, name), join(target, name));
await writeFile(join(target, 'snapshot-source.json'), JSON.stringify({ source, target, compilerSourceCopied: compilerSource, excludes: ['codument', '.cdmt-lite', '.git'], externalLinks: false }));
const gitInit = Bun.spawnSync(['git', '-c', 'init.templateDir=', 'init', '--quiet', target], { env: { PATH: '/usr/bin:/bin', HOME: target, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
if (gitInit.exitCode) throw new Error('Isolated Git initialization failed');
console.log(target);
