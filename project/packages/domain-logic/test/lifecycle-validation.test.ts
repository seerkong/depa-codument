import { describe, expect, it } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { createValidatedLifecycleSourceCodec, validateLifecycleTree } from '../src';

const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const fields = 'goal="Validate" description="Keep authored semantics" created_at="2026-09-05T12:00:00Z" updated_at="2026-09-05T12:00:00Z" question_mode="decision-tree" question_severity="auto"';
const track = `<Track #example ${envelope} {status="in_progress" ${fields} commit_mode="manual"} (
  <Ports {scope="track"} [<MaterialBundle {name="outputs" role="output" domain="docs" path="vfs://./docs/"}>]>
  <TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE" child_mode="dag"} (
    <SubNodes [<Task #T1 {status="DONE" priority="P1"} (<Acceptance [<Criterion #C1 {checked=true} ?>verified</?>]>)><Task #T2 {status="NOT_STARTED"}>]>
    <Hooks [<Hook {on="phase:after"} [<AttractorCheck {use="project"}><GapLoop {max_rounds=5 on_exhausted="block" verify_round=true}><HumanConfirm {scope="phase"}>]>]>
  )>]>)>
  <Schedule {max_concurrent=2 spot_check=true} [<Dag {for="G1"} [<Node #T2 [<After {ref="T1"}>]>]>]>
  <Hooks []>
)>`;
const actors = ['MissionPlanner', 'MissionObserver', 'MissionReconciler', 'MissionApplier'];
const mission = `<Mission #example ${envelope} {status="active" revision=1 ${fields}} (
  <ProjectRefs [<ProjectRef #host {kind="host"}><ProjectRef #library {kind="external"}>]>
  <ActorSets {default="loop"} [<ActorSet #loop [${actors.map((role) => `<Actor {role="${role}" project_ref="host"} (<Description ?>Work for ${role}.</?>)>`).join('')}]>]>
  <TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE" child_mode="dag" actor_set="loop"} (<SubNodes [
    <Task #T1 {status="ACTIVE"} (<TrackLink #current {state="bound" project_ref="host"}>)>
    <Task #T2 {status="NOT_STARTED"} (<MissionLink #child {project_ref="library" completion_mode="selected-tasks"} (<SelectedTasks [<TaskRef {ref="child-task"}>]> )>)>
  ]>)>]>)>
  <Schedule [<Dag {for="G1"} [<Node #T2 [<After {ref="T1"}>]>]>]>
  <Hooks [<Hook {on="mission:after-node"} (<MissionReconcile {max_tracks=10 on_limit="checkpoint" on_drift="replan-or-block"}>)>]>
)>`;
function tree(source: string): DataElementNode {
  const parsed = parseXnl(source, { textBlockStyle: true });
  if (parsed.warnings?.length) throw new Error('Ambiguous test fixture');
  return parsed.nodes[0] as DataElementNode;
}
function findings(source: string, strict = false) { return validateLifecycleTree(tree(source), { file: 'owned/resource.xnl', profileNames: ['project'], strict }); }
function rules(source: string) { return findings(source).map((finding) => finding.rule); }

