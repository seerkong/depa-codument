import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCompatibleResourceContractRuntime } from 'halfcode-cli-lite-skill-app-capsule/compatibility';
import { createCodumentResourceContracts } from 'depa-codument-host-adapter/resources';
import { defineSkillApp as nativeApp } from 'depa-codument-skill-app-contract/app';
import { defineSkillApp as publicApp } from 'halfcode-cli-lite-skill-app-contract/app';

const input = JSON.parse(await readFile('native-compatibility.json', 'utf8'));
const sri = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
const installedManifest = JSON.parse(await readFile('node_modules/depa-codument-skill-app-contract/package.json', 'utf8'));
const installedArtifact = { name: installedManifest.name, version: installedManifest.version, apiVersion: '2', integrity: sri(await readFile('native.tgz')) };
const declaredArtifact = { ...input.profile.declaredArtifact, integrity: sri(await readFile('historical.tgz')) };
const bindings = { profiles: [input.profile], selectedProfileId: input.profile.id };
const observation = { declaredArtifact, installedArtifact, authoring: 'code-first' };
const compatibility = createCompatibleResourceContractRuntime(bindings, observation);
assert.deepEqual(JSON.parse(JSON.stringify(compatibility.contractLock)), input.expectedLock);
const productLock = JSON.parse(JSON.stringify(createCodumentResourceContracts().contractLock));
assert.equal(productLock.envelopeVersion, input.expectedLock.envelopeVersion);
assert.equal(productLock.envelopeFingerprint, input.expectedLock.envelopeFingerprint);
for (const field of ['owners', 'readers', 'revisions', 'resolutions']) {
  for (const historical of input.expectedLock[field]) {
    assert.ok(productLock[field].some(current => JSON.stringify(current) === JSON.stringify(historical)), 'Historical lock entry changed: ' + field);
  }
}
assert.equal(productLock.readers.length, input.expectedLock.readers.length + 12);
assert.ok(productLock.readers.some(reader => JSON.stringify(reader).includes('CommandOperation')));
assert.notEqual(productLock.lockDigest, input.expectedLock.lockDigest, 'Product domain readers require an extended product lock');
assert.equal(nativeApp, publicApp, 'Native authoring entry must forward one implementation');
for (const change of [{ name: 'forged' }, { version: '2.0.1' }, { apiVersion: '999' }, { integrity: sri(Buffer.from('wrong')) }]) {
  assert.throws(() => createCompatibleResourceContractRuntime(bindings, { ...observation, installedArtifact: { ...installedArtifact, ...change } }), /ARTIFACT_MISMATCH/);
}
assert.throws(() => createCompatibleResourceContractRuntime({ ...bindings, selectedProfileId: 'unknown' }, observation), /PROFILE_UNKNOWN/);

const root = join(process.cwd(), 'historical-workspace');
const app = join(root, '.agents/skills/historical');
await mkdir(join(app, 'src'), { recursive: true });
await mkdir(join(app, 'host/src'), { recursive: true });
const files = {
  'manifest.xnl': `<SkillApp #Historical.App envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    profile = "app-package" packageRoot = "vfs://." descriptor = "vfs://./src/app.ts"
  } (<Catalogs [<DirectoryResourceCatalog #host { resourceKind = "HostBundle" root = "vfs://./host/" entry = "manifest.xnl" scope = "root" }> ]>)>`,
  'src/app.ts': `import { defineSkillApp } from 'depa-codument-skill-app-contract/app';
    export default defineSkillApp({ fqn: 'Historical.App', name: 'historical', modules: [], pageBundles: [], sites: [], resources: ['Historical.Host'] });`,
  'host/manifest.xnl': `<HostBundle #Historical.Host envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    profile = "host-package" packageRoot = "vfs://." descriptor = "vfs://./src/host.ts" runtime = "bun" exports = ["LocalFunction"]
  }>`,
  'host/src/host.ts': `import { defineHostModule, defineLocalFunction } from 'depa-codument-skill-app-contract/host';
    export default defineHostModule({ resources: [defineLocalFunction({ fqn: 'Historical.Action.Value', operation: 'query', inputSchema: {}, configSchema: {}, outputSchema: {}, handler: () => ({ value: 'preserved' }) })] });`,
};
for (const [file, bytes] of Object.entries(files)) await writeFile(join(app, file), bytes);
const originalLock = JSON.parse((await readFile('bun.lock', 'utf8')).replace(/,\s*([}\]])/g, '$1'));
for (const [directory, name] of [[app, 'historical-app'], [join(app, 'host'), 'historical-host']]) {
  const dependencies = { 'depa-codument-skill-app-contract': '2.0.0' };
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name, type: 'module', dependencies }));
  // Keep the actually resolved complete package tuples; bind only this fixture's authored workspace record.
  await writeFile(join(directory, 'bun.lock'), JSON.stringify({ ...originalLock, workspaces: { '': { name, dependencies } } }));
  await symlink(join(process.cwd(), 'node_modules'), join(directory, 'node_modules'));
}
const manifest = JSON.parse(await readFile('node_modules/depa-codument-cli/package.json', 'utf8'));
const entry = join(process.cwd(), 'node_modules/depa-codument-cli', manifest.bin['depa-codument']);
async function cli(args) {
  const child = Bun.spawn([process.execPath, entry, '-w', root, ...args, '--json'], { stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, NODE_PATH: '', CODEX_BIN: '/must-not-start/codex' } });
  const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
  assert.equal(code, 0, stdout + stderr);
  return JSON.parse(stdout);
}
assert.equal((await cli(['Resource', 'validate'])).valid, true);
assert.equal((await cli(['LocalFunction', 'invoke', '--fqn', 'Historical.Action.Value', '--input', '{}'])).result.value, 'preserved');
for (const [file, bytes] of Object.entries(files)) assert.equal(await readFile(join(app, file), 'utf8'), bytes);
console.log(JSON.stringify({ nativeCodeFirst: true, historicalFrozenArtifact: true, exactIdentityAndIntegrity: true,
  compatibilityOldLockExact: true, productHistoricalEntriesPreserved: true, productLockExtendedByDomainReaders: 11, additionalPublicCommandOperation: true, authoredBytesPreserved: true, samePublicImplementation: true, serveRequired: false }));
