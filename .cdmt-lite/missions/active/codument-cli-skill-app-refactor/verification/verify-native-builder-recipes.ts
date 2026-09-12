import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageReleaseBuilder as stageHalfcode } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/release-builder';
import { stageReleaseBuilder as stageCodument } from '../../../../../project/scripts/release-builder';
import { openReleaseRegistry } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/scripts/fixtures/release-set';

const label = process.argv[2];
assert.match(label ?? '', /^[a-z0-9-]+$/);
const temporary = await mkdtemp(join(tmpdir(), 'native-builder-recipe-'));
const logs: string[] = [];
async function run(args: string[], cwd: string): Promise<string> {
  const child = Bun.spawn([process.execPath, ...args], { cwd, stdout: 'pipe', stderr: 'pipe', env: {
    ...process.env, BUN_BIN: process.execPath, NODE_PATH: '', BUN_INSTALL_CACHE_DIR: join(temporary, 'cache'), npm_config_userconfig: join(temporary, 'empty.npmrc'),
  } });
  const deadline = setTimeout(() => child.kill('SIGKILL'), 180_000);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(deadline));
  logs.push(JSON.stringify({ args, code }) + '\n' + stdout + stderr);
  assert.equal(code, 0, stdout + stderr);
  return stdout;
}
try {
  const cases = [
    { name: 'halfcode', root: '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite', stage: stageHalfcode },
    { name: 'codument', root: join(import.meta.dir, '../../../../../project'), stage: stageCodument },
  ];
  const dependencies: Record<string, string> = {};
  for (const item of cases) {
    const root = join(temporary, item.name);
    await mkdir(root);
    item.stage(join(item.root, 'packages/page-builder-vue'), join(root, 'builder-vue'));
    const native = JSON.parse(await readFile(join(item.root, 'packages/runtime-darwin-arm64/package.json'), 'utf8'));
    // Tests the actual recipe dependency/payload closure, not a substitute product binary.
    const name = 'fixture-' + item.name + '-builder-recipe';
    await writeFile(join(root, 'package.json'), JSON.stringify({ name, version: '1.0.0', files: ['builder-vue'], dependencies: native.dependencies }));
    const archive = join(temporary, item.name + '.tgz');
    await run(['pm', 'pack', '--ignore-scripts', '--filename', archive], root);
    dependencies[name] = 'file:' + archive;
  }
  const consumer = join(temporary, 'consumer');
  await mkdir(consumer);
  await writeFile(join(temporary, 'empty.npmrc'), '');
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'recipe-consumer', private: true, type: 'module', dependencies }));
  const registry = await openReleaseRegistry(join(import.meta.dir, 'host-release-round-15-recipes'), [join(import.meta.dir, 'round-15-codument-engine-release-artifacts')]);
  try { await run(['install', '--ignore-scripts', '--registry', registry.url], consumer); }
  finally { await registry.close(); }
  await writeFile(join(consumer, 'proof.ts'), `
import assert from 'node:assert/strict';
import {mkdir,readFile,access,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const resolveFromRecipe=name=>join(process.cwd(),'node_modules','fixture-'+name+'-builder-recipe');
for(const name of ['halfcode','codument']){
  const root=resolveFromRecipe(name),builderRoot=join(root,'builder-vue');
  const manifest=JSON.parse(await readFile(join(builderRoot,'package.json'),'utf8'));
  assert.ok(!JSON.stringify(manifest).includes('workspace:'));
  assert.equal(manifest.dependencies['halfcode-cli-lite-page-builder-vue-support'],'0.1.0');
  const publicEntry=Bun.resolveSync('halfcode-cli-lite-page-builder-vue-support',root);
  assert.ok(publicEntry.includes('node_modules'));
  const publicApi=await import(publicEntry);
  const nativeApi=await import(pathToFileURL(join(builderRoot,'src/index.ts')).href);
  assert.equal(nativeApi.buildVuePage,publicApi.buildVuePage);
  const {createVuePageBuilderPort}=await import(Bun.resolveSync('halfcode-cli-lite-page-builder-vue-support/worker-port',root));
  const pageRoot=join(process.cwd(),'page-'+name);
  await mkdir(join(pageRoot,'src'),{recursive:true});
  await writeFile(join(pageRoot,'src/App.vue'),'<template><main>Recipe '+name+'</main></template>');
  const request={pageName:name,pageRoot,entry:'src/App.vue',expose:'./app',outputDirectory:join(process.cwd(),'out-'+name)};
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const timer=setTimeout(()=>rejectReady(new Error('Nested worker timeout')),20000);
  let handle;
  try {
    handle=await createVuePageBuilderPort({workerEntry:async()=>join(builderRoot,'src/worker.ts'),bunExecutable:()=>process.execPath}).watch(request,{building(){},ready:resolveReady,error:rejectReady,unavailable:rejectReady});
    const receipt=await ready;
    await access(join(receipt.snapshotDirectory,receipt.remoteEntry));
    assert.equal(receipt.toolchain.builderVersion,'0.1.0');
  } finally {clearTimeout(timer);if(handle){const closing=handle.close();assert.equal(handle.close(),closing);await closing;}}
}
console.log(JSON.stringify({installedNestedBridges:2,realPublicWorkerBuilds:2,normalTransitiveResolution:true,workspaceRangeAbsent:true,ownedClose:true,productBinaries:'NOT_RUN',nativePlatform:'darwin-arm64'}));
`);
  const proof = await run(['proof.ts'], consumer);
  await writeFile(join(import.meta.dir, 'logs', label + '.log'), 'exit: 0\n' + JSON.stringify({ releaseDigest: registry.digest, productDigests: registry.productDigests }) + '\n' + logs.join('\n'), { flag: 'wx' });
  console.log(proof);
} catch (error) {
  await writeFile(join(import.meta.dir, 'logs', label + '-failure.log'), logs.join('\n') + '\n' + String(error), { flag: 'wx' });
  throw error;
} finally { await rm(temporary, { recursive: true, force: true }); }