describe('pure Track and Mission semantic validation', () => {
  it('accepts nonempty canonical trees, preserves source AST and keeps XML out of normal validation', () => {
    expect(findings(track)).toEqual([]);
    expect(findings(mission)).toEqual([]);
    const input = tree(track);
    const original = structuredClone(input);
    validateLifecycleTree(input, { file: 'track.xnl', profileNames: ['project'] });
    expect(input).toEqual(original);
    expect(findings(track.replace('commit_mode="manual"', 'commit_mode="manual" future={opaque=[1 true "keep"]}'))).toEqual([]);
  });

  it('keeps required root fields, timestamp and option vocabulary checks', () => {
    for (const [source, kind] of [[track, 'track'], [mission, 'mission']]) {
      for (const field of ['goal', 'description', 'created_at', 'updated_at']) {
        expect(rules(source.replace(new RegExp(field + '="[^"]*"'), field + '=""'))).toContain(`${kind}.root.${field.replaceAll('_', '-')}`);
      }
      expect(rules(source.replace('question_mode="decision-tree"', 'question_mode="bogus"'))).toContain(`${kind}.root.question-mode`);
      expect(rules(source.replace('question_severity="auto"', 'question_severity="bogus"'))).toContain(`${kind}.root.question-severity`);
      expect(rules(source.replace('created_at="2026-09-05T12:00:00Z"', 'created_at="not-a-date"'))).toContain(`${kind}.root.created-at`);
    }
    expect(rules(track.replace('commit_mode="manual"', 'commit_mode="bogus"'))).toContain('track.root.commit-mode');
  });

  it('composes structural and semantic admission without hidden profile discovery or mutable bindings', () => {
    const context = { file: 'track.xnl', profileNames: ['project'], strict: true };
    const codec = createValidatedLifecycleSourceCodec(context);
    context.profileNames.length = 0;
    expect(codec.inspect(track, 'track').id).toBe('example');
    expect(() => codec.inspect(track.replace('on_exhausted="block"', 'on_exhausted="ignore"'), 'track')).toThrow('gap-loop.on-exhausted-illegal');
    expect(() => codec.inspect(track.replace(envelope, 'apiVersion="old" version="1"'), 'track')).toThrow('migration');
    const noProfiles = createValidatedLifecycleSourceCodec({ file: 'track.xnl', strict: true });
    expect(() => noProfiles.inspect(track, 'track')).toThrow('attractor.profiles-unavailable');
  });

  it('retains task vocabularies, identity, priority, blocker and commit constraints', () => {
    expect(rules(track.replace('status="NOT_STARTED"', 'status="BLOCKED"'))).toContain('track.taskspace.status');
    expect(rules(mission.replace('status="NOT_STARTED"', 'status="DELEGATED"'))).toContain('mission.taskspace.status');
    expect(rules(track.replace('<Task #T2 ', '<Task #T1 '))).toContain('track.taskspace.duplicate-id');
    expect(rules(track.replace('<Task #T2 ', '<Task '))).toContain('track.taskspace.id');
    expect(rules(track.replace('priority="P1"', 'priority="P9" blocker="" commit=""'))).toEqual(expect.arrayContaining(['track.task.priority', 'track.task.blocker', 'track.task.commit']));
    expect(rules(track.replace('child_mode="dag"', 'child_mode="parallel"'))).toContain('track.taskspace.child-mode');
  });

  it('does not equate DONE with verified owned criteria and retains strict severity promotion', () => {
    const unfinished = track.replace('checked=true', 'checked=false');
    const ordinary = findings(unfinished);
    expect(ordinary.find((finding) => finding.rule === 'track.lifecycle.done-criterion')?.severity).toBe('warning');
    expect(findings(unfinished, true).find((finding) => finding.rule === 'track.lifecycle.done-criterion')?.severity).toBe('error');
    expect(rules(unfinished.replace('status="in_progress"', 'status="completed"'))).toEqual(expect.arrayContaining(['track.lifecycle.completed-tasks', 'track.lifecycle.completed-criteria']));
    expect(ordinary[0].file).toBe('owned/resource.xnl');
  });

  it('validates per-layer DAG targets, references, duplicate declarations and real cycles', () => {
    for (const [source, kind] of [[track, 'track'], [mission, 'mission']]) {
      expect(rules(source.replace('for="G1"', 'for="missing"'))).toContain(`${kind}.schedule.dag-target`);
      expect(rules(source.replace('child_mode="dag"', 'child_mode="sequential"'))).toContain(`${kind}.schedule.dag-mode`);
      expect(rules(source.replace('<Node #T2', '<Node #missing'))).toContain(`${kind}.schedule.node-layer`);
      const missing = rules(source.replace('ref="T1"', 'ref="missing"'));
      expect(missing).toContain(`${kind}.schedule.after-layer`);
      expect(missing).not.toContain(`${kind}.schedule.cycle`);
      expect(rules(source.replace('<Node #T2 [<After {ref="T1"}>]>', '<Node #T2 [<After {ref="T1"}>]><Node #T1 [<After {ref="T2"}>]>'))).toContain(`${kind}.schedule.cycle`);
      expect(rules(source.replace('<Node #T2 [<After {ref="T1"}>]>', '<Node #T2><Node #T2>'))).toContain(`${kind}.schedule.duplicate-node`);
    }
    expect(rules(track.replace('max_concurrent=2 spot_check=true', 'max_concurrent=0 spot_check="sometimes"'))).toEqual(expect.arrayContaining(['track.schedule.max-concurrent', 'track.schedule.spot-check']));
  });

  it('preserves GapLoop limits, exhaustion and verification controls and rejects duplicated phase/root loops', () => {
    expect(rules(track.replace('max_rounds=5', 'max_rounds=-1'))).toContain('gap-loop.max-rounds');
    expect(rules(track.replace('on_exhausted="block"', 'on_exhausted="ignore"'))).toContain('gap-loop.on-exhausted-illegal');
    expect(rules(track.replace('verify_round=true', 'verify_round="sometimes"'))).toContain('gap-loop.verify-round');
    for (const on of ['block', 'continue', 'fail']) expect(findings(track.replace('on_exhausted="block"', `on_exhausted="${on}"`))).toEqual([]);
    expect(rules(track.replace('<Hooks []>', '<Hooks [<Hook {on="track:after"} [<GapLoop {max_rounds=5}>]>]>'))).toContain('track.hook.gap-loop-duplicate');
    expect(rules(track.replace('on="phase:after"', 'on="mission:after-node"'))).toContain('track.hook.on');
  });

  it('requires observed Attractor profiles rather than silently claiming unobserved profiles are valid', () => {
    expect(rules(track.replace('use="project"', 'use="missing"'))).toContain('attractor.profile');
    expect(rules(track.replace('use="project"', ''))).toContain('attractor.use');
    const unavailable = validateLifecycleTree(tree(track), { file: 'track.xnl' });
    expect(unavailable.find((finding) => finding.rule === 'attractor.profiles-unavailable')?.severity).toBe('warning');
    expect(validateLifecycleTree(tree(track), { file: 'track.xnl', strict: true }).find((finding) => finding.rule === 'attractor.profiles-unavailable')?.severity).toBe('error');
  });

  it('retains material port and MissionReconcile policies', () => {
    expect(rules(track.replace('scope="track"', 'scope="mission"'))).toContain('track.ports.scope');
    const illegalPort = findings(track.replace('role="output" domain="docs" path="vfs://./docs/"', 'role="both" domain="json" path="/absolute"'));
    expect(illegalPort.map((finding) => finding.rule)).toEqual(expect.arrayContaining(['track.ports.role', 'track.ports.domain', 'track.ports.path']));
    expect(illegalPort.find((finding) => finding.rule === 'track.ports.domain')?.message).toBe(
      '<MaterialBundle> domain 非法（code|test|docs|artifact|memory），Track 不接受 JSON 端口',
    );
    expect(rules(mission.replace('max_tracks=10 on_limit="checkpoint" on_drift="replan-or-block"', 'max_tracks=0 on_limit="forget" on_drift="ignore"'))).toEqual(expect.arrayContaining(['mission.reconcile.max-tracks', 'mission.reconcile.on-limit', 'mission.reconcile.on-drift']));
  });

  it('keeps the four-role actor closure and explicit ProjectRef/ActorSet identities', () => {
    expect(rules(mission.replace('role="MissionApplier"', 'role="MissionPlanner"'))).toContain('mission.actor.count');
    expect(rules(mission.replace('role="MissionObserver"', 'role="Unknown"'))).toContain('mission.actor.role');
    expect(rules(mission.replace('Work for MissionPlanner.', ''))).toContain('mission.actor.description');
    expect(rules(mission.replace('project_ref="host"', 'project_ref="missing"'))).toContain('mission.actor.project-ref');
    expect(rules(mission.replace('kind="external"', 'kind="host"'))).toContain('mission.project.host');
    expect(rules(mission.replace('default="loop"', 'default="missing"'))).toContain('mission.actor-set.default');
    expect(rules(mission.replace('actor_set="loop"', 'actor_set="missing"'))).toContain('mission.actor-set.override');
  });

  it('keeps nested links logical and rejects persisted workspace paths and incomplete cross-layer references', () => {
    expect(rules(mission.replace('state="bound" project_ref="host"', 'state="bound" project_ref="host" mission_ref="other"'))).toContain('mission.tracklink.track-ref');
    expect(rules(mission.replace('state="bound" project_ref="host"', 'state="bound" project_ref="host" track_ref="other"'))).toContain('mission.tracklink.mission-ref');
    expect(rules(mission.replace('completion_mode="selected-tasks"', 'completion_mode="whole-mission"'))).toContain('mission.missionlink.completion-mode');
    expect(rules(mission.replace('ref="child-task"', ''))).toContain('mission.missionlink.selected-task-ref');
    expect(rules(mission.replace('revision=1', 'revision=1 workspace_path="/local/worktree"'))).toContain('mission.authority.persisted-path');
    expect(rules(mission.replace('<Hooks [', '<WorkspaceBinding {workspace="/private"}><Hooks ['))).toContain('mission.authority.workspace-binding');
    expect(rules(mission.replace('project_ref="library"', 'project_ref="missing"'))).toContain('mission.link.project-ref');
    expect(rules(mission.replace('<Task #T1', '<TaskGroup #T1'))).toContain('mission.link.group');
  });
});
