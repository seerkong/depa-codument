import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execute, sandbox, sha, writeJson, type Run } from './runtime';

export function runtimeWrapper(executable: string): string {
  assert.ok(path.isAbsolute(executable) && !/[\r\n\0]/.test(executable), 'Absolute single-line runtime path required');
  return `#!/bin/sh\nexec '${executable.replaceAll("'", "'\\''")}' "$@"\n`;
}

/** Discover existing read-only runtimes before spending a model turn. No download or global install. */
export async function preparePython(run: Run): Promise<void> {
  const uv = path.join(os.homedir(), '.local/bin/uv');
  const managed = fs.realpathSync(path.join(os.homedir(), '.local/share/uv/python'));
  fs.accessSync(uv, fs.constants.X_OK);
  const env = { ...run.env, UV_PYTHON_INSTALL_DIR: managed, UV_PYTHON_DOWNLOADS: 'never' };
  const prefix = path.join(run.root, `logs/python-preflight-${Date.now()}`);
  const discovery = await execute({ argv: sandbox(run, [uv, 'python', 'find', '--managed-python', '--no-python-downloads', '3.12']), cwd: run.workspace, env, log: prefix + '-find.log' });
  assert.equal(discovery.code, 0, 'An existing managed Python 3.12 is required; see runtime preflight log');
  const python = fs.realpathSync(fs.readFileSync(prefix + '-find.log', 'utf8').trim());
  assert.ok(python.startsWith(managed + path.sep), 'Python must stay in the admitted read-only managed runtime directory');
  const version = await execute({ argv: sandbox(run, [python, '--version']), cwd: run.workspace, env, log: prefix + '-version.log' });
  assert.equal(version.code, 0, 'Selected Python cannot execute inside the sandbox');
  assert.match(fs.readFileSync(prefix + '-version.log', 'utf8'), /^Python 3\.12\.\d+\s*$/);
  const receipt = { uv, uvSha256: sha(uv), python, pythonSha256: sha(python), version: fs.readFileSync(prefix + '-version.log', 'utf8').trim() };
  const receiptFile = path.join(run.root, 'python-runtime.json');
  if (fs.existsSync(receiptFile)) assert.deepEqual(JSON.parse(fs.readFileSync(receiptFile, 'utf8')), receipt, 'Resume Python runtime drift');
  for (const [name, executable] of [['uv', uv], ['python3.12', python], ['python3', python]] as const) {
    fs.writeFileSync(path.join(run.root, 'bin', name), runtimeWrapper(executable), { mode: 0o755 });
  }
  Object.assign(run.env, env, { UV_PYTHON: python });
  writeJson(receiptFile, receipt);
}
