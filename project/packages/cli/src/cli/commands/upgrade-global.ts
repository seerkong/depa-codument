import {createGlobalInstallCommand} from 'halfcode-lite-management-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {BIN} from '../../identity';
import {bindGlobalInstallFeature} from '../management-feature';
export const upgradeGlobalCommand=bindCommandRuntime(createGlobalInstallCommand({bin:BIN,operation:'upgrade-global',agentOption:true}),bindGlobalInstallFeature);
