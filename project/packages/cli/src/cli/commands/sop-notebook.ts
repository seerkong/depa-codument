import {BIN} from '../../identity';
import type {CommandContext} from '../contracts/command';
import {createSopNotebookHandlers} from 'halfcode-lite-resource-capsule';
import {resourceContext} from '../resource-feature';
const handlers=createSopNotebookHandlers(BIN);
export function sopNotebookInitCommand(context: CommandContext) {return handlers.sopNotebookInitCommand(resourceContext(context));}
