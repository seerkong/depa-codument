import {writeFileSync} from 'node:fs';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
for(const root of [upstream,'/Users/kongweixian/infra-dev/depa-codument/project']){
 const base=`${root}/packages/cli/src/cli/runtime`;
 writeFileSync(`${base}/browser-web-api.ts`,`import {executeBrowserWebApi,type BrowserWebApiInput} from 'halfcode-lite-browser-capsule';
import type {CommandRuntime} from '../contracts/command';
import {createBundleDefinitionCatalog} from '../resources/bundle-materializer';
export async function invokeBrowserWebApi({runtime,...input}:BrowserWebApiInput&{runtime:CommandRuntime}) {
 const definitions=runtime.definitionCatalog??(runtime.resourceCatalog?createBundleDefinitionCatalog(runtime.resourceCatalog):undefined);
 if(!definitions)throw new Error('Bundle definition catalog is not configured');
 const profiles=runtime.configurationProfiles;
 if(!profiles)throw new Error('ConfigurationProfile catalog is not configured');
 return executeBrowserWebApi({definitions,profiles,defaultProfile:()=>runtime.defaultConfigurationProfile?.()??Promise.resolve(undefined),defaultBrowserSelection:()=>runtime.defaultBrowserSelection?.()??Promise.resolve({transport:'ego-browser'}),browserProviderFor:selection=>{
 const provider=runtime.browserProviderFor?.(selection)??runtime.browserProvider;
 if(!provider)throw new Error('Browser provider effect is not configured');
 return provider;
 }},input);
}
`);
 writeFileSync(`${base}/invoke.ts`,`import {invokeCompiledFunction as invoke,type InvokeCompiledFunctionOptions} from 'halfcode-lite-browser-capsule';
import {${root===upstream?'productOptions':'productRoots'}} from './registry';
export type {InvokeCompiledFunctionOptions,InvokeCompiledFunctionResult} from 'halfcode-lite-browser-capsule';
export function invokeCompiledFunction(options:InvokeCompiledFunctionOptions) {return invoke({...options,...${root===upstream?'productOptions':'productRoots'}(options)});}
`);
 // Existing product variants have different module-loader lifetimes; keep their explicit adapters.
}
