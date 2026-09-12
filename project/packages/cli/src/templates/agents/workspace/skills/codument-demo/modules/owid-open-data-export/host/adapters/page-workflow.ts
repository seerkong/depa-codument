import { owidInputSchema, owidOutputSchema, pageRuntime } from '../logic/contracts.ts';
import { OwidOpenDataWorkflow } from '../logic/owid.ts';

const api = globalThis.Codument;
if (!api) throw new Error('Host resource definition API is unavailable');

export const pageWorkflowDefinitions = [api.definePageWorkflow({
  fqn: 'Codument.Owid.OpenDataExport.Workflow.Run',
  description: '配置 OWID life-expectancy 图表、打开下载选项、下载并解析受限 ZIP 数据包',
  inputSchema: owidInputSchema,
  outputSchema: owidOutputSchema,
  runtimeCapabilities: ['page'],
  resultTarget: { pageName: 'open-data-export', operationRef: 'Codument.Owid.OpenDataExport.Page.setResult' },
  selectionPolicy: { kind: 'external-page', urlPattern: '^https://ourworldindata\\.org/grapher/life-expectancy(?:[?#]|$)', cardinality: 'exactly-one' },
  defaultSelector: { direct: { byExternalPage: {} } },
  activation: { onMissing: 'open', url: 'https://ourworldindata.org/grapher/life-expectancy' },
  start: (runtime, _selector, invocation) => OwidOpenDataWorkflow.run(pageRuntime(runtime).session, invocation.payload),
})];
