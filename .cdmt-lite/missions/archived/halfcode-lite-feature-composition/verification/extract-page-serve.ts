import {readFileSync,writeFileSync} from 'node:fs';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const depa='/Users/kongweixian/infra-dev/depa-codument/project';
const read=(root:string,file:string)=>readFileSync(`${root}/packages/cli/src/cli/${file}`,'utf8');
const registry=read(upstream,'command-registry.ts');
const slice=(start:string,end:string)=>{const a=registry.indexOf(start),b=registry.indexOf(end,a);if(a<0||b<0)throw Error('Missing command group');return registry.slice(a,b);};
const pageGroups=slice("  group('Site',","  group('mcp-app',");
const serveGroup=slice("  group('serve',","  ...createResourceCommands");
const liveGroups=slice("  group('PageWorkflow',","  ...createBrowserCommands");
const write=(pkg:string,file:string,text:string)=>writeFileSync(`${upstream}/packages/${pkg}/${file}`,text);
for(const pkg of ['page-capsule','serve-capsule']){
 const deps=['cli-host-contract','cli-host-logic','skill-app-contract',...(pkg==='page-capsule'?['skill-app-support']:[])];
 write(pkg,'package.json',JSON.stringify({name:'halfcode-lite-'+pkg,version:'0.2.0',type:'module',sideEffects:false,halfcodeClone:{identity:'shared'},exports:{'.':'./src/index.ts'},files:['src','README.md'],dependencies:Object.fromEntries(deps.map(d=>['halfcode-lite-'+d,'workspace:*'])),engines:{bun:'>=1.3.0'},license:'MIT'},null,2)+'\n');
 write(pkg,'README.md',`# ${pkg}\n\nBoundary: shared CLI parsing, validation and receipts over narrow borrowed ports.\n\nNot Owned Here: product workspace discovery, server admission or owner teardown. Bindings decide lifetime explicitly; command factories never assemble a product.\n`);
}
let page=read(upstream,'commands/page.ts').replace("import { BIN } from '../../identity';\n",'').replace("from '../contracts/command'","from './runtime'").replace("from '../resources/confined-resource-file'","from 'halfcode-lite-skill-app-support/resources/confined-resource-file'").replace('context.runtime.page?.pages','context.runtime.pages').replace('context.runtime.resourceCatalog?.snapshot()','context.runtime.resourceCatalog.snapshot()');
page=page.replace('export async function pageListCommand','export function createPageListCommand(BIN:string) {\nasync function pageListCommand')+'\nreturn pageListCommand;\n}\n';
write('page-capsule','src/page.ts',page);
const shared=`import type {CommandDefinition,CommandRun} from 'halfcode-lite-cli-host-contract';
import {createCommandBuilders,valueOption,bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
type KindCommands<R>={readonly resourceKindListCommand:(kind:Kind)=>CommandRun<R>;readonly resourceKindDetailCommand:(kind:Kind)=>CommandRun<R>;readonly resourceKindValidateCommand:(kind:Kind)=>CommandRun<R>;readonly kindSummary:(kind:Kind)=>string};
const CATALOG={placement:'local',runtimeProfile:'catalog'} as const;
`;
write('page-capsule','src/commands.ts',shared+`import {createPageListCommand} from './page';
import type {PageFeatureRuntime} from './runtime';
type Kind='Site'|'PageBundle'|'Page';
const PAGE_CATALOG={placement:'local',runtimeProfile:'page-catalog'} as const;
export function createPageInspectionCommands<R>({bin:BIN,bind,resourceKindListCommand,resourceKindDetailCommand,resourceKindValidateCommand,kindSummary}:{bin:string;bind:(runtime:R)=>PageFeatureRuntime}&KindCommands<R>):readonly CommandDefinition<R>[] {
const {leaf,group}=createCommandBuilders<R>();
const pageListCommand=bindCommandRuntime(createPageListCommand(BIN),bind);
return Object.freeze([\n${pageGroups}\n]);\n}\n`);
write('page-capsule','src/index.ts',"export * from './runtime';\nexport * from './page';\nexport * from './commands';\n");
let serve=read(upstream,'commands/serve.ts');
serve=serve.replace("import { BIN } from '../../identity';\n",'').replace("from '../contracts/command'","from './runtime'").replace(/^import .* from '(\.\.\/lifecycle|\.\.\/runtime\/ego-scope|\.\.\/app\/invoke)';\n/gm,'');
const bodyStart=serve.indexOf('  if (!process.env.');const bodyEnd=serve.indexOf('\n}\n\nexport function serveLifecycleCommand',bodyStart);
if(bodyStart<0||bodyEnd<0)throw Error('Serve foreground boundary');
serve=serve.slice(0,bodyStart)+`  if (!context.runtime.foreground) return context.runtime.lifecycle(input);
  const started=await context.runtime.startForeground({host,port});
  return {code:0,data:{command:'serve',host,port:started.port,url:started.url},message:\x60\x24{BIN} listening on \x24{started.url}\x60,wait:started.wait};`+serve.slice(bodyEnd);
