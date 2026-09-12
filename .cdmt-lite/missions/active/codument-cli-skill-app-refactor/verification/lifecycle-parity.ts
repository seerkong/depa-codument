/** Read-only differential check against the frozen product implementation.
 * This verification artifact is not a dependency of any new public package. */
import * as path from 'node:path';

const root = path.resolve(import.meta.dir, '../../../../..');
const { parseMissionResourceContent } = await import(path.join(root, 'src/cli/mission/resource.ts'));
const { validateMissionNode } = await import(path.join(root, 'src/cli/mission/validate.ts'));
const { validateLifecycleTree, indexXnlRegistry } = await import(path.join(root, 'project/packages/domain-logic/src/index.ts'));
const test = await Bun.file(path.join(root, 'test/cli/commands/validate.test.ts')).text();
const marker = 'const GOOD_XNL_MISSION = `';
const start = test.indexOf(marker);
if (start < 0) throw new Error('Baseline Mission fixture disappeared.');
const offset = start + marker.length;
const source = test.slice(offset, test.indexOf('`', offset));
const changes = [
  ['baseline', '', ''],
  ['status', 'status = "active"', 'status = "bogus"'],
  ['goal', 'goal = "Validate canonical Mission XNL"', 'goal = ""'],
  ['description', 'description = "Exercise Mission XNL validation"', 'description = ""'],
  ['timestamp', '2026-08-15T10:00:00Z', 'not-time'],
  ['severity', 'question_severity = "auto"', 'question_severity = "bogus"'],
  ['task-status', 'status = "NOT_STARTED"', 'status = "DELEGATED"'],
  ['actor-role', 'role = "MissionPlanner"', 'role = "Other"'],
  ['actor-description', '>Plan.</', '> </'],
  ['project', 'project_ref = "host"', 'project_ref = "missing"'],
  ['host', 'kind = "host"', 'kind = "external"'],
  ['actor-default', 'default = "default-loop"', 'default = "missing"'],
  ['hook', 'on = "mission:after-node"', 'on = "bogus"'],
  ['max-tracks', 'max_tracks = 10', 'max_tracks = 0'],
  ['on-limit', 'on_limit = "checkpoint"', 'on_limit = "bogus"'],
  ['on-drift', 'on_drift = "replan-or-block"', 'on_drift = "bogus"'],
  ['path', 'revision = 1', 'revision = 1 workspace_path = "/local"'],
];
const results = changes.map(([name, from, to]) => {
  const content = from ? source.replace(from, to) : source;
  if (from && content === source) throw new Error('Unused baseline mutation: ' + name);
  const before = validateMissionNode(parseMissionResourceContent(content), { currentXnl: true }).some((finding: { severity: string }) => finding.severity === 'error');
  const index = indexXnlRegistry(new Map([['mission.xnl', content]]), { registryName: 'Mission' });
  if (!index.ready) throw new Error('Fixture no longer parses: ' + name);
  const after = validateLifecycleTree(index.files.get('mission.xnl')![0], { file: 'mission.xnl', profileNames: [] }).some((finding: { severity: string }) => finding.severity === 'error');
  if (before !== after) throw new Error(`Parity failed ${name}: ${before} != ${after}`);
  return { name, error: after };
});
console.log(JSON.stringify({ source: 'existing 0.5 canonical Mission fixture', cases: results }));
