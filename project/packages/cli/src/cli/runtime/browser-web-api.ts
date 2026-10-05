import {executeBrowserWebApi,type BrowserWebApiInput} from 'halfcode-lite-browser-capsule';
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
