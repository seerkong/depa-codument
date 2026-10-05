import {readFileSync,writeFileSync} from 'node:fs';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const integrateOnly=process.argv.includes('--integrate-depa');
const roots=integrateOnly?['/Users/kongweixian/infra-dev/depa-codument/project']:[upstream,'/Users/kongweixian/infra-dev/depa-codument/project'];
const base=`${upstream}/packages/browser-capsule`;
const read=(file:string)=>readFileSync(`${upstream}/packages/cli/src/cli/${file}`,'utf8');
const write=(file:string,text:string)=>writeFileSync(`${base}/src/${file}`,text);
const names={'invoke':'invokeCommand','run-web-api':'runWebApiCommand','exec-code':'execCodeCommand','browser-web-api':'browserWebApiInvokeCommand'};
if(!integrateOnly){
const deps=['cli-host-contract','cli-host-logic','browser-support'];
writeFileSync(`${base}/package.json`,JSON.stringify({name:'halfcode-lite-browser-capsule',version:'0.2.0',type:'module',sideEffects:false,halfcodeClone:{identity:'shared'},exports:{'.':'./src/index.ts','./flags':'./src/flags.ts'},files:['src','README.md'],dependencies:Object.fromEntries(deps.map(d=>['halfcode-lite-'+d,'workspace:*'])),engines:{bun:'>=1.3.0'},license:'MIT'},null,2)+'\n');
writeFileSync(`${base}/README.md`,'# Browser command capability\n\nBoundary: shared browser command parsing and execution over borrowed provider and explicit registry policy.\n\nNot Owned Here: product registry roots, browser session ownership, global discovery policy or Serve lifecycle. No provider is closed by a command.\n');
let flags=read('commands/runtime-flags.ts');
flags=flags.replace("from '../effects/browser-provider'","from 'halfcode-lite-cli-host-contract'")
 .replace('  createBrowserProviderClientFetch,\n  requestUrl,\n','')
 .replace("import type { OpenCliSubtransport } from '../effects/opencli';","import {createBrowserProviderClientFetch,requestUrl} from 'halfcode-lite-cli-host-logic';\nimport type { OpenCliSubtransport } from 'halfcode-lite-cli-host-contract';")
 .replace("import type { CommandRuntime } from '../contracts/command';","import type { BrowserFeatureRuntime as CommandRuntime } from './runtime';");
write('flags.ts',flags);
write('web-api.ts',read('runtime/web-api.ts'));
write('exec-code-runtime.ts',read('runtime/exec-code.ts'));
let invoke=read('runtime/invoke.ts').replace("from './registry'","from 'halfcode-lite-browser-support/registry'")
 .replace("import { resolveDiscoveredFunction, resolveModulePath, type LocateRegistryOptions, type RegistryFunction }", "import { resolveDiscoveredFunction, resolveModulePath }")
 .replace("from './exec-code'","from './exec-code-runtime'")
 .replace("from '../commands/runtime-flags'","from './flags'")
 .replace("from '../effects/browser-provider'","from 'halfcode-lite-cli-host-contract'");
invoke="import type {LocateRegistryOptions,RegistryFunction} from 'halfcode-lite-cli-host-contract/registry';\n"+invoke;
write('invoke-runtime.ts',invoke);
for(const [file,name] of Object.entries(names)){
 let source=read(`commands/${file}.ts`).replace("import { BIN } from '../../identity';\n",'')
 .replace("from '../contracts/command'","from './runtime'")
 .replace("from '../runtime/invoke'","from './invoke-runtime'")
 .replace("from '../runtime/web-api'","from './web-api'")
 .replace("from '../runtime/exec-code'","from './exec-code-runtime'")
 .replace("from '../effects/browser-provider'","from 'halfcode-lite-cli-host-logic'")
 .replace("from './runtime-flags'","from './flags'");
 source=source.replace("import { collectSkillsDirs } from '../runtime/registry';","import {collectSkillsDirs} from 'halfcode-lite-cli-host-logic/registry';")
 .replace("import { collectSkillsDirs, locateRegistryFile, parseRegistry, resolveModulePath } from '../runtime/registry';","import {collectSkillsDirs,parseRegistry} from 'halfcode-lite-cli-host-logic/registry';\nimport {locateRegistryFile,resolveModulePath} from 'halfcode-lite-browser-support/registry';");
 source=source.replace(/context.runtime.browserProviderFor\?\.\(/g,'context.runtime.browserProviderFor(').replace(/\) \?\? context.runtime.browserProvider/g,')');
 if(file==='invoke')source=source.replace('invokeCompiledFunction({','invokeCompiledFunction({...context.runtime.registryOptions({').replace('      fqn,\n      input:', '      }),\n      fqn,\n      input:');
 if(file==='exec-code')source=source.replace('locateRegistryFile({','locateRegistryFile(context.runtime.registryOptions({').replace("      registry: optionString(context.options.registry),\n    });","      registry: optionString(context.options.registry),\n    }));");
 if(file==='browser-web-api')source=source.replace("import type { CommandContext, CommandResult } from './runtime';","import type {CommandContext as HostContext,CommandResult} from 'halfcode-lite-cli-host-contract';\nimport type {BrowserWebApiFeatureRuntime} from './runtime';\ntype CommandContext=HostContext<BrowserWebApiFeatureRuntime>;")
 .replace("import { invokeBrowserWebApi } from '../runtime/browser-web-api';\n",'')
 .replace('invokeBrowserWebApi({\n      runtime: context.runtime, fqn,','context.runtime.invokeBrowserWebApi({\n      fqn,');
 const start=source.indexOf(`export async function ${name}`);
 source=source.slice(0,start)+`export function create${name[0].toUpperCase()+name.slice(1)}(BIN:string) {\n`+source.slice(start).replace('export async function','async function')+`\nreturn ${name};\n}\n`;
 write(file+'.ts',source);
}
const original=read('command-registry.ts');
const groupStart=original.indexOf("  group('BrowserWebApi',");
const groupEnd=original.indexOf("  group('PageWorkflow',",groupStart);
const leafStart=original.indexOf("  leaf(BROWSER, 'run-web-api',");
const leafEnd=original.indexOf('\n]);',leafStart);
const browserGroup=original.slice(groupStart,groupEnd).replace("kindSummary('BrowserWebApi')","'Inspect and invoke profiled browser Web APIs.'");
const browserLeaves=original.slice(leafStart,leafEnd);
write('commands.ts',`import type {CommandDefinition,CommandRun} from 'halfcode-lite-cli-host-contract';
import {createCommandBuilders,valueOption,bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
import {createInvokeCommand} from './invoke';
import {createRunWebApiCommand} from './run-web-api';
import {createExecCodeCommand} from './exec-code';
import {createBrowserWebApiInvokeCommand} from './browser-web-api';
import type {BrowserFeatureRuntime,BrowserWebApiFeatureRuntime} from './runtime';
const BROWSER={placement:'dynamic',runtimeProfile:'browser'} as const;
const CATALOG={placement:'local',runtimeProfile:'catalog'} as const;
export function createBrowserCommands<R>({bin:BIN,bind}:{bin:string;bind:(runtime:R)=>BrowserFeatureRuntime}):readonly CommandDefinition<R>[] {
const {leaf}=createCommandBuilders<R>();
const invokeCommand=bindCommandRuntime(createInvokeCommand(BIN),bind);
const runWebApiCommand=bindCommandRuntime(createRunWebApiCommand(BIN),bind);
const execCodeCommand=bindCommandRuntime(createExecCodeCommand(BIN),bind);
return Object.freeze([\n${browserLeaves}\n]);
}
export function createBrowserWebApiCommands<R>({bin:BIN,bind,resourceKindListCommand,resourceKindDetailCommand,resourceKindValidateCommand}:{bin:string;bind:(runtime:R)=>BrowserWebApiFeatureRuntime;resourceKindListCommand:(kind:'BrowserWebApi')=>CommandRun<R>;resourceKindDetailCommand:(kind:'BrowserWebApi')=>CommandRun<R>;resourceKindValidateCommand:(kind:'BrowserWebApi')=>CommandRun<R>}):readonly CommandDefinition<R>[] {
const {leaf,group}=createCommandBuilders<R>();
const browserWebApiInvokeCommand=bindCommandRuntime(createBrowserWebApiInvokeCommand(BIN),bind);
return Object.freeze([\n${browserGroup}\n]);
}
`);
write('index.ts',`export * from './runtime';\nexport * from './commands';\n${Object.keys(names).map(f=>`export * from './${f}';`).join('\n')}\n`);
}
for(const root of roots){
 const path=`${root}/packages/cli/src/cli/command-registry.ts`;
 let registry=readFileSync(path,'utf8');
 const start=registry.indexOf("  group('BrowserWebApi',");const end=registry.indexOf("  group('PageWorkflow',",start);
 const startLeaves=registry.indexOf("  leaf(BROWSER, 'run-web-api',");const endLeaves=registry.indexOf(root===upstream?'\n]);':'\n], await createCodumentGuidanceOperations()',startLeaves);
 if(start<0||end<0||startLeaves<0||endLeaves<0)throw Error('Registry boundaries missing');
 registry=registry.slice(0,startLeaves)+"  ...createBrowserCommands<CommandRuntime>({bin:BIN,bind:bindBrowserFeature}),"+registry.slice(endLeaves);
 registry=registry.slice(0,start)+"  ...createBrowserWebApiCommands<CommandRuntime>({bin:BIN,bind:bindBrowserWebApiFeature,resourceKindListCommand,resourceKindDetailCommand,resourceKindValidateCommand}),\n"+registry.slice(end);
 registry=registry.replace(/^import \{ (execCodeCommand|invokeCommand|runWebApiCommand|browserWebApiInvokeCommand) \} from .*;\n/gm,'');
 registry="import {createBrowserCommands,createBrowserWebApiCommands} from 'halfcode-lite-browser-capsule';\nimport {bindBrowserFeature,bindBrowserWebApiFeature} from './browser-feature';\n"+registry;
 writeFileSync(path,registry);
 for(const [file,name] of Object.entries(names)){
  const factory='create'+name[0].toUpperCase()+name.slice(1);
  const bind=file==='browser-web-api'?'bindBrowserWebApiFeature':'bindBrowserFeature';
  writeFileSync(`${root}/packages/cli/src/cli/commands/${file}.ts`,`import {${factory}} from 'halfcode-lite-browser-capsule';\nimport {bindCommandRuntime} from 'halfcode-lite-cli-host-logic';\nimport {BIN} from '../../identity';\nimport {${bind}} from '../browser-feature';\nexport const ${name}=bindCommandRuntime(${factory}(BIN),${bind});\n`);
 }
 const manifestPath=`${root}/packages/cli/package.json`;const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));manifest.dependencies['halfcode-lite-browser-capsule']=root===upstream?'workspace:*':'0.2.0';writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
