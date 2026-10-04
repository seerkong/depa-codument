import {expect,test} from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {resourceIdentity,resourceRoot,trackValidationSelection,exhaustedGapReason} from './resource-oracle';
import {observePlannedIdentities,reconcilePlannedIdentities} from './handoff';
import {assertTrackWorkflowPolicy,WORKFLOW_POLICY} from './workflow-policy';

const legacy='<Track #example apiVersion="codument.tech/v1alpha1" version="1" {status="new" commit_mode="manual"} (<TaskSpace #TS (<SubNodes [<TaskGroup #phase {order=1} (<SubNodes [<Task #leaf {status="NOT_STARTED"}>]>)>]>)><Hooks []>)>';

test('legacy syntax adapter retains all shared policy/identity checks without requiring current migration',()=>{
  expect(resourceRoot(legacy,'track','legacy').attributes?.status).toBe('new');
  expect(trackValidationSelection('codument/tracks/pending/example',legacy,'legacy').selector).toBe('example');
  expect(()=>assertTrackWorkflowPolicy(legacy,WORKFLOW_POLICY,'legacy')).not.toThrow();
  expect(()=>resourceRoot(legacy,'track')).toThrow('migration');
  expect(()=>resourceIdentity(legacy.replace('codument.tech/v1alpha1','wrong/v1'),'track','legacy')).toThrow();
  expect(()=>resourceIdentity(legacy.replace('version="1"','version="2"'),'track','legacy')).toThrow();
  expect(()=>resourceIdentity(legacy.replace('version="1"','version="1" envelopeVersion="halfcode.resource-envelope/v1"'),'track','legacy')).toThrow();
  expect(()=>resourceIdentity(legacy+legacy,'track','legacy')).toThrow();
  expect(()=>resourceIdentity(legacy.replace('#example',''),'track','legacy')).toThrow();
  expect(()=>trackValidationSelection('codument/tracks/pending/other',legacy,'legacy')).toThrow();
  expect(()=>assertTrackWorkflowPolicy(legacy.replace('commit_mode="manual"','commit_mode="auto"'),WORKFLOW_POLICY,'legacy')).toThrow();
  const gap=legacy.replace('status="new"','status="in_progress" gap_round=2').replace('<Hooks []>','<Hooks (<Hook #h {on="track:after"} (<GapLoop {max_rounds=2 on_exhausted="block"}>)>)>');
  expect(exhaustedGapReason(gap,'track',['## Verdict\nFIX_APPLIED'],'legacy')).toContain('No automatic outer retry');
  expect(exhaustedGapReason(gap,'track',['## Verdict\nNO_GAP'],'legacy')).toBeUndefined();
});

test('actual legacy planning handoff admits old authority and still rejects replacement',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'depa-legacy-handoff-'));
  try {
    const folder=path.join(root,'codument/tracks/pending/example');
    fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(path.join(folder,'track.xnl'),legacy);
    const planned=observePlannedIdentities(root,[root],'legacy');
    expect(planned[0]!.id).toBe('example');
    expect(()=>observePlannedIdentities(root,[root])).toThrow('migration');
    expect(()=>reconcilePlannedIdentities(planned,[{...planned[0]!,id:'replacement'}])).toThrow();
    fs.writeFileSync(path.join(folder,'track.xnl'),legacy.replace('status="new"','status="completed"'));
    expect(()=>reconcilePlannedIdentities(planned,observePlannedIdentities(root,[root],'legacy'))).not.toThrow();
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
