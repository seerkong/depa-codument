import type { DataElementNode, ElementNode } from 'xnl-core';
import { LIFECYCLE_ROOT_STATES, LIFECYCLE_TASK_STATES, type DomainValidationFinding, type LifecycleValidationContext } from 'depa-codument-domain-contract';
import { attr, children, descendants, first, id, present } from './validation-tree';
import { historicalCompletion } from './historical-completion';

type Report = (rule: string, message: string, severity?: 'error' | 'warning') => void;
const ACTOR_ROLES = ['MissionPlanner', 'MissionObserver', 'MissionReconciler', 'MissionApplier'];
const HOOK_POINTS = ['track:before', 'track:after', 'phase:before', 'phase:after', 'task:before', 'task:after'];
export const TRACK_MATERIAL_DOMAINS = ['code', 'test', 'docs', 'artifact', 'memory'] as const;

/** Semantic checks on an admitted current XNL tree, without conversion to XML,
 * source rewriting, filesystem discovery or implicit profile loading. Companion
 * files and cross-workspace graph checks are separate gates. */
export function validateLifecycleTree(root: DataElementNode, context: LifecycleValidationContext): DomainValidationFinding[] {
  const findings: DomainValidationFinding[] = [];
  const report: Report = (rule, message, severity = 'error') => {
    findings.push({ file: context.file, rule, message, severity: context.strict ? 'error' : severity });
  };
  if (root.tag !== 'Track' && root.tag !== 'Mission') {
    report('lifecycle.root', 'Lifecycle root must be <Track> or <Mission>.');
    return findings;
  }
  const kind = root.tag === 'Track' ? 'track' : 'mission';
  if (!id(root)) report(`${kind}.root.id`, `<${root.tag}> requires a stable ID.`);
  for (const field of ['status', 'goal', 'description', 'created_at', 'updated_at']) {
    if (!attr(root, field)?.trim()) report(`${kind}.root.${field.replaceAll('_', '-')}`, `<${root.tag}> 缺少非空 ${field} 根属性`);
  }
  enumField(root, 'status', LIFECYCLE_ROOT_STATES[kind], `${kind}.metadata.status`, report);
  enumField(root, 'question_mode', ['decision-tree'], `${kind}.root.question-mode`, report);
  enumField(root, 'question_severity', ['auto', 'light', 'normal', 'deep'], `${kind}.root.question-severity`, report);
  if (kind === 'track') enumField(root, 'commit_mode', ['auto', 'manual'], 'track.root.commit-mode', report);
  for (const field of ['created_at', 'updated_at']) {
    const value = attr(root, field);
    if (value && Number.isNaN(Date.parse(value))) report(`${kind}.root.${field.replaceAll('_', '-')}`, `<${root.tag}> ${field} 必须是 ISO 8601 时间`);
  }

  let historical = false;
  try { historical = historicalCompletion(root, context.file) !== undefined; }
  catch (cause) { report('track.history.provenance', String(cause)); }
  validateTaskSpace(root, kind, report, historical);
  validateSchedule(root, kind, report);
  validateHooks(root, kind, context, report);
  if (kind === 'track') validateTrackPorts(root, report);
  else validateMissionTopology(root, report);
  return findings;
}

