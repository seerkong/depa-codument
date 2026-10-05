import {createServeHandlers} from 'halfcode-lite-serve-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {bindServeFeature} from '../serve-feature';
import {BIN} from '../../identity';
const handlers=createServeHandlers(BIN);
export const serveCommand=bindCommandRuntime(handlers.serveCommand,bindServeFeature);
export const serveLifecycleCommand=(action:Parameters<typeof handlers.serveLifecycleCommand>[0])=>bindCommandRuntime(handlers.serveLifecycleCommand(action),bindServeFeature);
