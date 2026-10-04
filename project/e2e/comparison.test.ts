import {expect,test} from 'bun:test';
import {compareProducts,type ComparisonRow} from './comparison';
test('comparison preserves infrastructure failure cost and unknown timings without promoting rates',()=>{
  const rows:ComparisonRow[]=[
    {product:'current',caseId:'todo',status:'passed',firstPass:true,elapsedMs:1000,usage:{input:100,cached:80,output:10},phases:{plan:20},root:'one'},
    {product:'current',caseId:'blog',status:'infrastructure-failed',firstPass:null,elapsedMs:null,usage:{input:200,cached:100,output:20},phases:{},root:'two'},
    {product:'legacy',caseId:'todo',status:'failed',firstPass:false,elapsedMs:2000,usage:null,phases:{},root:'three'},
  ];
  const report=compareProducts(rows);
  expect(report.groups[0]).toMatchObject({trials:2,allTrialPassRate:0.5,businessDenominator:1,correctedBusinessPassRate:1,missingTimes:1,usage:{input:300,cached:180,output:30}});
  expect(report.groups[1]).toMatchObject({passed:0,correctedBusinessPassRate:0,usage:null,missingUsage:1});
  expect(compareProducts([]).groups).toEqual([]);
  expect(report.rows).toBe(rows);
});