function validateTaskSpace(root: DataElementNode, kind: 'track' | 'mission', report: Report, historical = false): void {
  const unchecked = (node: ElementNode) => node.tag === 'Criterion' && attr(node, 'checked') !== 'true'
    && !(historical && !present(node, 'checked'));
  const space = first(root, 'TaskSpace');
  if (!space) {
    report(`${kind}.taskspace.missing`, '缺少 <TaskSpace>');
    return;
  }
  if (!taskChildren(space).some((node) => node.tag === 'TaskGroup')) {
    report(`${kind}.taskspace.phase-missing`, '<TaskSpace> 第一层至少需要一个 <TaskGroup>');
  }
  const seen = new Set<string>();
  const tasks = descendants(space).filter(isTask);
  for (const node of tasks) {
    const identity = id(node);
    if (!identity) report(`${kind}.taskspace.id`, `<${node.tag}> 缺少 id`);
    else if (seen.has(identity)) report(`${kind}.taskspace.duplicate-id`, `节点 id 重复：${identity}`);
    else seen.add(identity);
    enumField(node, 'status', LIFECYCLE_TASK_STATES[kind], `${kind}.taskspace.status`, report);
    enumField(node, 'child_mode', ['sequential', 'dag'], `${kind}.taskspace.child-mode`, report);
    if (kind === 'track') {
      enumField(node, 'priority', ['P0', 'P1', 'P2'], 'track.task.priority', report);
      for (const field of ['blocker', 'commit']) {
        if (present(node, field) && !attr(node, field)?.trim()) report(`track.task.${field}`, `<${node.tag} #${identity}> ${field} 不得为空`);
      }
      const owned = first(node, node.tag === 'TaskGroup' ? 'Gate' : 'Acceptance');
      const pendingCriteria = owned ? descendants(owned).filter(unchecked) : [];
      if (attr(node, 'status') === 'DONE' && pendingCriteria.length) {
        report('track.lifecycle.done-criterion', `<${node.tag} #${identity}> DONE 但仍有未勾选 Criterion`, attr(root, 'status') === 'completed' ? 'error' : 'warning');
      }
    } else if (node.tag === 'TaskGroup' && children(node).some((child) => child.tag === 'MissionLink' || child.tag === 'TrackLink')) {
      report('mission.link.group', `<TaskGroup #${identity}> 不允许挂 MissionLink/TrackLink（只允许挂在叶子 Task 上）`);
    }
  }
  if (kind === 'track' && attr(root, 'status') === 'completed') {
    if (tasks.some((node) => !['DONE', 'ABANDONED'].includes(attr(node, 'status') ?? 'NOT_STARTED'))) {
      report('track.lifecycle.completed-tasks', 'completed Track 仍有未完成任务');
    }
    if (descendants(space).some(unchecked)) {
      report('track.lifecycle.completed-criteria', 'completed Track 仍有未勾选 Criterion');
    }
  }
}

function validateSchedule(root: DataElementNode, kind: string, report: Report): void {
  const schedule = first(root, 'Schedule');
  if (!schedule) return;
  if (kind === 'track') {
    integerField(schedule, 'max_concurrent', 1, 'track.schedule.max-concurrent', report);
    enumField(schedule, 'spot_check', ['true', 'false'], 'track.schedule.spot-check', report);
  }
  const space = first(root, 'TaskSpace');
  const owners = space ? [space, ...descendants(space).filter(isTask)] : [];
  const byId = new Map(owners.filter((node) => id(node)).map((node) => [id(node)!, node]));
  const dagOwners = new Set<string>();
  for (const dag of children(schedule).filter((node) => node.tag === 'Dag')) {
    const target = attr(dag, 'for');
    const owner = target ? byId.get(target) : undefined;
    if (!owner) {
      report(`${kind}.schedule.dag-target`, `<Dag for="${target}"> 引用了不存在的节点`);
      continue;
    }
    if (dagOwners.has(target!)) report(`${kind}.schedule.duplicate-dag`, `<Dag for="${target}"> 重复定义`);
    dagOwners.add(target!);
    if (attr(owner, 'child_mode') !== 'dag') report(`${kind}.schedule.dag-mode`, `<Dag for="${target}"> 的目标节点未声明 child_mode="dag"`);
    const layer = new Set(taskChildren(owner).map(id).filter((value): value is string => Boolean(value)));
    const predecessors = new Map<string, Set<string>>();
    for (const node of children(dag).filter((child) => child.tag === 'Node')) {
      const identity = id(node);
      if (!identity || !layer.has(identity)) {
        report(`${kind}.schedule.node-layer`, `<Dag for="${target}"><Node #${identity}> 不是该层的直接下层`);
        continue;
      }
      if (predecessors.has(identity)) report(`${kind}.schedule.duplicate-node`, `<Dag for="${target}"> 重复 Node #${identity}`);
      const afters = new Set<string>();
      for (const after of children(node).filter((child) => child.tag === 'After')) {
        const ref = attr(after, 'ref');
        if (!ref || !layer.has(ref)) report(`${kind}.schedule.after-layer`, `<Node #${identity}><After ref="${ref}"> 不是该层的直接下层`);
        if (ref) afters.add(ref);
      }
      predecessors.set(identity, afters);
    }
    // Nodes omitted from Schedule have no authored predecessors, matching the
    // existing per-layer model. Deduplicate edges before topological counting.
    const remaining = new Map([...layer].map((identity) => [identity, new Set([...(predecessors.get(identity) ?? [])].filter((ref) => layer.has(ref)))]));
    const ready = [...remaining].filter(([, edges]) => edges.size === 0).map(([identity]) => identity);
    while (ready.length) {
      const identity = ready.shift()!;
      if (!remaining.delete(identity)) continue;
      for (const [next, edges] of remaining) if (edges.delete(identity) && edges.size === 0) ready.push(next);
    }
    if (remaining.size > 0) {
      report(`${kind}.schedule.cycle`, `<Dag for="${target}"> 存在环（依赖不可拓扑排序）`);
    }
  }
}

