import * as fs from 'node:fs';
import * as path from 'node:path';
const repository='/Users/kongweixian/infra-dev/depa-codument';
const target=fs.realpathSync(process.argv[2]!);
if(!/^\/(private\/)?tmp\/depa-codument-verification-[^/]+\/depa-codument$/.test(target))throw Error('Isolated snapshot required');
const project=path.join(target,'project');
const {execute,writeJson,sha,treeHash}=await import(path.join(project,'e2e/runtime.ts'));
const legacyCommit='bba44a1ac23cb8d5b2312f3cd0c9f78ddd471a8e';
const temporary=path.dirname(target),legacy=path.join(temporary,'legacy-0.5.4');
fs.mkdirSync(legacy);
const archive=Bun.spawnSync(['git','archive','--format=tar',legacyCommit],{cwd:repository});
if(archive.exitCode)throw Error('Cannot extract versioned legacy product');
const archiveFile=path.join(temporary,'legacy-source.tar');fs.writeFileSync(archiveFile,archive.stdout);
const tar=Bun.spawnSync(['/usr/bin/tar','-xf',archiveFile,'-C',legacy]);if(tar.exitCode)throw Error('Legacy source extraction failed');
fs.cpSync(path.join(target,'node_modules'),path.join(legacy,'node_modules'),{recursive:true,verbatimSymlinks:true});
if(fs.existsSync(path.join(target,'bun.lock')))fs.copyFileSync(path.join(target,'bun.lock'),path.join(legacy,'bun.lock'));
if(fs.readFileSync(path.join(legacy,'package.json'),'utf8')!==fs.readFileSync(path.join(target,'package.json'),'utf8'))throw Error('Legacy dependency manifest drift; do not reuse different dependencies');
const env={...process.env,PATH:`${path.dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin`,HOME:path.join(temporary,'home')};
const steps=[
  {name:'current-build',cwd:project,argv:[process.execPath,'scripts/build.ts']},
  {name:'legacy-kind-check',cwd:legacy,argv:[process.execPath,'scripts/gen-kind-registry.ts','--check']},
  {name:'legacy-build',cwd:legacy,argv:[process.execPath,'scripts/build.ts','--outfile=dist/codument']},
] as const;
const receipts=[];
for(const step of steps){const result=await execute({...step,env,log:path.join(temporary,step.name+'.log'),timeoutMs:180000});receipts.push({...step,...result});if(result.code)throw Error(`${step.name} failed; see ${temporary}`);}
const currentBin=path.join(project,'dist/depa-codument'),legacyBin=path.join(legacy,'dist/codument');
const report={target,project,currentBin,legacyBin,legacyCommit,archiveSha256:sha(archiveFile),currentSha256:sha(currentBin),legacySha256:sha(legacyBin),currentVersion:JSON.parse(fs.readFileSync(path.join(project,'package.json'),'utf8')).version,legacyVersion:JSON.parse(fs.readFileSync(path.join(legacy,'package.json'),'utf8')).version,harnessSha256:treeHash(path.join(project,'e2e')),legacySourceSha256:treeHash(path.join(legacy,'src')),legacyDependencyManifestSha256:sha(path.join(legacy,'package.json')),receipts};
writeJson(path.join(temporary,'paired-candidates.json'),report);console.log(JSON.stringify(report));
