import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,realpath,cp,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openReleaseRegistry} from '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite/scripts/fixtures/release-set';
const [base,depa,halfcodeNative,depaNative]=process.argv.slice(2);
const installer=process.argv.includes('--npm')?'npm':'bun';
assert.ok(depaNative,'Usage: verify-native-products.ts BASE DEPA_SOURCE HALFCODE_NATIVE DEPA_NATIVE');
const registry=await openReleaseRegistry(base,[depa,halfcodeNative,depaNative]);
const root=await realpath(await mkdtemp(join(tmpdir(),'halfcode-native-install-')));
async function run(args:string[],cwd:string,expected=0) {
 const proc=Bun.spawn(args,{cwd,stdout:'pipe',stderr:'pipe'});
 const [code,out,err]=await Promise.all([proc.exited,new Response(proc.stdout).text(),new Response(proc.stderr).text()]);
 assert.equal(code,expected,JSON.stringify({args,code,out,err}));
 return out+err;
}
try {
 for(const [name,native] of [['halfcode-lite',halfcodeNative],['depa-codument',depaNative]]) {
  const receipt=JSON.parse(await readFile(join(native,'release-set.json'),'utf8'));
  const version=receipt.set.artifacts.find((item:{name:string})=>item.name===name).version;
  const consumer=join(root,name);
  await mkdir(consumer);
  await writeFile(join(consumer,'package.json'),JSON.stringify({name:'isolated-'+name,private:true,dependencies:{[name]:version}}));
  await run(installer==='npm'
   ? ['npm','install','--ignore-scripts','--no-audit','--no-fund','--cache',join(consumer,'.cache'),'--registry',registry.url]
   : [process.execPath,'install','--ignore-scripts','--cache-dir',join(consumer,'.cache'),'--registry',registry.url],consumer);
  const launcher=join(consumer,'node_modules',name,'bin/launch.mjs');
  const manifest=JSON.parse(await readFile(join(consumer,'node_modules',name,'package.json'),'utf8'));
  assert.deepEqual(Object.keys(manifest.bin),[name]);
  assert.ok(Object.values(manifest.optionalDependencies).every(value=>value===version));
  const bin=join(consumer,'node_modules/.bin',name);
  assert.equal(await realpath(bin),await realpath(launcher),'PATH must point to launcher, not a competing platform bin');
  assert.match(await run([bin,'--version'],consumer),new RegExp(version.replaceAll('.','\\.')));
  const help=await run([bin,'--help'],consumer);
  assert.ok(help.includes('Resource')&&help.includes('SOP'));
  assert.ok(!/^\s+demo\s/m.test(help));
  await run([bin,'init-workspace','--json'],consumer);
  await run([bin,'Resource','validate','--json'],consumer);
  await run([bin,'SOP','list','--json'],consumer);
  if(name==='halfcode-lite'){
   const installed=await readdir(join(consumer,'.agents/skills'),{recursive:true});
   assert.ok(!installed.some(path=>path.split('/').includes('KindDefinitions')),'Default install copied Host Kind definitions');
  }else{
   await run([bin,'status','--json'],consumer);
   await run([bin,'discuss','--json'],consumer);
  }
  await run([bin,'not-a-command'],consumer,1);
  const missing=join(root,name+'-missing-optional');await mkdir(missing);
  await cp(launcher,join(missing,'launch.mjs'));
  assert.match(await run(['node',join(missing,'launch.mjs'),'--version'],missing,1),/Missing platform package/);
 }
 console.log(JSON.stringify({root,installer,passed:true,platform:process.platform,arch:process.arch,products:2,requests:registry.requests.length,globalWrites:false,published:false}));
}finally{registry.close();}
