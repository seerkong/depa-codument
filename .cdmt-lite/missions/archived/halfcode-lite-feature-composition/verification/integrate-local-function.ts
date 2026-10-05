import {readFileSync,writeFileSync} from 'node:fs';
const roots=['/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite','/Users/kongweixian/infra-dev/depa-codument/project'];
for(const root of roots){
  const manifestPath=`${root}/packages/cli/package.json`;
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  manifest.dependencies['halfcode-lite-local-function-capsule']=root.endsWith('/project')?'0.2.0':'workspace:*';
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  const registryPath=`${root}/packages/cli/src/cli/command-registry.ts`;
  let registry=readFileSync(registryPath,'utf8');
  if(!registry.includes('...createLocalFunctionCommands')){
    const start=registry.indexOf("  group('LocalFunction',");
    const end=registry.indexOf("  group('ConfigurationProfile',",start);
    if(start<0||end<0)throw Error('LocalFunction registry boundary missing');
    registry=registry.slice(0,start)+"  ...createLocalFunctionCommands<CommandRuntime>({bin: BIN, bind: bindLocalFunctionFeature, validate: resourceKindValidateCommand('LocalFunction')}),\n"+registry.slice(end);
    registry=registry.replace(/import \{\s*localFunctionDetailCommand,\s*localFunctionInvokeCommand,\s*localFunctionListCommand,\s*\} from '.\/commands\/local-function';\n/,'');
    registry="import {createLocalFunctionCommands} from 'halfcode-lite-local-function-capsule';\nimport {bindLocalFunctionFeature} from './local-function-feature';\n"+registry;
    writeFileSync(registryPath,registry);
  }
  writeFileSync(`${root}/packages/cli/src/cli/commands/local-function.ts`, `import {createLocalFunctionHandlers} from 'halfcode-lite-local-function-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
import {BIN} from '../../identity';
import {bindLocalFunctionFeature} from '../local-function-feature';
const handlers=createLocalFunctionHandlers(BIN);
export const localFunctionListCommand=bindCommandRuntime(handlers.localFunctionListCommand,bindLocalFunctionFeature);
export const localFunctionDetailCommand=bindCommandRuntime(handlers.localFunctionDetailCommand,bindLocalFunctionFeature);
export const localFunctionInvokeCommand=bindCommandRuntime(handlers.localFunctionInvokeCommand,bindLocalFunctionFeature);
`);
}
