import * as fs from 'node:fs';
import * as path from 'node:path';

/** Prepare through the caller's closed artifact registry; return a probe runnable after that registry stops. */
export async function prepareCodeFirstConsumer(
  consumer: string,
  origin: string,
  command: (args: string[], cwd: string) => Promise<string>,
): Promise<() => Promise<void>> {
  const contract = 'halfcode-cli-lite-skill-app-contract';
  const metadata = await (await fetch(origin + '/' + contract)).json() as {
    versions: Record<string, { version: string; dist: { integrity: string } }>;
  };
  const manifest = metadata.versions['0.1.1'];
  if (!manifest) throw new Error('Fixed release lacks public authoring contract 0.1.1');
  const integrity = manifest.dist.integrity;
  const app = path.join(consumer, 'code-first');
  const module = path.join(app, 'modules/basic');
  fs.mkdirSync(path.join(module, 'src'), { recursive: true });
  fs.mkdirSync(path.join(app, 'src'));
  const dependency = { [contract]: manifest.version };
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'notes-app', private: true, type: 'module', workspaces: ['modules/basic'], dependencies: dependency }));
  fs.writeFileSync(path.join(module, 'package.json'), JSON.stringify({ name: 'notes-module', private: true, type: 'module', dependencies: dependency,
    scripts: { postinstall: 'touch SHOULD_NOT_EXIST' } }));
  fs.writeFileSync(path.join(app, 'manifest.xnl'), `<SkillApp #Notes.Code.App envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    profile = "app-package" packageRoot = "vfs://." descriptor = "vfs://./src/app.ts"
  } (<Catalogs [<ManifestResourceCatalog #modules { resourceKind = "SkillModule" root = "vfs://./modules/" entry = "manifest.xnl" }> ]>)>`);
  fs.writeFileSync(path.join(app, 'src/app.ts'), `import { defineSkillApp } from '${contract}/app';
    export default defineSkillApp({ fqn:'Notes.Code.App', name:'notes-code-first', modules:['Notes.Code.Module'], pageBundles:[], sites:[], resources:[] });`);
  fs.writeFileSync(path.join(module, 'manifest.xnl'), `<SkillModule #Notes.Code.Module envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    profile = "module-package" packageRoot = "vfs://." descriptor = "vfs://./src/module.ts"
  } (<Catalogs [<DirectoryResourceCatalog #host { resourceKind = "HostBundle" root = "vfs://./" entry = "host.xnl" scope = "root" }> ]>)>`);
  fs.writeFileSync(path.join(module, 'src/module.ts'), `import { defineSkillModule } from '${contract}/app';
    export default defineSkillModule({ fqn:'Notes.Code.Module', host:'Notes.Code.Host', resources:[] });`);
  fs.writeFileSync(path.join(module, 'host.xnl'), `<HostBundle #Notes.Code.Host envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    profile = "host-package" packageRoot = "vfs://." descriptor = "vfs://./src/host.ts" runtime = "bun" exports = ["LocalFunction"]
  }>`);
  fs.writeFileSync(path.join(module, 'src/host.ts'), `import { defineHostModule, defineLocalFunction } from '${contract}/host';
    export default defineHostModule({resources:[defineLocalFunction({fqn:'Notes.Code.Echo',operation:'query',inputSchema:{type:'string'},configSchema:{type:'null'},outputSchema:{type:'string'},handler:(_runtime,input)=>input})]});`);
  await command(['install', '--save-text-lockfile', '--ignore-scripts', '--registry', origin, '--cache-dir', path.join(consumer, 'registry-cache')], app);
  return async () => {
    fs.writeFileSync(path.join(consumer, 'code-first.ts'), `
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createResourceHostRuntime } from 'halfcode-cli-lite-skill-app-capsule';
import { createLocalFunctionCatalog } from 'halfcode-cli-lite-skill-app-logic/local-function';
const root = path.join(process.cwd(),'code-first');
const lockFile = path.join(root,'bun.lock');
const lockSource = await fs.readFile(lockFile,'utf8');
const lock = JSON.parse(lockSource.replace(/,\\s*([}\\]])/g,'$1'));
const tuple = lock.packages[${JSON.stringify(contract)}];
if (!tuple || tuple[3] !== ${JSON.stringify(integrity)} || !tuple[1].startsWith(${JSON.stringify(origin)})) throw new Error('Registry/integrity not bound by real Bun installation: ' + JSON.stringify(tuple));
const host = createResourceHostRuntime({workspaceRoot:root,sources:[{root:'.',scope:'root',origin:'notes'}],privateDirectory:'.notes'});
try {
const snapshot = await host.resourceCatalog.snapshot();
if (!snapshot.ready) throw new Error(JSON.stringify(snapshot.diagnostics));
if (!['SkillApp','SkillModule','HostBundle'].every(kind=>snapshot.resources.some(r=>r.kind===kind&&r.materialDigest))) throw new Error('Composition package material identity missing');
const functions = createLocalFunctionCatalog(host.definitionCatalog,{buildRuntime:async()=>({})});
if (await functions.invoke({},'Notes.Code.Echo','strict-code-first',null) !== 'strict-code-first') throw new Error('Host package was not executable');
tuple[3] = '';
await fs.writeFile(lockFile,JSON.stringify(lock));
const rejected = await host.resourceCatalog.snapshot();
if (rejected.ready || !rejected.diagnostics.some(d=>d.code.includes('LOCK_MISMATCH'))) throw new Error('Missing integrity did not invalidate the observed catalog');
await fs.writeFile(lockFile,lockSource);
if (!(await host.resourceCatalog.snapshot()).ready) throw new Error('Restored real lock did not recover');
if (await fs.stat(path.join(root,'modules/basic/SHOULD_NOT_EXIST')).catch(()=>undefined)) throw new Error('Install lifecycle script executed');
if ((await fs.readdir(root,{recursive:true})).some(file=>!String(file).split('/').includes('node_modules') && String(file).split('/').includes('KindDefinitions'))) throw new Error('Builtin Kind files were copied into authored workspace');
console.log(JSON.stringify({codeFirst:true,registryInstalled:true,realIntegrity:true,appModuleHost:true,lockInvalidation:true,noKindCopies:true}));
} finally { await host.close(); }
`);
    const result = JSON.parse(await command(['code-first.ts'], consumer));
    if (!result.codeFirst || !result.lockInvalidation) throw new Error('Strict code-first consumer failed');
    console.log(JSON.stringify({ scope: 'code-first-slice', ...result }));
  };
}
