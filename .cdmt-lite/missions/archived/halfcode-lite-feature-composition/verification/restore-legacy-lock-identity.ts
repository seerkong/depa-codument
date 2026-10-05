import {readFileSync,writeFileSync} from 'node:fs';
const root='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite/packages/skill-app-capsule/test';
// Read-only reconstruction proved the entire fixture and unchanged digest are the CLI-era identity.
// Repair only legacy observations, not the current product or canonical package identity.
for(const file of ['compatibility.test.ts','fixtures/legacy-resource-locks.json']){
 const path=`${root}/${file}`;
 const text=readFileSync(path,'utf8');
 writeFileSync(path,text.replaceAll('halfcode-app-lite','halfcode-cli-lite'));
}
