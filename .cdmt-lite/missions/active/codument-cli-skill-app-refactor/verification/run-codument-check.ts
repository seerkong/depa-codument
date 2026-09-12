import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [label, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? '') || !args.length) throw new Error('Require unique label and Bun arguments');
const child = Bun.spawn([process.execPath, ...args], { cwd: resolve(import.meta.dir, '../../../../../project'),
  env: process.env, stdout: 'pipe', stderr: 'pipe' });
const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
await writeFile(join(import.meta.dir, 'logs', label + '.log'), `command: bun ${args.join(' ')}\nexit: ${code}\n${stdout}\n${stderr}`, { flag: 'wx' });
console.log(JSON.stringify({ code, tail: (stdout + '\n' + stderr).split('\n').slice(-26) }));
if (code !== 0) process.exitCode = 1;
