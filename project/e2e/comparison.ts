import type {Usage} from './agent-runtime';

export interface ComparisonRow {
  product: string;
  caseId: string;
  status: string;
  firstPass: boolean | null;
  elapsedMs: number | null;
  usage: Usage | null;
  phases: Readonly<Record<string,number>>;
  root: string;
}
/** Pure observation projection; never promotes verdicts or hides failure costs. */
export function compareProducts(rows: readonly ComparisonRow[]) {
  const groups=[...new Set(rows.map(row=>row.product))].map(product=>{
    const trials=rows.filter(row=>row.product===product);
    const business=trials.filter(row=>!['infrastructure-failed','incomplete','harness-invalid'].includes(row.status));
    const measured=trials.filter(row=>row.usage!==null);
    const timed=trials.filter(row=>row.elapsedMs!==null);
    return {product,trials:trials.length,passed:trials.filter(row=>row.status==='passed').length,
      firstPassed:trials.filter(row=>row.firstPass===true && row.status==='passed').length,
      infrastructureOrIncomplete:trials.length-business.length,
      allTrialPassRate:trials.length ? trials.filter(row=>row.status==='passed').length/trials.length : null,
      businessDenominator:business.length,
      correctedBusinessPassRate:business.length ? business.filter(row=>row.status==='passed').length/business.length : null,
      firstBusinessPassRate:business.length ? business.filter(row=>row.firstPass===true).length/business.length : null,
      observedTotalMs:timed.length ? timed.reduce((sum,row)=>sum+row.elapsedMs!,0) : null,
      missingTimes:trials.length-timed.length,
      usage:measured.length ? measured.reduce((sum,row)=>({input:sum.input+row.usage!.input,cached:sum.cached+row.usage!.cached,output:sum.output+row.usage!.output}),{input:0,cached:0,output:0}) : null,
      missingUsage:trials.length-measured.length};
  });
  return {rows,groups,warning:'One fresh sample per case/product; model generation is stochastic and run order is current then legacy. No causal/population guarantee. Shared requirements, policy, harness, model and bounds do not make version-specific workflow semantics identical. Cached tokens are a subset of input. Observed token deltas include failed stages, not an account bill.'};
}
