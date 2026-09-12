import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { writeFile, readFile, mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { openReleaseRegistry } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/release-set';
import { createOptionalRegistry } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/optional-registry';

const label = process.argv[2];
assert.match(label ?? '', /^[a-z0-9-]+$/);
const release = process.argv[3] ?? join(import.meta.dir, 'host-release-round-15');
assert.ok(release.startsWith('/'));
const projectIndex = process.argv.indexOf('--project');
const project = projectIndex < 0 ? resolve(import.meta.dir, '../../../../../project') : resolve(process.argv[projectIndex + 1] ?? '');
assert.ok(project === resolve(import.meta.dir, '../../../../../project') || project.startsWith('/private/tmp/depa-codument-verification-'), 'Install target must be source project or isolated copy');
const cache = await mkdtemp(join(tmpdir(), 'codument-release-install-cache-'));
const registry = await openReleaseRegistry(release);
// Development tools are repacked local fixtures, separate from the production release set.
const developmentFallback = process.argv.includes('--development-tools');
const known = new Set(registry.set.artifacts.map(item => item.name));
const toolingRequests: string[] = [];
const upstream = '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite';
let tooling: Awaited<ReturnType<typeof createOptionalRegistry>> | undefined;
let developmentRegistry: ReturnType<typeof Bun.serve> | undefined;
let previousLock: Buffer | undefined;
let installed = false;
try {
tooling = developmentFallback ? await createOptionalRegistry({root: join(upstream, 'packages/cli'), temporary: cache,
  publicSources: new Map(await Promise.all([
    ...['@types/bun', '@types/node', 'bun-types', 'eslint', '@typescript-eslint/parser'].map(name => [name, join(project, 'node_modules', name)] as [string, string]),
    ['vue', join(upstream, 'packages/page-builder-vue-support/node_modules/vue')],
  ].map(async ([name, directory]) => [name, await realpath(directory)] as [string, string]))), publicArchives: new Map(),
}) : undefined;
const toolingUrl = tooling?.url;
developmentRegistry = toolingUrl ? Bun.serve({hostname: '127.0.0.1', port: 0, idleTimeout: 120, async fetch(request) {
  const url = new URL(request.url);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (url.pathname.startsWith('/artifacts/')) return fetch(registry.url + url.pathname);
  if (known.has(name)) {
    const base = await fetch(registry.url + url.pathname);
    if (/^(?:@)?(?:halfcode|depa-codument)/.test(name)) return base;
    const additional = await fetch(toolingUrl + url.pathname);
    if (!additional.ok) return base;
    const [baseMetadata, toolMetadata] = await Promise.all([base.json(), additional.json()]) as [{versions: Record<string, unknown>}, {versions: Record<string, unknown>}];
    return Response.json({...baseMetadata, versions: {...toolMetadata.versions, ...baseMetadata.versions}});
  }
  if (/^(?:@)?(?:halfcode|depa-codument)/.test(name)) return new Response('Outside public release set', {status: 404});
  toolingRequests.push(name);
  return fetch(toolingUrl + url.pathname);
}}) : undefined;
  if (process.argv.includes('--fresh-lock')) {
    previousLock = await readFile(join(project, 'bun.lock'));
    await writeFile(join(import.meta.dir, label + '-before.bun.lock'), previousLock, {flag: 'wx'});
    await rm(join(project, 'bun.lock')); // Generated lock is re-resolved, original bytes remain in evidence.
  }
  const child = Bun.spawn([process.execPath, 'install', '--ignore-scripts', ...(process.argv.includes('--fresh-lock') ? ['--force'] : []), '--registry', developmentRegistry?.url.origin ?? registry.url], {
    cwd: project, stdout: 'pipe', stderr: 'pipe', env: {...process.env, BUN_INSTALL_CACHE_DIR: cache},
  });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  await writeFile(join(import.meta.dir, 'logs', label + '.log'), JSON.stringify({ exit: code, releaseDigest: registry.digest, developmentFallback, toolingPackages: tooling?.packages, toolingRequests, requests: registry.requests }) + '\n' + stdout + stderr, { flag: 'wx' });
  console.log(stdout + stderr);
  assert.equal(code, 0);
  const lock = await readFile(join(project, 'bun.lock'), 'utf8');
  for (const artifact of registry.set.artifacts.filter(item => item.role === 'shared')) assert.ok(lock.includes(artifact.integrity), 'Public lock SRI does not match selected set: ' + artifact.name);
  if (process.argv.includes('--fresh-lock')) for (const role of ['contract', 'logic', 'support']) {
    const installed = JSON.parse(await readFile(join(project, 'node_modules', 'halfcode-cli-lite-cli-host-' + role, 'package.json'), 'utf8'));
    assert.equal(installed.exports['./clone'], './src/clone.ts', 'Installed payload was not refreshed: ' + role);
  }
  installed = true;
} catch (error) {
  if (previousLock) await writeFile(join(project, 'bun.lock'), previousLock);
  throw error;
} finally {
  if (installed && process.argv.includes('--keep-registry')) {
    console.log(JSON.stringify({ registryRetained: true, registry: developmentRegistry?.url.origin ?? registry.url, release, pid: process.pid }));
  } else { developmentRegistry?.stop(true); tooling?.stop(); await registry.close(); }
  await rm(cache, {recursive: true, force: true});
}
