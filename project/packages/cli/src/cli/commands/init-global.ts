import {createGlobalInstallCommand} from 'halfcode-lite-management-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {BIN} from '../../identity';
import {bindGlobalInstallFeature} from '../management-feature';
export const initGlobalCommand=bindCommandRuntime(createGlobalInstallCommand({bin:BIN,operation:'init-global',agentOption:true}),bindGlobalInstallFeature);
