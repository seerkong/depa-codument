import {createInvokeCommand} from 'halfcode-lite-browser-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {BIN} from '../../identity';
import {bindBrowserFeature} from '../browser-feature';
export const invokeCommand=bindCommandRuntime(createInvokeCommand(BIN),bindBrowserFeature);