serve=serve.replace('invokeServeLifecycle(context.runtime, input)','context.runtime.lifecycle(input)').replace('export async function serveCommand','async function serveCommand').replace('export function serveLifecycleCommand','function serveLifecycleCommand');
const helperEnd=serve.indexOf('function parsePort');
serve=serve.slice(0,helperEnd)+'export function createServeHandlers(BIN:string) {\n'+serve.slice(helperEnd)+'\nreturn {serveCommand,serveLifecycleCommand};\n}\n';
write('serve-capsule','src/serve.ts',serve);
let workflow=read(upstream,'commands/page-workflow.ts').replace("import { BIN } from '../../identity';\n",'').replace("import { invokePageWorkflowGet, invokePageWorkflowStart, invokeServeLifecycle } from '../app/invoke';\n",'').replace("import type { CommandContext, CommandResult } from '../contracts/command';","import type {CommandContext as HostContext,CommandResult} from 'halfcode-lite-cli-host-contract';\nimport type {PageLiveFeatureRuntime} from './runtime';\ntype CommandContext=HostContext<PageLiveFeatureRuntime>;").replace("from '../resources/definitions'","from 'halfcode-lite-skill-app-contract/definitions'").replace("from './runtime-flags'","from 'halfcode-lite-cli-host-logic'");
workflow=workflow.replace("  const serve = await invokeServeLifecycle(context.runtime, { action: 'start' });",`  try { await context.runtime.admitWorkflow({fqn,workflowInput:input.value,selector:context.options.selector===undefined?undefined:selector.value as PageWorkflowSelector}); }
  catch(error) { return {code:1,data:{command:'PageWorkflow.start',accepted:false},message:error instanceof Error?error.message:String(error)}; }
  const serve = await context.runtime.lifecycle({ action: 'start' });`).replace('invokePageWorkflowStart(context.runtime, {','context.runtime.startWorkflow({').replace('invokePageWorkflowGet(context.runtime, runId)','context.runtime.getWorkflow(runId)');
