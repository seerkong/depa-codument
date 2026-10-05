import {createPageListCommand} from 'halfcode-lite-page-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {bindPageFeature} from '../page-feature';
import {BIN} from '../../identity';
export const pageListCommand=bindCommandRuntime(createPageListCommand(BIN),bindPageFeature);
