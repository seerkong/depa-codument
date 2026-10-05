import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const depa='/Users/kongweixian/infra-dev/depa-codument/project';
for(const root of [upstream,depa]) {
  const path=join(root,'packages/cli/test/scripts/release-builder.test.ts');
  let s=readFileSync(path,'utf8');
  s="import builderManifest from 'halfcode-lite-page-builder-vue-support/package.json';\n"+s;
  s=s.replace("expect(manifest.dependencies['halfcode-lite-page-builder-vue-support']).toBe('0.1.1')","expect(manifest.dependencies['halfcode-lite-page-builder-vue-support']).toBe(builderManifest.version)");
  s=s.replace("expect(runtime.dependencies['halfcode-lite-page-builder-vue-support']).toBe('0.1.1')",`expect(runtime.dependencies['halfcode-lite-page-builder-vue-support']).toBe(${root===upstream?"'workspace:*'":'builderManifest.version'})`);
  writeFileSync(path,s);
}
for(const platform of ['darwin-arm64','darwin-x64','windows-x64']){
  const path=join(upstream,`packages/halfcode-lite-${platform}/package.json`);
  const p=JSON.parse(readFileSync(path,'utf8'));
  p.dependencies['halfcode-lite-page-builder-vue-support']='workspace:*';
  writeFileSync(path,JSON.stringify(p,null,2)+'\n');
}
const path=join(upstream,'packages/cli/test/cli/release.test.ts');
let s=readFileSync(path,'utf8').replace("import contractManifest from '../../../skill-app-contract-public/package.json';", "import productManifest from '../../../../package.json';");
s=s.replaceAll("version: '0.1.1'",'version: productManifest.version');
s=s.replaceAll("'halfcode-lite-skill-app-contract': 'workspace:*',", "'halfcode-lite-skill-app-contract': 'workspace:*',\n        'halfcode-lite-page-builder-vue-support': 'workspace:*',");
writeFileSync(path,s);
