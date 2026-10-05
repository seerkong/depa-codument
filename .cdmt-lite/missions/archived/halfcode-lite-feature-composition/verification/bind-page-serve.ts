import {readFileSync,writeFileSync} from 'node:fs';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const depa='/Users/kongweixian/infra-dev/depa-codument/project';
for(const root of [upstream,depa]){
 const base=`${root}/packages/cli/src/cli`;
 const original=readFileSync(`${base}/commands/serve.ts`,'utf8');
 const start=original.indexOf('  const effect = context.runtime.httpServer;');
 const end=original.indexOf('\n}\n\nexport function serveLifecycleCommand',start);
 if(start<0||end<0)throw Error('Foreground boundary missing');
 let foreground=original.slice(start,end).replaceAll('context.runtime','runtime');
 foreground=foreground.replace("if (!effect) return { code: 1, data: { command: 'serve' }, message: 'HTTP server effect is not configured' };","if (!effect) throw new Error('HTTP server effect is not configured');");
 foreground=foreground.replace("    code: 0,\n    data: { command: 'serve', host, port: started.port, url: started.url },\n    message: `${BIN} listening on ${started.url}`,","    port:started.port, url:started.url,");
 let admission='';
 if(root===depa){
  const workflow=readFileSync(`${base}/commands/page-workflow.ts`,'utf8');
  const a=workflow.indexOf('    const definitions = context.runtime.definitionCatalog;');
  const b=workflow.indexOf('\n  } catch (error)',a);
  if(a<0||b<0)throw Error('Admission boundary missing');
  admission=workflow.slice(a,b).replaceAll('context.runtime','runtime').replaceAll('input.value','workflowInput').replace('context.options.selector === undefined ? definition.defaultSelector : selector.value','selector === undefined ? definition.defaultSelector : selector');
 }
 writeFileSync(`${base}/serve-feature.ts`,`import type {ServeFeatureRuntime,PageLiveFeatureRuntime} from 'halfcode-lite-serve-capsule';
import type {CommandRuntime} from './contracts/command';
import {waitForShutdown} from './lifecycle';
import {serverInstanceId} from './runtime/ego-scope';
import {invokeServeLifecycle,invokePageWorkflowStart,invokePageWorkflowGet,invokePageObjectAction} from './app/invoke';
${root===depa?"import {admitResourceDefinition,normalizePageWorkflowSelector,validateResourceValue} from './resources/schema-validator';":''}
export function bindServeFeature(runtime:CommandRuntime):ServeFeatureRuntime {
 return {foreground:Boolean(process.env.${root===depa?'CODUMENT':'HALFCODE_CLI_LITE'}_SERVER_INSTANCE_ID),
 lifecycle:input=>invokeServeLifecycle(runtime,input),
 async startForeground({host,port}) {\n${foreground}\n},
 };
}
export function bindPageLiveFeature(runtime:CommandRuntime):PageLiveFeatureRuntime {
 return {
 async admitWorkflow({fqn,workflowInput,selector}) {${admission}},
 lifecycle:input=>invokeServeLifecycle(runtime,input),
 startWorkflow:input=>invokePageWorkflowStart(runtime,input),
 getWorkflow:runId=>invokePageWorkflowGet(runtime,runId),
 invokePageObject:input=>invokePageObjectAction(runtime,input),
 };
}
`);
 writeFileSync(`${base}/page-feature.ts`,`import type {PageFeatureRuntime} from 'halfcode-lite-page-capsule';
import type {CommandRuntime} from './contracts/command';
export function bindPageFeature(runtime:CommandRuntime):PageFeatureRuntime {
 const pages=runtime.page?.pages;
 if(!pages)throw new Error('Page resource catalog is not configured');
 const resourceCatalog=runtime.resourceCatalog;
 if(!resourceCatalog)throw new Error('Workspace resource catalog is not configured');
 return {pages,resourceCatalog};
}
`);
 writeFileSync(`${base}/commands/serve.ts`,`import {createServeHandlers} from 'halfcode-lite-serve-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
import {bindServeFeature} from '../serve-feature';
import {BIN} from '../../identity';
const handlers=createServeHandlers(BIN);
export const serveCommand=bindCommandRuntime(handlers.serveCommand,bindServeFeature);
export const serveLifecycleCommand=(action:Parameters<typeof handlers.serveLifecycleCommand>[0])=>bindCommandRuntime(handlers.serveLifecycleCommand(action),bindServeFeature);
`);
 writeFileSync(`${base}/commands/page-workflow.ts`,`import {createPageWorkflowHandlers} from 'halfcode-lite-serve-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
import {bindPageLiveFeature} from '../serve-feature';
import {BIN} from '../../identity';
const handlers=createPageWorkflowHandlers(BIN);
export const pageWorkflowStartCommand=bindCommandRuntime(handlers.pageWorkflowStartCommand,bindPageLiveFeature);
export const pageWorkflowGetCommand=bindCommandRuntime(handlers.pageWorkflowGetCommand,bindPageLiveFeature);
`);
 writeFileSync(`${base}/commands/page.ts`,`import {createPageListCommand} from 'halfcode-lite-page-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
import {bindPageFeature} from '../page-feature';
import {BIN} from '../../identity';
export const pageListCommand=bindCommandRuntime(createPageListCommand(BIN),bindPageFeature);
`);
 const resource=readFileSync(`${base}/commands/resource.ts`,'utf8');const boundary=resource.indexOf('export async function pageObjectInvokeCommand');if(boundary<0)throw Error('Object handler missing');
 writeFileSync(`${base}/commands/resource.ts`,resource.slice(0,boundary).replace("import {invokePageObjectAction} from '../app/invoke';\n",'').replace("import type {PageObjectSelector} from '../resources/definitions';\n",'').replace("import {optionString, parseJsonInput} from './runtime-flags';\n",'')+`import {createPageObjectInvokeCommand} from 'halfcode-lite-serve-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
import {bindPageLiveFeature} from '../serve-feature';
export const pageObjectInvokeCommand=bindCommandRuntime(createPageObjectInvokeCommand(BIN),bindPageLiveFeature);
`);
}
