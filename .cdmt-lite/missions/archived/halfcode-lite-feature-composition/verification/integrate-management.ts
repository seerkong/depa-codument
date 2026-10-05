import {readFileSync,writeFileSync} from 'node:fs';
import ts from '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite/node_modules/typescript/lib/typescript.js';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const depa='/Users/kongweixian/infra-dev/depa-codument/project';
for(const root of [upstream,depa]){
 const base=`${root}/packages/cli/src/cli`;
 const registryPath=`${base}/command-registry.ts`;let registry=readFileSync(registryPath,'utf8');
 const ast=ts.createSourceFile(registryPath,registry,ts.ScriptTarget.Latest,true);
 const edits:{start:number;end:number;text:string}[]=[];
 const names=new Set(['status','init-global','init-workspace','init','upgrade-global','upgrade-workspace','upgrade']);
 function visit(node:ts.Node){
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='leaf'&&node.arguments[1]&&ts.isStringLiteral(node.arguments[1])&&names.has(node.arguments[1].text)){
    const [execution,name,summary,usage,examples,run,options]=node.arguments.map(a=>a.getText(ast));
    edits.push({start:node.getStart(ast),end:node.end,text:`...createManagementCommands<CommandRuntime>([{execution:${execution},name:${name},summary:${summary},usage:${usage},examples:${examples},run:${run}${options?',options:'+options:''}}])`});
  }ts.forEachChild(node,visit);
 }visit(ast);if(edits.length!==7)throw Error('Expected seven management entries');
 for(const edit of edits.sort((a,b)=>b.start-a.start))registry=registry.slice(0,edit.start)+edit.text+registry.slice(edit.end);
 registry="import {createManagementCommands} from 'halfcode-lite-management-capsule';\n"+registry;
 writeFileSync(registryPath,registry);
 writeFileSync(`${base}/management-feature.ts`,`import * as path from 'node:path';
import type {GlobalInstallCommandRuntime} from 'halfcode-lite-management-capsule';
import type {CommandRuntime} from './contracts/command';
import {applyGlobalInstall,resolveInstallHome} from './global-install';
export function bindGlobalInstallFeature(runtime:CommandRuntime):GlobalInstallCommandRuntime {
 return {async install(operation,agent) {
 const home=resolveInstallHome();
 const receipt=await applyGlobalInstall(runtime.resources,root=>runtime.workspace(path.join(home,root??'.')),home,operation${root===depa?',agent':''});
 return {...receipt,home};
 }};
}
`);
 for(const operation of ['init-global','upgrade-global']){
 const name=operation==='init-global'?'initGlobalCommand':'upgradeGlobalCommand';
 writeFileSync(`${base}/commands/${operation}.ts`,`import {createGlobalInstallCommand} from 'halfcode-lite-management-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-host-logic';
import {BIN} from '../../identity';
import {bindGlobalInstallFeature} from '../management-feature';
export const ${name}=bindCommandRuntime(createGlobalInstallCommand({bin:BIN,operation:'${operation}',agentOption:${root===depa}}),bindGlobalInstallFeature);
`);
 }
 for(const command of ['init','upgrade']){
  const p=`${base}/commands/${command}.ts`;let source=readFileSync(p,'utf8');
  const fn=source.indexOf(`export async function ${command}Command`);
  const body=source.indexOf('{\n',fn)+2;
  const globalStart=source.indexOf('  const global = await ',body);
  const globalEnd=source.indexOf(';\n',globalStart);
  const workspaceStart=source.indexOf('  const workspace = await ',globalEnd);
  const workspaceEnd=source.indexOf(';\n',workspaceStart);
  if(fn<0||globalStart<0||workspaceStart<0)throw Error('Stage boundary missing');
  const preflight=source.slice(body,globalStart);
  const global=source.slice(globalStart+'  const global = await '.length,globalEnd);
  const workspace=source.slice(workspaceStart+'  const workspace = await '.length,workspaceEnd);
  source="import {runInstallationStages} from 'halfcode-lite-management-capsule';\n"+source.slice(0,body)+`  return runInstallationStages({bin:BIN,command:'${command}',preflight:()=>{\n${preflight}\n},global:()=>${global},workspace:()=>${workspace}});\n}\n`;
  writeFileSync(p,source);
 }
 const globalPath=`${base}/global-install.ts`;let global=readFileSync(globalPath,'utf8');
 const body=global.indexOf('export async function applyGlobalInstall(');
 global=global.slice(0,body)+`export async function applyGlobalInstall(resources:ResourceEffect,workspaceOf:(root?:string)=>WorkspaceEffect,homeRoot:string,operation:'init-global'|'upgrade-global'${root===depa?',agent?:string':''}):Promise<GlobalInstallReceipt> {
 const targets=${root===depa?'globalInstallTargets(agent)':'INSTALL_TARGETS'};
 const capability=createInstallationCapability({root:homeRoot,backupParent:'.tmp/'+BIN,managedPaths:targets.map(({skillsDir})=>skillsDir+'/'+BIN)});
 const result=await capability.apply(operation,()=>installGlobalSkills(resources,workspaceOf${root===depa?',targets':''}));
 return {backupRoot:result.backupRoot,skills:result.value};
}
`;
 global=global.replace("import { withFileBackup, FileBackupFailure } from 'halfcode-lite-cli-host-support/file-backup';\n",'').replace("import * as fs from 'node:fs/promises';\n",'');
 const helpers=global.indexOf('function backupTimestamp()');
 if(helpers>=0)global=global.slice(0,helpers)+global.slice(global.indexOf('export async function applyGlobalInstall(',helpers));
 writeFileSync(globalPath,"import {createInstallationCapability} from 'halfcode-lite-management-capsule';\n"+global);
 const p=`${root}/packages/cli/package.json`;const m=JSON.parse(readFileSync(p,'utf8'));m.dependencies['halfcode-lite-management-capsule']=root===upstream?'workspace:*':'0.2.0';writeFileSync(p,JSON.stringify(m,null,2)+'\n');
}
