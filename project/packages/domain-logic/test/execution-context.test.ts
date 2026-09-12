import { expect, test } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { projectTrackExecutionContext } from '../src';
import type { OwnedLifecycleSnapshot } from 'depa-codument-domain-contract';

test('execution context preserves the full contract without mutating authority or claiming semantic completion', () => {
  const root = parseXnl('<Track #example {status="new" gap_round=3} (<TaskSpace #TS (<SubNodes [<Task #T1 {status="NOT_STARTED"}>]>)><Schedule []><Hooks [<Extension {custom=true}>]>)>').nodes[0] as DataElementNode;
  const source: OwnedLifecycleSnapshot = {kind:'track',id:'example',stage:'pending',directory:'codument/tracks/pending/example',file:'codument/tracks/pending/example/track.xnl',sourceRevision:'instance-token',root};
  const before = structuredClone(source);
  const context = projectTrackExecutionContext(source);
  expect(context.ready.map(task => task.id)).toEqual(['T1']);
  expect(context.contract).toEqual(root);
  expect(context.contract).not.toBe(root);
  expect(context.limitations.join(' ')).toContain('not approval');
  expect(context.requiredSources).toContain('codument/config/');
  expect(context.attractors).toEqual({profilesObserved:false,references:[]});
  expect(source).toEqual(before);
  expect(projectTrackExecutionContext({...source, stage:'archived'}).ready).toEqual([]);
  source.root.attributes!.status = 'completed';
  expect(projectTrackExecutionContext(source).ready).toEqual([]);
  expect(() => projectTrackExecutionContext({...source,kind:'mission'})).toThrow('Track authority');
});

test('referenced coding standards are explicit before implementation without activating other profiles', () => {
  const root = parseXnl('<Track #example {status="new"} (<TaskSpace #TS (<SubNodes [<TaskGroup #G1 (<SubNodes [<Task #T1 (<Hooks [<Hook {on="task:before"} [<AttractorCheck {use="coding"}>]>]>)>]>)>]>)><Schedule []><Hooks [<Hook {on="track:after"} [<AttractorCheck {use="coding"}>]>]><Extension [<AttractorCheck {use="unrelated"}>]>)>').nodes[0] as DataElementNode;
  const source: OwnedLifecycleSnapshot = {kind:'track',id:'example',stage:'pending',directory:'codument/tracks/pending/example',file:'codument/tracks/pending/example/track.xnl',sourceRevision:'instance',root};
  const profiles = '<AttractorProfiles #profiles envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Profiles [<Profile #coding {enabled=true} (<Attractors [<Attractor {ref="skill://depa-codument/references/std/attractors/depa-attractor.md"}>]>)><Profile #unrelated {enabled=true} (<Attractors [<Attractor {ref="private-not-needed.md"}>]>)>]>)>';
  const context = projectTrackExecutionContext(source, profiles);
  expect(context.attractors.references.map(p => p.profile)).toEqual(['coding']);
  expect(context.requiredSources).toContain('skill://depa-codument/references/std/attractors/depa-attractor.md');
  expect(context.requiredSources).not.toContain('private-not-needed.md');
  expect(projectTrackExecutionContext(source, profiles.replace('#coding {enabled=true}', '#coding {enabled=false}')).requiredSources).not.toContain('skill://depa-codument/references/std/attractors/depa-attractor.md');
  expect(context.contract).toEqual(root);
});

test('formal descendant hooks beneath a Task are included without interpreting extension nodes', () => {
  const root = parseXnl('<Track #example {status="new"} (<TaskSpace #TS (<SubNodes [<Task #T1 (<SubNodes [<Task #T2 (<Hooks [<Hook {on="task:after"} [<AttractorCheck {use="nested"}>]>]>)>]>)>]>)><Schedule []><Hooks []>)>').nodes[0] as DataElementNode;
  const source: OwnedLifecycleSnapshot = {kind:'track',id:'example',stage:'pending',directory:'codument/tracks/pending/example',file:'codument/tracks/pending/example/track.xnl',sourceRevision:'instance',root};
  expect(projectTrackExecutionContext(source).attractors.references).toEqual([{profile:'nested',enabled:null,refs:[]}]);
});