function validateHooks(root: DataElementNode, kind: string, context: LifecycleValidationContext, report: Report): void {
  const all = descendants(root);
  for (const hook of all.filter((node) => node.tag === 'Hook')) {
    const allowed = kind === 'mission' ? [...HOOK_POINTS, 'mission:after-node'] : HOOK_POINTS;
    if (!allowed.includes(attr(hook, 'on') ?? '')) report(`${kind}.hook.on`, `<Hook on="${attr(hook, 'on')}"> 非法生命周期点`);
  }
  for (const check of all.filter((node) => node.tag === 'AttractorCheck')) {
    const use = attr(check, 'use');
    if (!use) report('attractor.use', '<AttractorCheck> 缺少 use 属性');
    else if (!context.profileNames) report('attractor.profiles-unavailable', `未提供 profile 来源，无法判断 AttractorCheck use="${use}"`, 'warning');
    else if (!context.profileNames.includes(use)) report('attractor.profile', `<AttractorCheck use="${use}"> 找不到对应 profile`);
  }
  for (const gap of all.filter((node) => node.tag === 'GapLoop')) {
    integerField(gap, 'max_rounds', 0, 'gap-loop.max-rounds', report);
    enumField(gap, 'on_exhausted', ['block', 'continue', 'fail'], 'gap-loop.on-exhausted-illegal', report);
    enumField(gap, 'verify_round', ['true', 'false'], 'gap-loop.verify-round', report);
  }
  if (kind === 'track') {
    const hasGap = (node: ElementNode, on: string): boolean => descendants(node).some((hook) => hook.tag === 'Hook'
      && attr(hook, 'on') === on && descendants(hook).some((child) => child.tag === 'GapLoop'));
    const hooks = first(root, 'Hooks');
    const space = first(root, 'TaskSpace');
    if (hooks && hasGap(hooks, 'track:after') && space && taskChildren(space).some((phase) => phase.tag === 'TaskGroup' && hasGap(phase, 'phase:after'))) {
      report('track.hook.gap-loop-duplicate', '同一 Track 不得同时配置 track:after GapLoop 与 phase:after GapLoop；默认只在 phase:after 执行');
    }
  }
  for (const reconcile of all.filter((node) => node.tag === 'MissionReconcile')) {
    integerField(reconcile, 'max_tracks', 1, 'mission.reconcile.max-tracks', report);
    enumField(reconcile, 'on_limit', ['checkpoint', 'continue', 'block'], 'mission.reconcile.on-limit', report);
    enumField(reconcile, 'on_drift', ['replan-or-block', 'replan', 'block'], 'mission.reconcile.on-drift', report);
  }
}

