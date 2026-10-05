import {createLocalFunctionHandlers} from 'halfcode-lite-local-function-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {BIN} from '../../identity';
import {bindLocalFunctionFeature} from '../local-function-feature';
const handlers=createLocalFunctionHandlers(BIN);
export const localFunctionListCommand=bindCommandRuntime(handlers.localFunctionListCommand,bindLocalFunctionFeature);
export const localFunctionDetailCommand=bindCommandRuntime(handlers.localFunctionDetailCommand,bindLocalFunctionFeature);
export const localFunctionInvokeCommand=bindCommandRuntime(handlers.localFunctionInvokeCommand,bindLocalFunctionFeature);
