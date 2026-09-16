import { TRACK_MATERIAL_DOMAINS } from './lifecycle-validation';

export const KIND_SCHEMA_KINDS = ['track', 'mission', 'decision'] as const;
export type KindSchemaKind = (typeof KIND_SCHEMA_KINDS)[number];

const USAGE = `codument schema <${KIND_SCHEMA_KINDS.join('|')}>`;

export function parseKindSchemaKind(value: string): KindSchemaKind {
  if ((KIND_SCHEMA_KINDS as readonly string[]).includes(value)) return value as KindSchemaKind;
  throw new Error(`Usage: ${USAGE}`);
}

const DOMAINS = TRACK_MATERIAL_DOMAINS.join('|');

const TRACK = `<!-- kind: track -->
<!-- CLI 维护：#id envelopeVersion specVersion created_at updated_at gap_round。不要从本输出复制 identity。 -->
<!-- slot:root -->
<Track #id envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
  status = "new"
  goal = "..."
  description = "..."
  question_mode = "decision-tree"
  question_severity = "auto"
  commit_mode = "manual"
} (
  <Ports { scope = "track" } []>
  <TaskSpace #space_id { name = "id" version = "1" child_mode = "sequential" } (
    <SubNodes []>
  )>
  <Schedule []>
  <Hooks []>
)>

<!-- slot:MaterialBundle domain=${DOMAINS} role=input|output -->
<MaterialBundle #code {
  role = "input"
  name = "code"
  domain = "code"
  path = "vfs://@/src/"
}>

<!-- slot:TaskGroup -->
<TaskGroup #P1 { name = "实现" status = "NOT_STARTED" priority = "P0" order = 0 } (
  <Description ?>阶段说明。</?>
  <SubNodes [
    <Task #P1-T1 { name = "任务" status = "NOT_STARTED" priority = "P0" order = 0 } (
      <Acceptance [
        <Criterion #P1-T1-AC1 { checked = false } ?>可观察验收。</?>
      ]>
    )>
  ]>
)>

<!-- slot:Schedule -->
<Schedule { max_concurrent = 3 spot_check = true } [
  <Dag { for = "P1" } [
    <Node #P1-T3 [
      <After { ref = "P1-T1" }>
      <After { ref = "P1-T2" }>
    ]>
  ]>
]>

<!-- slot:Hook -->
<Hooks [
  <Hook { on = "phase:after" } (
    <GapLoop { max_rounds = 5 on_exhausted = "block" verify_round = false }>
  )>
  <Hook { on = "phase:after" } (
    <HumanConfirm>
  )>
  <Hook { on = "phase:after" } (
    <AttractorCheck { use = "coding" }>
  )>
]>
`;

const MISSION = `<!-- kind: mission -->
<!-- CLI 维护：#id envelopeVersion specVersion created_at updated_at revision gap_round。不要从本输出复制 identity。 -->
<!-- slot:root -->
<Mission #id envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
  status = "pending"
  goal = "..."
  description = "..."
  question_mode = "decision-tree"
  question_severity = "auto"
  revision = 1
} (
  <Ports { scope = "mission" } []>
  <ProjectRefs [
    <ProjectRef #host { kind = "host" }>
  ]>
  <ActorSets { default = "default-loop" } []>
  <TaskSpace #space_id { name = "id" version = "1" child_mode = "dag" } (
    <SubNodes []>
  )>
  <Schedule []>
  <Hooks []>
)>

<!-- slot:ActorSet -->
<ActorSet #default-loop [
  <Actor { role = "MissionPlanner" project_ref = "host" } (<Description ?>规划下一条可验证 Track。</?>)>
  <Actor { role = "MissionObserver" project_ref = "host" } (<Description ?>读取代码、资源和验证证据。</?>)>
  <Actor { role = "MissionReconciler" project_ref = "host" } (<Description ?>比较 desired 与 actual state。</?>)>
  <Actor { role = "MissionApplier" project_ref = "host" } (<Description ?>实现并验证 ready operation。</?>)>
]>

<!-- slot:TrackLink -->
<Task #G1-T1 { name = "落地一条 Track" status = "NOT_STARTED" order = 0 } (
  <TrackLink #add-example { state = "candidate" project_ref = "host" }>
)>

<!-- slot:MissionLink -->
<Task #G2-T1 { name = "编排子 Mission" status = "NOT_STARTED" } (
  <MissionLink #child {
    state = "bound"
    project_ref = "host"
    mission_ref = "child"
    completion_mode = "selected-tasks"
  } (
    <SelectedTasks [
      <TaskRef { ref = "A-G1-T1" }>
    ]>
  )>
)>

<!-- slot:Hook -->
<Hooks [
  <Hook { on = "mission:after-node" } (
    <MissionReconcile { max_tracks = 10 on_limit = "checkpoint" on_drift = "replan-or-block" }>
  )>
]>
`;

const DECISION = `<!-- kind: decision -->
<!-- CLI 维护：envelopeVersion specVersion。#id 由 decisions create 写入，不要从本输出复制。 -->
<!-- slot:pending -->
<decision #track.example.root envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
  status = "pending"
  priority = "P0"
  blocks = ["design.md"]
}
(
  <question ?>需要决定的问题是什么？</?>
  <recommendation ?>当前建议是什么？</?>
  <options { } [
    <option { key = "A" recommended = true }
    (
      <title ?>选项 A</?>
      <description ?>选项 A 的说明。</?>
      <tradeoff ?>选项 A 的代价。</?>
    )
    >
    <option { key = "B" }
    (
      <title ?>选项 B</?>
      <description ?>选项 B 的说明。</?>
      <tradeoff ?>选项 B 的代价。</?>
    )
    >
  ]>
  <answer { }
  (
    <raw-answer ?>待确认。</?>
    <decision-text ?>待确认。</?>
    <rationale ?>待补充。</?>
    <evidence ?>依据。</?>
  )
  >
)
[
  <decision #track.example.child {
    status = "pending"
    priority = "P1"
  }
  (
    <question ?>依赖父问题的细化？</?>
  )
  >
]>

<!-- slot:accepted -->
<decision #track.example.accepted envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
  priority = "P0"
  status = "accepted"
  blocks = ["track.xnl"]
}
(
  <question ?>已经决定的问题？</?>
  <answer { }
  (
    <raw-answer ?>是。</?>
    <decision-text ?>整理后的结论。</?>
    <rationale ?>理由。</?>
    <evidence ?>证据。</?>
  )
  >
)
>
`;

const SCHEMAS: Record<KindSchemaKind, string> = {
  track: TRACK,
  mission: MISSION,
  decision: DECISION,
};

export function renderKindSchema(kind: KindSchemaKind): string {
  return SCHEMAS[kind].trimEnd() + '\n';
}
