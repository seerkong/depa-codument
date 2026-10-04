import {expect,test} from 'bun:test';
import {runAcceptanceProtocol} from './acceptance-protocol';
import {AcceptanceProtocolError} from './acceptance-scenario';
const original={status:'failed',findings:['Semantic defect'],findingEvidence:[]};
test('one format repair reuses frozen observations and preserves business verdict',async()=>{
  let proposal:any=structuredClone(original),repairs=0,observations=0;
  const trace={native:'unchanged'},events:unknown[]=[];
  const result=await runAcceptanceProtocol({observe:()=>{observations++;return trace;},readProposal:()=>proposal,
    admit:(p:any,t)=>{expect(t).toBe(trace);if(!p.findingEvidence.length)throw new AcceptanceProtocolError('missing observationId');return p;},
    repair:async()=>{repairs++;proposal={...proposal,findingEvidence:[{finding:'Semantic defect',observationId:'native-id'}]};},record:v=>events.push(v)});
  expect(result.proposal).toMatchObject({status:'failed'});expect(observations).toBe(1);expect(repairs).toBe(1);expect(events).toHaveLength(2);
});
test('invalid correction never starts another round or changes verdict/expectations',async()=>{
  for(const changeVerdict of [false,true]){
    let proposal:any=structuredClone(original),repairs=0;
    await expect(runAcceptanceProtocol({observe:()=>[],readProposal:()=>proposal,admit:()=>{throw new AcceptanceProtocolError('invalid');},repair:async()=>{repairs++;if(changeVerdict)proposal={status:'passed',findings:[]};},record:()=>{}})).rejects.toThrow();
    expect(repairs).toBe(1);
  }
});
test('scope ambiguity and real infrastructure errors do not invoke protocol repair',async()=>{
  for(const failure of [new AcceptanceProtocolError('API-only cannot demand UI','scope-unresolved'),new Error('native control lost')]){
    let repairs=0;
    await expect(runAcceptanceProtocol({observe:()=>[],readProposal:()=>original,admit:()=>{throw failure;},repair:async()=>{repairs++;},record:()=>{}})).rejects.toThrow();
    expect(repairs).toBe(0);
  }
});
test('existing canonical requirement references cannot change during format repair',async()=>{
  let proposal:any={status:'passed',findings:[],actions:[{coverage:'Same tested claim',requirementId:'ui-1',url:'same',target:'same',expected:'same'}]};
  await expect(runAcceptanceProtocol({observe:()=>[],readProposal:()=>proposal,admit:()=>{throw new AcceptanceProtocolError('missing evidence');},record:()=>{},repair:async()=>{proposal={...proposal,actions:[{...proposal.actions[0],requirementId:'different-ui'}]};}})).rejects.toThrow('existing canonical requirement');
});
