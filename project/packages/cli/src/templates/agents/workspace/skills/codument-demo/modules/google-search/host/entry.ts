import { pageObjectDefinitions } from './adapters/page-object.ts';
import { pageWorkflowDefinitions } from './adapters/page-workflow.ts';

export const resourceDefinitions = [...pageWorkflowDefinitions, ...pageObjectDefinitions];
export * from './logic/search.ts';
