import {createPageWorkflowHandlers} from 'halfcode-lite-serve-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {bindPageLiveFeature} from '../serve-feature';
import {BIN} from '../../identity';
const handlers=createPageWorkflowHandlers(BIN);
export const pageWorkflowStartCommand=bindCommandRuntime(handlers.pageWorkflowStartCommand,bindPageLiveFeature);
export const pageWorkflowGetCommand=bindCommandRuntime(handlers.pageWorkflowGetCommand,bindPageLiveFeature);
