import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, chmod } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createNpmLauncher } from 'halfcode-lite-cli-logic/npm-launcher';
import { RELEASE_TARGETS, resolveReleaseTarget, releaseTargetById } from './release-targets';
import { BIN, PACKAGE_NAME } from '../packages/cli/src/identity';
import { stageReleaseBuilder } from './release-builder';
const root = resolve(import.meta.dir, '..');
const output = process.argv[2];
assert.ok(output?.startsWith('/'), 'Usage: prepare-native-release.ts /absolute/new/output [--target=id]');
const targetArg = process.argv.find(arg => arg.startsWith('--target='))?.slice(9);
const target = targetArg ? releaseTargetById(targetArg) : resolveReleaseTarget();
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await mkdir(output); // immutable candidate; never merge another release
const platformRoot = join(output, target.packageName);
await mkdir(join(platformRoot, 'bin'), { recursive: true });
const binary = join(platformRoot, 'bin', target.binaryName);
const child = Bun.spawn([process.execPath, join(root, 'scripts/build.ts'), '--target=' + target.bunTarget, '--outfile=' + binary], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
assert.equal(await child.exited, 0, 'Native build failed');
await chmod(binary, 0o755);
stageReleaseBuilder(join(root, 'packages/page-builder-vue'), join(platformRoot, 'builder-vue'));
const platform = JSON.parse(await readFile(join(root, 'packages', target.packageDirectory, 'package.json'), 'utf8'));
platform.version = manifest.version;
delete platform.bin; // The launcher owns PATH; optional platform packages provide payload only.
const versions = new Map<string, string>();
for (const directory of await import('node:fs/promises').then(fs => fs.readdir(join(root, 'packages')))) {
    const sourceManifest = Bun.file(join(root, 'packages', directory, 'package.json'));
    if (!await sourceManifest.exists()) continue; // Removed packages may leave ignored build/cache directories.
    const pkg = await sourceManifest.json();
    versions.set(pkg.name, pkg.version);
}
for (const [name, version] of Object.entries(platform.dependencies ?? {})) {
    if (String(version).startsWith('workspace:')) {
        assert.ok(versions.has(name), 'Unknown workspace: ' + name);
        platform.dependencies[name] = versions.get(name);
    }
}
await writeFile(join(platformRoot, 'package.json'), JSON.stringify(platform, null, 2) + '\n');
const launcherRoot = join(output, 'launcher');
const files = createNpmLauncher({ name: PACKAGE_NAME, bin: BIN, version: manifest.version,
    targets: RELEASE_TARGETS.map(target => ({ platform: target.platform, architecture: target.architecture, packageName: target.packageName, binaryPath: 'bin/' + target.binaryName })) });
for (const [relative, content] of Object.entries(files)) {
    const destination = join(launcherRoot, relative);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
}
await chmod(join(launcherRoot, 'bin/launch.mjs'), 0o755);
const artifacts: {
    name: string;
    version: string;
    file: string;
    integrity: string;
    role: 'product';
}[] = [];
for (const directory of [platformRoot, launcherRoot]) {
    const filename = join(output, directory === launcherRoot ? PACKAGE_NAME + '.tgz' : target.packageName + '.tgz');
    const packed = Bun.spawn([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', filename], { cwd: directory, stdout: 'inherit', stderr: 'inherit' });
    assert.equal(await packed.exited, 0, 'Packaging failed');
    const bytes = await readFile(filename);
    const file = createHash('sha256').update(bytes).digest('hex') + '.tgz';
    await writeFile(join(output, file), bytes, { flag: 'wx' });
    artifacts.push({ name: directory === launcherRoot ? PACKAGE_NAME : target.packageName, version: manifest.version, file, integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'), role: 'product' });
}
const set = { format: 'halfcode-local-release-set/v1', artifacts };
await writeFile(join(output, 'release-set.json'), JSON.stringify({ set, digest: createHash('sha256').update(JSON.stringify(set)).digest('hex') }, null, 2) + '\n');
console.log(JSON.stringify({ output, product: PACKAGE_NAME, version: manifest.version, target: target.id, globalWrites: false, published: false }));
