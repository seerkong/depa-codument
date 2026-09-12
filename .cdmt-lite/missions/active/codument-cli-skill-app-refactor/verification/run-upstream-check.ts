import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite';
const directory = join(import.meta.dir, 'logs');
const label = process.argv[2] ?? 'round-11-final';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid evidence label');
await mkdir(directory, { recursive: true });
const checks = (process.argv.includes('--check-only') ? ['check'] : ['check', 'verify:public-cli', 'verify:public-resources', 'verify:public-optionals'])
  .map((script) => ({ script, args: ['run', script] }));
if (!process.argv.includes('--check-only')) checks.push({ script: 'verify:public-legacy', args: ['run', 'scripts/verify-public-cli.ts', '--resources', '--legacy-fixture', join(import.meta.dir, 'legacy-frozen-fixtures.json')] });
if (process.argv.includes('--product-effects')) checks.push({ script: 'verify:product-effects', args: ['run', 'verify:product-effects'] });
if (process.argv.includes('--product-cli')) checks.push({ script: 'verify:product-cli', args: ['run', 'scripts/verify-public-optionals.ts', '--halfcode-product-cli'] });
for (const { script, args } of checks) {
  const child = Bun.spawn([process.execPath, ...args], {
    cwd: root,
    env: { ...process.env, PATH: '/Users/kongweixian/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' },
    stdout: 'pipe', stderr: 'pipe',
  });
  const deadline = setTimeout(() => child.kill('SIGKILL'), 180_000);
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]).finally(() => clearTimeout(deadline));
  const log = join(directory, `${label}-${script.replaceAll(':', '-')}.log`);
  await writeFile(log, `command: bun ${args.join(' ')}\nexit: ${code}\n${stdout}\n${stderr}`, { flag: 'wx' });
  console.log(JSON.stringify({ script, code, log, tail: (stdout + '\n' + stderr).split('\n').slice(-9) }));
  if (code !== 0) process.exitCode = 1;
}
