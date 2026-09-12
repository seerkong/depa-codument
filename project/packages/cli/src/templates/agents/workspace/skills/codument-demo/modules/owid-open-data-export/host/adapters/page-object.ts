import { owidInputSchema, pageRuntime } from '../logic/contracts.ts';
import { OpenDataExportPage, OwidChartActions } from '../logic/owid.ts';

const api = globalThis.Codument;
if (!api) throw new Error('Host resource definition API is unavailable');

export const pageObjectDefinitions = [
  api.definePageObject({
    fqn: 'Codument.Owid.LifeExpectancy.Page.Chart',
    description: 'OWID life-expectancy 图表与下载选项 PageObject',
    runtimeCapabilities: ['page'],
    selectionPolicy: { kind: 'external-page', urlPattern: '^https://ourworldindata\\.org/grapher/life-expectancy(?:[?#]|$)', cardinality: 'exactly-one' },
    defaultSelector: { byExternalPage: {} },
    activation: { onMissing: 'open', url: 'https://ourworldindata.org/grapher/life-expectancy' },
    actions: [
      ['configure', '设置实体、年份范围与图表视图'], ['verify', '验证 allowlisted 图表与筛选状态'],
      ['openDownload', '打开 OWID Download data UI'], ['download', '触发一次 allowlisted displayed/full ZIP 下载'],
    ].map(([name, description]) => ({
      fqn: `Codument.Owid.LifeExpectancy.Page.Chart.${name}`, description,
      inputSchema: owidInputSchema, outputSchema: {},
      handler: (runtime, _selector, invocation) => OwidChartActions[name](pageRuntime(runtime).session, invocation.payload),
    })),
  }),
  api.definePageObject({
    fqn: 'Codument.Owid.OpenDataExport.Page',
    description: 'OWID Open Data Export demo 静态页面 PageObject',
    runtimeCapabilities: ['page'],
    selectionPolicy: { kind: 'served-page', pageName: 'open-data-export', cardinality: 'exactly-one' },
    actions: [{
      fqn: 'Codument.Owid.OpenDataExport.Page.setResult', description: '把 PageWorkflow receipt 精确回填到原始 open-data-export 页面实例',
      inputSchema: { type: 'object', required: ['run'] }, outputSchema: {},
      handler: (runtime, _selector, invocation) => OpenDataExportPage.setResult(pageRuntime(runtime).session, invocation.payload),
    }],
  }),
];
