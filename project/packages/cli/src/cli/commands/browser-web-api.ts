import {createBrowserWebApiInvokeCommand} from 'halfcode-lite-browser-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {BIN} from '../../identity';
import {bindBrowserWebApiFeature} from '../browser-feature';
export const browserWebApiInvokeCommand=bindCommandRuntime(createBrowserWebApiInvokeCommand(BIN),bindBrowserWebApiFeature);