workflow=workflow.replace('export async function','async function');workflow=workflow.replace('export async function','async function');
const helperStart=workflow.indexOf('function isJsonObject');workflow=workflow.slice(0,helperStart)+'export function createPageWorkflowHandlers(BIN:string) {\n'+workflow.slice(helperStart)+'\nreturn {pageWorkflowStartCommand,pageWorkflowGetCommand};\n}\n';
write('serve-capsule','src/workflow.ts',workflow);
let object=read(upstream,'commands/resource.ts');object=object.slice(object.indexOf('export async function pageObjectInvokeCommand')).replace('export async function','async function').replace('invokePageObjectAction(context.runtime, {','context.runtime.invokePageObject({');
write('serve-capsule','src/page-object.ts',`import type {CommandContext as HostContext,CommandResult} from 'halfcode-lite-cli-host-contract';
import type {PageObjectSelector} from 'halfcode-lite-skill-app-contract/definitions';
import type {PageLiveFeatureRuntime} from './runtime';
import {optionString,parseJsonInput} from 'halfcode-lite-cli-host-logic';
type CommandContext=HostContext<PageLiveFeatureRuntime>;
export function createPageObjectInvokeCommand(BIN:string) {\n${object}\nreturn pageObjectInvokeCommand;\n}\n`);
write('serve-capsule','src/commands.ts',shared+`import {createServeHandlers} from './serve';
import {createPageWorkflowHandlers} from './workflow';
import {createPageObjectInvokeCommand} from './page-object';
import type {ServeFeatureRuntime,PageLiveFeatureRuntime} from './runtime';
type Kind='PageWorkflow'|'PageObject';
const SERVE_MANAGER={placement:'entrypoint',runtimeProfile:'serve-manager'} as const;
const SERVE_CLIENT={placement:'serve-required',runtimeProfile:'serve-client'} as const;
export function createServeCommands<R>({bin:BIN,bind}:{bin:string;bind:(runtime:R)=>ServeFeatureRuntime}):readonly CommandDefinition<R>[] {
const {leaf,group}=createCommandBuilders<R>();
const handlers=createServeHandlers(BIN);
const serveCommand=bindCommandRuntime(handlers.serveCommand,bind);
const serveLifecycleCommand=(action:Parameters<typeof handlers.serveLifecycleCommand>[0])=>bindCommandRuntime(handlers.serveLifecycleCommand(action),bind);
return Object.freeze([\n${serveGroup}\n]);\n}
export function createPageLiveCommands<R>({bin:BIN,bind,resourceKindListCommand,resourceKindDetailCommand,resourceKindValidateCommand,kindSummary}:{bin:string;bind:(runtime:R)=>PageLiveFeatureRuntime}&KindCommands<R>):readonly CommandDefinition<R>[] {
const {leaf,group}=createCommandBuilders<R>();
const handlers=createPageWorkflowHandlers(BIN);
const pageWorkflowStartCommand=bindCommandRuntime(handlers.pageWorkflowStartCommand,bind);
const pageWorkflowGetCommand=bindCommandRuntime(handlers.pageWorkflowGetCommand,bind);
const pageObjectInvokeCommand=bindCommandRuntime(createPageObjectInvokeCommand(BIN),bind);
return Object.freeze([\n${liveGroups}\n]);\n}\n`);
write('serve-capsule','src/index.ts',"export * from './runtime';\nexport * from './serve';\nexport * from './workflow';\nexport * from './page-object';\nexport * from './commands';\n");
for(const root of [upstream,depa]){
 const path=`${root}/packages/cli/src/cli/command-registry.ts`;let registry=readFileSync(path,'utf8');
 for(const [start,end,replacement] of [
 ["  group('serve',","  ...createResourceCommands","  ...createServeCommands<CommandRuntime>({bin:BIN,bind:bindServeFeature}),\n"],
 ["  group('Site',","  group('mcp-app',","  ...createPageInspectionCommands<CommandRuntime>({bin:BIN,bind:bindPageFeature,resourceKindListCommand,resourceKindDetailCommand,resourceKindValidateCommand,kindSummary}),\n"],
 ["  group('PageWorkflow',","  ...createBrowserCommands","  ...createPageLiveCommands<CommandRuntime>({bin:BIN,bind:bindPageLiveFeature,resourceKindListCommand,resourceKindDetailCommand,resourceKindValidateCommand,kindSummary}),\n"],
 ]){const a=registry.indexOf(start),b=registry.indexOf(end,a);if(a<0||b<0)throw Error('Product group missing');registry=registry.slice(0,a)+replacement+registry.slice(b);}
 registry=registry.replace(/^import \{ (pageListCommand|pageWorkflowGetCommand, pageWorkflowStartCommand|serveCommand, serveLifecycleCommand) \} from .*;\n/gm,'').replace('  pageObjectInvokeCommand,\n','');
 registry="import {createServeCommands,createPageLiveCommands} from 'halfcode-lite-serve-capsule';\nimport {createPageInspectionCommands} from 'halfcode-lite-page-capsule';\nimport {bindServeFeature,bindPageLiveFeature} from './serve-feature';\nimport {bindPageFeature} from './page-feature';\n"+registry;
 writeFileSync(path,registry);
 const manifestPath=`${root}/packages/cli/package.json`;const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));for(const pkg of ['serve-capsule','page-capsule'])manifest.dependencies['halfcode-lite-'+pkg]=root===upstream?'workspace:*':'0.2.0';writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