function validateTrackPorts(root: DataElementNode, report: Report): void {
  const ports = first(root, 'Ports');
  if (!ports) { report('track.ports.missing', '缺少 <Ports { scope = "track" }>'); return; }
  if (attr(ports, 'scope') !== 'track') report('track.ports.scope', '<Ports> scope 必须是 track');
  for (const bundle of children(ports).filter((node) => node.tag === 'MaterialBundle')) {
    if (!['input', 'output'].includes(attr(bundle, 'role') ?? '')) report('track.ports.role', '<MaterialBundle> role 非法（input|output）');
    if (!(TRACK_MATERIAL_DOMAINS as readonly string[]).includes(attr(bundle, 'domain') ?? '')) {
      report('track.ports.domain', `<MaterialBundle> domain 非法（${TRACK_MATERIAL_DOMAINS.join('|')}），Track 不接受 JSON 端口`);
    }
    if (!attr(bundle, 'name')) report('track.ports.name', '<MaterialBundle> 缺少 name');
    if (!attr(bundle, 'path')?.startsWith('vfs://')) report('track.ports.path', '<MaterialBundle> path 必须使用 vfs://');
  }
}

function validateMissionTopology(root: DataElementNode, report: Report): void {
  const all = descendants(root);
  for (const node of [root, ...all]) {
    for (const field of Object.keys(node.attributes ?? {})) {
      if (/^(?:workspace(?:-|_)?path|workspace)$/i.test(field) || (/^(path|archive[-_]path)$/i.test(field) && node.tag !== 'MaterialBundle')) {
        report('mission.authority.persisted-path', `<${node.tag}> must not persist ${field}; WorkspaceBinding is session runtime data`);
      }
    }
    if (node.tag === 'WorkspaceBinding') report('mission.authority.workspace-binding', 'WorkspaceBinding must not be persisted in Mission.');
  }
  if (all.filter((node) => node.tag === 'ParentMission').length > 1) report('mission.parent.single', 'Mission allows at most one ParentMission');
  for (const link of all.filter((node) => node.tag === 'MissionLink')) {
    if (!attr(link, 'project_ref')) report('mission.missionlink.project-ref', 'MissionLink requires project_ref');
    if (!attr(link, 'mission_ref') && !id(link)) report('mission.missionlink.mission-ref', 'MissionLink requires mission_ref');
    if (attr(link, 'completion_mode') !== 'selected-tasks') report('mission.missionlink.completion-mode', 'MissionLink requires completion_mode="selected-tasks"');
    for (const collection of children(link).filter((node) => node.tag === 'SelectedTasks')) {
      for (const task of children(collection).filter((node) => node.tag === 'TaskRef')) {
        if (!attr(task, 'ref') && !attr(task, 'task_ref')) report('mission.missionlink.selected-task-ref', 'SelectedTasks TaskRef requires ref');
      }
    }
  }
  for (const link of all.filter((node) => node.tag === 'TrackLink')) {
    if (!attr(link, 'project_ref')) report('mission.tracklink.project-ref', 'TrackLink requires project_ref');
    if (attr(link, 'track_ref') && !attr(link, 'mission_ref')) report('mission.tracklink.mission-ref', 'Cross-layer TrackLink requires mission_ref');
    if (attr(link, 'mission_ref') && !attr(link, 'track_ref')) report('mission.tracklink.track-ref', 'Cross-layer TrackLink requires track_ref');
  }

  const projects = first(root, 'ProjectRefs');
  const actors = first(root, 'ActorSets');
  if (!projects && !actors) { report('mission.actors.legacy', 'legacy mission has no ProjectRefs or ActorSets; materialize the default structure on plan/revise', 'warning'); return; }
  if (!projects) { report('mission.projects.missing', 'ActorSets require <ProjectRefs>'); return; }
  if (!actors) { report('mission.actors.missing', 'ProjectRefs require <ActorSets>'); return; }
  const projectIds = new Set<string>();
  let hosts = 0;
  for (const project of children(projects).filter((node) => node.tag === 'ProjectRef')) {
    const identity = id(project);
    if (!identity) { report('mission.project.id', '<ProjectRef> requires id'); continue; }
    if (projectIds.has(identity)) report('mission.project.duplicate-id', `ProjectRef id is duplicated: ${identity}`);
    projectIds.add(identity);
    if (!['host', 'external'].includes(attr(project, 'kind') ?? '')) report('mission.project.kind', `ProjectRef ${identity} requires kind="host" or kind="external"`);
    if (attr(project, 'kind') === 'host') hosts++;
  }
  if (!projectIds.size) report('mission.projects.empty', 'Mission requires at least one ProjectRef');
  if (hosts !== 1) report('mission.project.host', 'Mission requires exactly one host ProjectRef');
  const setIds = new Set<string>();
  for (const set of children(actors).filter((node) => node.tag === 'ActorSet')) {
    const identity = id(set);
    if (!identity) { report('mission.actor-set.id', '<ActorSet> requires id'); continue; }
    if (setIds.has(identity)) report('mission.actor-set.duplicate-id', `ActorSet id is duplicated: ${identity}`);
    setIds.add(identity);
    const counts = new Map<string, number>();
    for (const actor of children(set).filter((node) => node.tag === 'Actor')) {
      const role = attr(actor, 'role');
      if (!role || !ACTOR_ROLES.includes(role)) { report('mission.actor.role', `ActorSet ${identity} has unknown actor role: ${role ?? 'missing'}`); continue; }
      counts.set(role, (counts.get(role) ?? 0) + 1);
      if (!projectIds.has(attr(actor, 'project_ref') ?? '')) report('mission.actor.project-ref', `ActorSet ${identity} actor ${role} references unknown ProjectRef`);
      const description = first(actor, 'Description');
      if (description?.kind !== 'TextElement' || !description.text?.trim()) report('mission.actor.description', `ActorSet ${identity} actor ${role} requires a mission-specific <Description>`);
    }
    for (const role of ACTOR_ROLES) if (counts.get(role) !== 1) report('mission.actor.count', `ActorSet ${identity} must contain ${role} exactly once (received ${counts.get(role) ?? 0})`);
  }
  if (!setIds.has(attr(actors, 'default') ?? '')) report('mission.actor-set.default', 'ActorSets default references unknown ActorSet');
  for (const group of all.filter((node) => node.tag === 'TaskGroup')) {
    const override = attr(group, 'actor_set');
    if (override && !setIds.has(override)) report('mission.actor-set.override', `TaskGroup ${id(group)} actor_set references unknown ActorSet: ${override}`);
  }
  for (const link of all.filter((node) => node.tag === 'TrackLink' || node.tag === 'MissionLink')) {
    if (!projectIds.has(attr(link, 'project_ref') ?? '')) report('mission.link.project-ref', `${link.tag} ${id(link)} references unknown ProjectRef`);
  }
}

function isTask(node: ElementNode): boolean { return node.tag === 'Task' || node.tag === 'TaskGroup'; }
function taskChildren(node: ElementNode): ElementNode[] { return children(first(node, 'SubNodes') ?? node).filter(isTask); }
function enumField(node: ElementNode, field: string, values: readonly string[], rule: string, report: Report): void {
  if (present(node, field) && !values.includes(attr(node, field) ?? '')) report(rule, `<${node.tag}> ${field}="${attr(node, field)}" 非法（${values.join('|')}）`);
}
function integerField(node: ElementNode, field: string, minimum: number, rule: string, report: Report): void {
  if (!present(node, field)) return;
  const value = attr(node, field) ?? '';
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) report(rule, `<${node.tag}> ${field} 必须是大于等于 ${minimum} 的整数`);
}
