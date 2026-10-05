import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const depa='/Users/kongweixian/infra-dev/depa-codument/project';
function edit(root:string,file:string,fn:(s:string)=>string){const p=join(root,file); const s=readFileSync(p,'utf8'); const n=fn(s); if(n!==s)writeFileSync(p,n);}
// Fixture dependency identities follow the manifest, not the old scoped facade.
for(const name of ['package-protocol','package-page-site','package-app-module','package-host-bundle']) {
  edit(upstream,`packages/cli/test/cli/${name}.test.ts`,s=>{
    s="import contractManifest from '../../../skill-app-contract-public/package.json';\nconst contractVersion = contractManifest.version;\n"+s;
    return s.replaceAll("'../../../skill-app-contract'","'../../../skill-app-contract-public'")
      .replaceAll("'0.1.1'",'contractVersion').replaceAll('@0.1.1`','@${contractVersion}`');
  });
}
for(const root of [upstream,depa]) {
  for(const name of ['page-builder-vue',...(root===upstream?['page-builder-vue-support']:[])]) {
    edit(root,`packages/${name}/test/builder.test.ts`,s=>"import builderManifest from 'halfcode-lite-page-builder-vue-support/package.json';\n"+s.replace("builderVersion: '0.1.1'",'builderVersion: builderManifest.version'));
  }
  edit(root,'scripts/release-builder.ts',s=>s.replace('/^\\d+\\.\\d+\\.\\d+$/','/^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$/'));
  edit(root,'packages/cli/test/scripts/clone.test.ts',s=>s.replace('/^\\d+\\.\\d+\\.\\d+$/','/^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$/'));
  edit(root,'packages/cli/test/cli/release.test.ts',s=>{
    s="import builderManifest from 'halfcode-lite-page-builder-vue-support/package.json';\n"+s;
    s=s.replaceAll("'halfcode-lite-page-builder-vue-support': '0.1.1'","'halfcode-lite-page-builder-vue-support': builderManifest.version");
    if(root===upstream) {
      s="import contractManifest from '../../../skill-app-contract-public/package.json';\n"+s;
      s=s.replaceAll('runtime-darwin-','halfcode-lite-darwin-').replaceAll('runtime-windows-','halfcode-lite-windows-')
        .replace("name.startsWith('runtime-')","/^halfcode-lite-(darwin|windows)-/.test(name)")
        .replaceAll("'halfcode-lite-skill-app-contract': '0.1.1'","'halfcode-lite-skill-app-contract': 'workspace:*'");
    }
    return s;
  });
}
// Preserve semantic/App identities and actual resource filenames; only host install directory changed.
for(const dir of ['packages/cli/test/cli','packages/cli/test/scripts'])for(const name of readdirSync(join(upstream,dir)).filter(n=>n.endsWith('.ts'))) {
  edit(upstream,join(dir,name),s=>s.replaceAll('halfcode-lite.host/resource-readers/v1','halfcode-app-lite.host/resource-readers/v1')
    .replaceAll('/sops/halfcode-app-lite-demo--','/sops/halfcode-cli-lite-demo--')
    .replaceAll('global/skills/halfcode-app-lite/','global/skills/halfcode-lite/')
    .replaceAll('packages/runtime-darwin-','packages/halfcode-lite-darwin-').replaceAll('packages/runtime-windows-','packages/halfcode-lite-windows-'));
}
