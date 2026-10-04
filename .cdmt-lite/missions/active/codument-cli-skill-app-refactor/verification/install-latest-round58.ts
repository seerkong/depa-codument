import * as fs from 'node:fs';
import * as path from 'node:path';
import assert from 'node:assert/strict';

const project=fs.realpathSync(process.argv[2]!);
if(!/^\/(private\/)?tmp\/depa-codument-verification-[^/]+\/depa-codument\/project$/.test(project))throw Error('Validated temporary release required');
const {sha,treeHash,writeJson}=await import(path.join(project,'e2e/runtime.ts'));
const home='/Users/kongweixian';
const link=path.join(home,'.local/bin/depa-codument');
const installed=path.join(home,'.local/share/depa-codument-local/runtime-darwin-arm64');
const binary=path.join(installed,'bin/depa-codument');
assert.equal(fs.realpathSync(link),binary,'Unexpected installation target');
const release=path.join(project,'packages/runtime-darwin-arm64');
assert.equal(sha(path.join(release,'bin/depa-codument')),sha(path.join(project,'dist/depa-codument')));
const product=JSON.parse(fs.readFileSync(path.join(project,'package.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(release,'package.json'),'utf8'));
const prior=JSON.parse(fs.readFileSync(path.join(installed,'package.json'),'utf8'));
assert.equal(manifest.version,product.version);
// Existing exact local dependency materializations remain installed; no registry/global package mutation.
for(const [name,version] of Object.entries(manifest.dependencies)) {
  const resolved=JSON.parse(fs.readFileSync(path.join(installed,'node_modules',name,'package.json'),'utf8'));
  assert.equal(resolved.version,version,`Installed dependency drift: ${name}`);
}
function protectedState() {
  const oldBin=path.join(home,'.local/bin/codument');
  const workspace='/Users/kongweixian/infra-dev/depa-codument/codument';
  return {oldBinBytes:sha(oldBin),oldBinLink:fs.readlinkSync(oldBin),workspace:treeHash(workspace),legacySkills:
    ['.agents/skills','.claude/skills','.eidolon/skills'].flatMap(directory=>fs.existsSync(path.join(home,directory))
      ? fs.readdirSync(path.join(home,directory)).filter(name=>name==='codument'||name.startsWith('codument-')).map(name=>({path:path.join(directory,name),hash:treeHash(path.join(home,directory,name))})) : [])};
}
const before=protectedState();
const backup=fs.mkdtempSync(path.join(home,'.local/share/depa-codument-local/round58-backup-'));
const files=['bin/depa-codument','builder-vue','package.json','README.md'];
for(const file of files) { fs.mkdirSync(path.dirname(path.join(backup,file)),{recursive:true}); fs.cpSync(path.join(installed,file),path.join(backup,file),{recursive:true,verbatimSymlinks:true}); }
const skillReceipts=[];
try {
  const staged=path.join(installed,'bin/depa-codument-round58');
  fs.copyFileSync(path.join(release,'bin/depa-codument'),staged); fs.chmodSync(staged,0o755); fs.renameSync(staged,binary);
  fs.rmSync(path.join(installed,'builder-vue'),{recursive:true});
  fs.cpSync(path.join(release,'builder-vue'),path.join(installed,'builder-vue'),{recursive:true});
  // Keep the local registry-free dependency resolutions of this private install.
  writeJson(path.join(installed,'package.json'),{...manifest,dependencies:prior.dependencies});
  fs.copyFileSync(path.join(release,'README.md'),path.join(installed,'README.md'));
  const child=Bun.spawn([link,'upgrade-global','--agent=claude,codex,eidolon','--json'],{cwd:path.dirname(project),stdout:'pipe',stderr:'pipe'});
  const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  assert.equal(code,0,stderr||stdout); skillReceipts.push(JSON.parse(stdout));
  const sourceApp=path.join(project,'packages/product-capsule/src/templates/agents/global/skills/depa-codument');
  for(const directory of ['.agents/skills','.claude/skills','.eidolon/skills'])assert.equal(treeHash(path.join(home,directory,'depa-codument')),treeHash(sourceApp),`Incomplete App install: ${directory}`);
  assert.equal(sha(link),sha(path.join(project,'dist/depa-codument')));
  assert.deepEqual(protectedState(),before,'Protected legacy state changed');
  const report={status:'passed',version:product.version,project,binary:link,sha256:sha(link),backup,skillReceipts,appSha256:treeHash(sourceApp),protectedBefore:before,protectedUnchanged:true};
  writeJson(path.join(path.dirname(path.dirname(project)),'global-install-round58.json'),report);
  console.log(JSON.stringify(report));
}catch(error) {
  // Restore only the precisely backed-up new-runtime files; skills have their own transactional backup.
  for(const file of files) { fs.rmSync(path.join(installed,file),{recursive:true,force:true}); fs.cpSync(path.join(backup,file),path.join(installed,file),{recursive:true,verbatimSymlinks:true}); }
  throw error;
}
