import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const depa='/Users/kongweixian/infra-dev/depa-codument/project';
const features=[
 ['resource','createResourceCommands','bindResourceFeature'],
 ['local-function','createLocalFunctionCommands','bindLocalFunctionFeature'],
 ['browser','createBrowserCommands','bindBrowserFeature'],
 ['browser','createBrowserWebApiCommands','bindBrowserWebApiFeature'],
 ['page','createPageInspectionCommands','bindPageFeature'],
 ['serve','createServeCommands','bindServeFeature'],
 ['serve','createPageLiveCommands','bindPageLiveFeature'],
 ['mcp-app','createMcpAppCommands','bindMcpAppFeature'],
];
const management=['statusCommand','initCommand','initGlobalCommand','initWorkspaceCommand','upgradeCommand','upgradeGlobalCommand','upgradeWorkspaceCommand'];
for(const root of [upstream,depa]){
  const codument=root===depa;
  const entry=join(root,'packages/cli/src/cli/command-registry.ts');
  let s=readFileSync(entry,'utf8');
  const start=s.indexOf(codument?'const workspaceOptions:':'const LOCAL =');
  const end=s.indexOf('validateCommandExecutionPolicies(COMMANDS);');
  if(start<0||end<start)throw new Error('Registry shape changed');
  let body=s.slice(start,end).replaceAll('<CommandRuntime>','<R>')
    .replace('export const COMMANDS: readonly CommandDefinition[] =','const commands: readonly CommandDefinition<R>[] =');
  const name=codument?'createCodumentProductCommands':'createHalfcodeProductCommands';
  const imports=s.split('\n').filter(line=>line.startsWith('import ')&&
    /from 'halfcode-lite-(?:resource|local-function|browser|page|serve|mcp-app|management)-capsule/.test(line)).join('\n');
  const types=features.map(([,factory,binding])=>`  readonly ${binding}: Parameters<typeof ${factory}<R>>[0]['bind'];`).join('\n');
  const runTypes=management.map(n=>`  readonly ${n}: CommandRun<R>;`).join('\n');
  const inputs=[...features.map(f=>f[2]),...management];
  const generic=codument?'R extends CodumentDomainCommandRuntime':'R';
  const source=`${imports}
import {valueOption, type RegistryOption, bindCommandRuntime, validateCommandTree, validateCommandExecutionPolicies} from 'halfcode-lite-cli-host-logic';
import {createResourceHandlers} from 'halfcode-lite-resource-capsule';
import {builtinResourceKind, type BuiltinResourceKindName} from 'halfcode-lite-skill-app-logic/resources/kinds';
import type {CommandDefinition, CommandRun} from 'halfcode-lite-cli-host-contract';
${codument?`import {createCodumentDomainCommands, type CodumentDomainCommandRuntime} from 'depa-codument-host-adapter';
import {appendCommandOperations} from 'halfcode-lite-skill-app-logic/command-operation';
import {createCodumentGuidanceOperations} from './global-guidance';`:''}

export interface ProductCommandBindings<${generic}> {
  readonly identity: {readonly bin:string;readonly displayName:string};
${types}
${runTypes}
}

/** Product owns feature selection, domain policies and exposure; caller supplies environment bindings.
 * Commands borrow runtime facets. Their lifetime stays with the invocation/Serve/MCP owner.
 */
export ${codument?'async ':''}function ${name}<${generic}>(bindings:ProductCommandBindings<R>) {
  const {bin:BIN,displayName:DISPLAY_NAME}=bindings.identity;
  const {${inputs.join(',')}}=bindings;
  const handlers=createResourceHandlers(BIN);
  const resourceKindListCommand=(kind:BuiltinResourceKindName)=>bindCommandRuntime(handlers.resourceKindListCommand(kind),bindResourceFeature);
  const resourceKindDetailCommand=(kind:BuiltinResourceKindName)=>bindCommandRuntime(handlers.resourceKindDetailCommand(kind),bindResourceFeature);
  const resourceKindValidateCommand=(kind:BuiltinResourceKindName)=>bindCommandRuntime(handlers.resourceKindValidateCommand(kind),bindResourceFeature);
${body}
  validateCommandTree(commands);
  validateCommandExecutionPolicies(commands);
  return commands;
}
`;
  writeFileSync(join(root,'packages/product-capsule/src/commands.ts'),source);
  s=s.slice(0,start)+`export const COMMANDS: readonly CommandDefinition[] = ${codument?'await ':''}${name}<CommandRuntime>({
  identity:{bin:BIN,displayName:DISPLAY_NAME},${inputs.join(',')},
});
`+s.slice(end);
  s=s.split('\n').filter(line=>!imports.split('\n').includes(line)&&
    !line.startsWith("import { valueOption,")&&
    !line.startsWith("import { appendCommandOperations ")&&
    !line.startsWith("import { createCodumentGuidanceOperations ")&&
    !line.startsWith("import { resourceKindDetailCommand,")&&
    !line.startsWith("import { builtinResourceKind ")).join('\n');
  s=s.replace('createCodumentDomainCommands, isCodumentDomainExecution','isCodumentDomainExecution');
  s=`import {${name}} from '${codument?'depa-codument':'halfcode-lite'}-product-capsule/commands';\n`+s;
  writeFileSync(entry,s);
  const manifestPath=join(root,'packages/product-capsule/package.json');
  const p=JSON.parse(readFileSync(manifestPath,'utf8'));
  p.exports['./commands']='./src/commands.ts';
  const cli=JSON.parse(readFileSync(join(root,'packages/cli/package.json'),'utf8'));
  for(const capability of [...new Set(features.map(f=>f[0])),'management']){
    const dependency=`halfcode-lite-${capability}-capsule`;
    p.dependencies[dependency]=cli.dependencies[dependency];
  }
  p.dependencies['halfcode-lite-cli-host-logic']=cli.dependencies['halfcode-lite-cli-host-logic'];
  writeFileSync(manifestPath,JSON.stringify(p,null,2)+'\n');
}
