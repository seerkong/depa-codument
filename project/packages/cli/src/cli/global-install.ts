import {createInstallationCapability} from 'halfcode-lite-management-capsule';
import * as os from 'node:os';
import * as path from 'node:path';
import { BIN } from '../identity';
import type { ResourceEffect } from './effects/resource';
import type { WorkspaceEffect } from './effects/workspace';
import { globalInstallTargets, installGlobalSkills, type SkillInstallReceipt } from './install';

export interface GlobalInstallReceipt {
  backupRoot: string;
  skills: SkillInstallReceipt[];
}

export function resolveInstallHome(environment: NodeJS.ProcessEnv = process.env): string {
  const override = environment.CODUMENT_HOME?.trim();
  return path.resolve(override || os.homedir());
}

export function resolveGlobalBin(homeRoot: string = resolveInstallHome()): string {
  return path.join(homeRoot, '.bun', 'bin', BIN);
}

export async function applyGlobalInstall(resources:ResourceEffect,workspaceOf:(root?:string)=>WorkspaceEffect,homeRoot:string,operation:'init-global'|'upgrade-global',agent?:string):Promise<GlobalInstallReceipt> {
 const targets=globalInstallTargets(agent);
 const capability=createInstallationCapability({root:homeRoot,backupParent:'.tmp/'+BIN,managedPaths:targets.map(({skillsDir})=>skillsDir+'/'+BIN)});
 const result=await capability.apply(operation,()=>installGlobalSkills(resources,workspaceOf,targets));
 return {backupRoot:result.backupRoot,skills:result.value};
}
