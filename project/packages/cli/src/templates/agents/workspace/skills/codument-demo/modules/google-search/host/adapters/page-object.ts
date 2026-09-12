import { emptyObjectSchema, pageRuntime } from '../logic/contracts.ts';
import { DemoPage, GoogleSearchPage } from '../logic/search.ts';

const api = globalThis.Codument;
if (!api) throw new Error('Host resource definition API is unavailable');

export const pageObjectDefinitions = [
  api.definePageObject({
    fqn: 'Codument.GoogleSearch.Page.Results',
    description: 'Google HK 搜索结果页 PageObject',
    runtimeCapabilities: ['page'],
    selectionPolicy: { kind: 'external-page', urlPattern: '^https://www\\.google\\.com\\.hk/', cardinality: 'exactly-one' },
    defaultSelector: { byExternalPage: {} },
    activation: { onMissing: 'open', url: 'https://www.google.com.hk/' },
    actions: [{
      fqn: 'Codument.GoogleSearch.Page.Results.extract',
      description: '提取当前第一页自然搜索结果的 rank、title、url、displayUrl 与 snippet',
      inputSchema: emptyObjectSchema, outputSchema: { type: 'object' },
      handler: (runtime) => GoogleSearchPage.extract(pageRuntime(runtime).session),
    }],
  }),
  api.definePageObject({
    fqn: 'Codument.Demo.Page',
    description: 'codument demo 静态页面 PageObject',
    runtimeCapabilities: ['page'],
    selectionPolicy: { kind: 'served-page', pageName: 'google-search', cardinality: 'exactly-one' },
    actions: [{
      fqn: 'Codument.Demo.Page.setResult', description: '把 PageWorkflow receipt 精确回填到指定 demo 页面实例',
      inputSchema: { type: 'object' }, outputSchema: {},
      handler: (runtime, _selector, invocation) => DemoPage.setResult(pageRuntime(runtime).session, invocation.payload),
    }],
  }),
];
