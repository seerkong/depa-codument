import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';
const root=fs.realpathSync(process.argv[2]!);
assert.match(root,/^\/private\/tmp\/depa-codument-verification-[^/]+$/);
const prepared=JSON.parse(fs.readFileSync(path.join(root,'prepared.json'),'utf8'));
assert.equal(prepared.passed,true);
const project=prepared.project;
const {sha,treeHash,writeJson}=await import(path.join(project,'e2e/runtime.ts'));
const home='/Users/kongweixian', base=path.join(home,'.local/share/depa-codument-local');
const target=path.join(base,'runtime-darwin-arm64'),link=path.join(home,'.local/bin/depa-codument');
assert.equal(fs.realpathSync(link),path.join(target,'bin/depa-codument'));
function protectedState() {
  const otherSkills = [];
  for (const directory of ['.agents/skills', '.claude/skills', '.eidolon/skills']) {
    for (const name of fs.readdirSync(path.join(home, directory))) {
      if (name !== 'codument' && !name.startsWith('codument-')) continue;
      otherSkills.push({path: path.join(directory, name), hash: treeHash(path.join(home, directory, name))});
    }
  }
  return {
    oldBin: sha(path.join(home, '.local/bin/codument')),
    oldLink: fs.readlinkSync(path.join(home, '.local/bin/codument')),
    workspace: treeHash('/Users/kongweixian/infra-dev/depa-codument/codument'),
    otherSkills,
  };
}
const before=protectedState();assert.equal(before.oldBin,prepared.oldBin);assert.equal(before.workspace,prepared.workspace);
const stage=fs.mkdtempSync(path.join(base,'npm-021-stage-'));
const backup=stage+'-previous';
fs.cpSync(path.join(project,'packages/runtime-darwin-arm64'),stage,{recursive:true,filter:p=>!p.split(path.sep).includes('node_modules')});
const contract=path.join(stage,'local-packages/depa-codument-skill-app-contract');
fs.cpSync(path.join(project,'packages/skill-app-contract'),contract,{recursive:true,filter:p=>!p.split(path.sep).includes('node_modules')});
const manifest=JSON.parse(fs.readFileSync(path.join(stage,'package.json'),'utf8'));
manifest.dependencies['depa-codument-skill-app-contract']='file:./local-packages/depa-codument-skill-app-contract';
writeJson(path.join(stage,'package.json'),manifest);
const fd=fs.openSync(path.join(root,'global-dependency-install.log'),'wx');
const install=Bun.spawn([process.execPath,'install','--ignore-scripts','--no-cache','--registry=https://registry.npmjs.org'],{cwd:stage,stdout:fd,stderr:fd});
const code=await install.exited;fs.closeSync(fd);assert.equal(code,0,'Stage install failed; live install unchanged');
assert.equal(sha(path.join(stage,'bin/depa-codument')),prepared.sha256);
const stagedLock=fs.readFileSync(path.join(stage,'bun.lock'),'utf8');
assert.ok(!/127\.0\.0\.1|localhost|halfcode-cli-lite-|halfcode-app-lite-/.test(stagedLock));
assert.equal(JSON.parse(fs.readFileSync(path.join(stage,'node_modules/halfcode-lite-page-builder-vue-support/package.json'),'utf8')).version,'0.2.1');
fs.renameSync(target,backup);fs.renameSync(stage,target);
try {
  const child=Bun.spawn([link,'upgrade-global','--agent=claude,codex,eidolon','--json'],{cwd:root,stdout:'pipe',stderr:'pipe'});
  const [exit,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  fs.writeFileSync(path.join(root,'global-skill-install.log'),stdout+'\n'+stderr);
  assert.equal(exit,0,stderr||stdout);
  const sourceApp=path.join(project,'packages/product-capsule/src/templates/agents/global/skills/depa-codument');
  const appSha256=treeHash(sourceApp);
  for(const dir of ['.agents/skills','.claude/skills','.eidolon/skills']) assert.equal(treeHash(path.join(home,dir,'depa-codument')),appSha256);
  assert.equal(sha(link),prepared.sha256);assert.deepEqual(protectedState(),before);
  const receipt={status:'passed',binary:link,sha256:sha(link),appSha256,backup,protectedBefore:before,skill:JSON.parse(stdout),publicBuilderVersion:'0.2.1'};
  writeJson(path.join(root,'global-install.json'),receipt);console.log(JSON.stringify(receipt));
}catch(error){
  fs.renameSync(target,stage+'-failed');fs.renameSync(backup,target);throw error;
}
