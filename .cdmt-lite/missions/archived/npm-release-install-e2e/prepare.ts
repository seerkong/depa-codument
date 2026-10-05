import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';
const source='/Users/kongweixian/infra-dev/depa-codument';
const root=fs.realpathSync(fs.mkdtempSync('/tmp/depa-codument-verification-'));
const project=path.join(root,'depa-codument/project');
fs.mkdirSync(project,{recursive:true});
const excluded=new Set(['node_modules','.git','dist','.cache','coverage']);
fs.cpSync(path.join(source,'project'),project,{recursive:true,filter:file=>!file.split(path.sep).some(part=>excluded.has(part))});
const {sha,treeHash,writeJson}=await import(path.join(project,'e2e/runtime.ts'));
const receipt={root,project,createdAt:new Date().toISOString(),oldBin:sha('/Users/kongweixian/.local/bin/codument'),oldLink:fs.readlinkSync('/Users/kongweixian/.local/bin/codument'),workspace:treeHash(path.join(source,'codument')),harness:treeHash(path.join(project,'e2e'))};
writeJson(path.join(root,'snapshot.json'),receipt);
console.log(JSON.stringify(receipt));
const lock=JSON.parse(fs.readFileSync(path.join(project,'bun.lock'),'utf8').replace(/,\s*([}\]])/g,'$1'));
const publicPackages=Object.entries(lock.packages).filter(([name])=>name.startsWith('halfcode-lite-'));
assert.equal(publicPackages.length,21);
const observations=[];
for(const [name,value] of publicPackages){
  const row=value as string[];
  assert.equal(row[0],name+'@0.2.1');
  assert.ok(row[1].startsWith('https://registry.npmjs.org/'));
  const response=await fetch('https://registry.npmjs.org/'+name+'/0.2.1');
  assert.equal(response.status,200);
  const metadata=await response.json() as {dist:{integrity:string,tarball:string}};
  assert.equal(row.at(-1),metadata.dist.integrity);
  assert.equal(row[1],metadata.dist.tarball);
  observations.push({name,version:'0.2.1',...metadata.dist});
}
assert.ok(!fs.readFileSync(path.join(project,'bun.lock'),'utf8').match(/127\.0\.0\.1|localhost|composition\.12/));
writeJson(path.join(root,'public-dependencies.json'),observations);
for(const [id,args] of [
  ['git',['/usr/bin/git','init','--quiet']],
  ['install',[process.execPath,'install','--frozen-lockfile','--ignore-scripts','--force','--no-cache','--registry=https://registry.npmjs.org']],
  ['check',[process.execPath,'run','check']],
  ['build',[process.execPath,'run','build']],
  ['release',[process.execPath,'run','build:release:arm64']],
  ['smoke',[process.execPath,'e2e/run.ts','smoke','--bin='+path.join(project,'dist/depa-codument')]],
] as [string,string[]][]){
  const fd=fs.openSync(path.join(root,id+'.log'),'wx');
  const child=Bun.spawn(args,{cwd:project,stdout:fd,stderr:fd,env:{...process.env,PATH:'/Users/kongweixian/.bun/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin'}});
  const code=await child.exited;fs.closeSync(fd);
  console.log(JSON.stringify({id,code,log:path.join(root,id+'.log')}));assert.equal(code,0,id);
}
assert.equal(sha(path.join(project,'dist/depa-codument')),sha(path.join(project,'packages/runtime-darwin-arm64/bin/depa-codument')));
writeJson(path.join(root,'prepared.json'),{...receipt,candidate:path.join(project,'dist/depa-codument'),sha256:sha(path.join(project,'dist/depa-codument')),passed:true});
