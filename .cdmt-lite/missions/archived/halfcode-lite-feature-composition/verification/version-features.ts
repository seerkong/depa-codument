import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const root='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite/packages';
for(const entry of readdirSync(root)){
 const path=`${root}/${entry}/package.json`;
 const manifest=JSON.parse(readFileSync(path,'utf8'));
 if(manifest.halfcodeClone?.identity!=='shared')continue;
 // New public API release candidate; do not mutate a previously consumed immutable version.
 manifest.version=process.argv[2]??'0.2.1-composition.2';
 writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
}
