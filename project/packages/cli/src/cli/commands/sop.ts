import {BIN} from '../../identity';
import type {CommandContext} from '../contracts/command';
import {createSopHandlers} from 'halfcode-lite-resource-capsule';
import {resourceContext} from '../resource-feature';
const handlers=createSopHandlers(BIN);
export function sopListCommand(context: CommandContext) {return handlers.sopListCommand(resourceContext(context));}
export function sopDetailCommand(context: CommandContext) {return handlers.sopDetailCommand(resourceContext(context));}
export function sopValidateCommand(context: CommandContext) {return handlers.sopValidateCommand(resourceContext(context));}
export function sopGraphCommand(context: CommandContext) {return handlers.sopGraphCommand(resourceContext(context));}
