import * as fs from 'node:fs';
import * as path from 'node:path';

/** Resolve the actual installed closure, including a source-checkout npm link. */
export function resolveOpenCli(): { executable: string; installRoot: string } {
  const executable = process.env.E2E_OPENCLI ?? '/opt/homebrew/bin/opencli';
  const real = fs.realpathSync(executable);
  let installRoot = path.dirname(real);
  while (!fs.existsSync(path.join(installRoot, 'package.json'))) {
    const parent = path.dirname(installRoot);
    if (parent === installRoot) throw new Error(`OpenCLI package root not found: ${real}`);
    installRoot = parent;
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(installRoot, 'package.json'), 'utf8'));
  if (pkg.name !== '@jackwener/opencli') throw new Error(`Unexpected OpenCLI package: ${pkg.name}`);
  return { executable, installRoot };
}
export function openCliToolPaths(): { read: string[]; write: string[] } {
  let install: string[] = [];
  try { install = [resolveOpenCli().installRoot]; } catch { /* preflight reports installation failure */ }
  return { read: install, write: [] };
}

/** Browser Bridge uses localhost; CLI discovery/state stays isolated per trial. */
export function openCliEnvironment(runHome: string): NodeJS.ProcessEnv {
  const home = path.join(runHome, 'tmp', 'opencli-home');
  fs.mkdirSync(home, { recursive: true });
  return { HOME: home, OPENCLI_CONFIG_DIR: path.join(home, '.opencli'), OPENCLI_CACHE_DIR: path.join(home, '.opencli', 'cache') };
}
