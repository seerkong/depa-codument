import { googleInputSchema, googleOutputSchema, pageRuntime } from '../logic/contracts.ts';
import { GoogleSearchWorkflow } from '../logic/search.ts';

const api = globalThis.Codument;
if (!api) throw new Error('Host resource definition API is unavailable');

export const pageWorkflowDefinitions = [api.definePageWorkflow({
  fqn: 'Codument.GoogleSearch.Workflow.Search',
  description: '使用 Ego Lite 打开 Google HK、提交页面中的查询词并提取第一页自然搜索结果',
  inputSchema: googleInputSchema,
  outputSchema: googleOutputSchema,
  runtimeCapabilities: ['page'],
  inputSource: { kind: 'served-page', pageName: 'google-search', method: 'getState' },
  resultTarget: { pageName: 'google-search', operationRef: 'Codument.Demo.Page.setResult' },
  selectionPolicy: { kind: 'external-page', urlPattern: '^https://www\\.google\\.com\\.hk/', cardinality: 'exactly-one' },
  defaultSelector: { direct: { byExternalPage: {} } },
  activation: { onMissing: 'open', url: 'https://www.google.com.hk/' },
  start: (runtime, _selector, invocation) => GoogleSearchWorkflow.search(pageRuntime(runtime).session, invocation.payload),
})];
