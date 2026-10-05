import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import {createResourceHandlers} from 'halfcode-lite-resource-capsule';
import type {BuiltinResourceKindName} from '../resources/kinds';
import {resourceContext} from '../resource-feature';
const handlers = createResourceHandlers(BIN);
export function resourceKindListCommand(kind: BuiltinResourceKindName) { return (context: CommandContext) => handlers.resourceKindListCommand(kind)(resourceContext(context)); }
export function resourceKindDetailCommand(kind: BuiltinResourceKindName) { return (context: CommandContext) => handlers.resourceKindDetailCommand(kind)(resourceContext(context)); }
export function resourceKindValidateCommand(kind: BuiltinResourceKindName) { return (context: CommandContext) => handlers.resourceKindValidateCommand(kind)(resourceContext(context)); }
export function resourceTreeCommand(context: CommandContext) {return handlers.resourceTreeCommand(resourceContext(context));}
export function resourceValidateCommand(context: CommandContext) {return handlers.resourceValidateCommand(resourceContext(context));}

import {createPageObjectInvokeCommand} from 'halfcode-lite-serve-capsule';
import {bindCommandRuntime} from 'halfcode-lite-cli-logic';
import {bindPageLiveFeature} from '../serve-feature';
export const pageObjectInvokeCommand=bindCommandRuntime(createPageObjectInvokeCommand(BIN),bindPageLiveFeature);
