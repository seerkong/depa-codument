import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Only observe immutable trial evidence; never execute or repair delivery code.
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const optional = (file: string) => fs.existsSync(file) ? read(file) : null;
const batches = process.argv.slice(2).map(file => fs.realpathSync(file));
assert.equal(batches.length, 2, 'Current interrupted batch and formal legacy batch required');
for (const batch of batches) assert.match(batch, /^\/(private\/)?tmp\/depa-codument-e2e-batch-[^/]+$/);
const [before, after] = batches.map(batch => read(path.join(batch, 'suite-status.json')));
const interrupted = read(path.join(batches[0]!, 'interruption-observation.json'));
assert.equal(interrupted.driverDead, true);
assert.equal(interrupted.protectedUnchanged, true);
assert.ok(['completed', 'interrupted'].includes(after.status), 'Legacy batch is still live');
for (const state of [before, after]) {
  let live = false;
  try { process.kill(state.pid, 0); live = true; } catch { /* controller exited */ }
  assert.equal(live, false, 'A driver remains live');
}
assert.deepEqual(before.requirementHashes, after.requirementHashes, 'Business input changed');
assert.deepEqual(before.candidates, after.candidates, 'Candidate binaries changed');
assert.deepEqual(before.protectedBefore, after.protectedBefore, 'Original/global baseline changed');
const runtime = await import(path.join(after.project, 'e2e/runtime.ts'));
const { summarize } = await import(path.join(after.project, 'e2e/report.ts'));
const { compareProducts } = await import(path.join(after.project, 'e2e/comparison.ts'));
for (const state of [before, after]) {
  assert.equal(runtime.treeHash(path.join(state.project, 'e2e')), state.harnessSha256, 'Frozen harness drift');
  for (const candidate of Object.values(state.candidates) as any[]) assert.equal(runtime.sha(candidate.bin), candidate.sha256);
}
const protectedAfter = Object.fromEntries(Object.keys(before.protectedBefore).map(file => {
  if (!fs.existsSync(file)) return [file, null];
  const target = fs.realpathSync(file), stat = fs.statSync(target);
  return [file, { target, mode: stat.mode, sha256: stat.isDirectory() ? runtime.treeHash(target) : runtime.sha(target) }];
}));
assert.deepEqual(protectedAfter, before.protectedBefore, 'Original/global protection drift');
const cases = ['todo', 'stream-pipeline-ai-agent', 'blog', 'ecommerce', 'nested-mission-agent'];
const trials = [...before.rows.filter((row: any) => row.product === 'current'), ...after.rows];
assert.equal(new Set(trials.map((row: any) => `${row.product}/${row.caseId}`)).size, trials.length);
const formalReport = summarize(trials.filter((row: any) => row.root).map((row: any) => row.root));
const pilot = interrupted.pilot;
assert.equal(optional(path.join(pilot.root, 'classification.json'))?.status, 'harness-invalid');
const pilotReport = summarize([pilot.root]).runs[0];
const closedEndpoints: string[] = [];
const closedUiOrigins: string[] = [];
const contexts: any[] = [];
const installedSkills: any[] = [];
let policy: unknown;
const rows: any[] = [];
for (const product of ['current', 'legacy']) for (const caseId of cases) {
  const trial = trials.find((row: any) => row.product === product && row.caseId === caseId);
  if (!trial) { rows.push({ product, caseId, status: 'not-run', root: null, firstPass: null, elapsedMs: null, usage: null, phases: {} }); continue; }
  assert.notEqual(trial.state, 'running');
  const root = trial.root;
  runtime.assertTemporary(root);
  const provenance = read(path.join(root, 'provenance.json'));
  assert.equal(provenance.product, product);
  assert.equal(provenance.sha256, before.candidates[product].sha256);
  const state = product === 'current' ? before : after;
  assert.equal(provenance.harnessSha256, state.harnessSha256);
  const installation = read(path.join(root, 'installation.json'));
  for (const skill of installation.skills ?? [installation]) {
    assert.ok(skill.skill.startsWith(root + '/'), 'Installed Skill outside trial');
    assert.equal(runtime.treeHash(skill.skill), skill.hash, 'Installed Skill drift');
    installedSkills.push({ product, caseId, ...skill });
  }
  const requirements = read(path.join(root, 'requirements.json'));
  const counterpart = path.join(state.project, 'e2e/cases', caseId);
  for (const [name, digest] of Object.entries(requirements)) {
    assert.equal(runtime.sha(path.join(root, 'workspace', name)), digest, 'Delivered requirements changed');
    assert.equal(runtime.sha(path.join(counterpart, name)), digest, 'Frozen requirements changed');
  }
  const currentPolicy = read(path.join(root, 'workflow-policy.json'));
  if (policy === undefined) policy = currentPolicy;
  assert.deepEqual(currentPolicy, policy, 'Trial workflow-policy mismatch');
  const result = optional(path.join(root, 'result.json'));
  const projection = formalReport.runs.find((row: any) => row.root === root);
  assert.ok(projection);
  const receipts = fs.readdirSync(root).filter(name => /^ui-receipt-\d+\.json$/.test(name)).map(name => read(path.join(root, name)));
  // Observable native FileChange deletions are diagnostic evidence, not an
  // exhaustive filesystem audit or a reason to rewrite the official verdict.
  const observedNativeFileDeletions = fs.readdirSync(path.join(root, 'logs')).filter(name => /^implementation-\d+\.jsonl$/.test(name)).flatMap(name =>
    fs.readFileSync(path.join(root, 'logs', name), 'utf8').split('\n').flatMap(line => {
      let event;
      try { event = JSON.parse(line); } catch { return []; }
      if (event.type !== 'item.completed' || event.item?.type !== 'file_change') return [];
      const changes = event.item.changes ?? [];
      return changes.filter((change: any) => change.kind === 'delete').map((change: any) => ({ log: name, file: change.path,
        existsAtFinalObservation: fs.existsSync(change.path),
        sameEventIncludesReadd: changes.some((other: any) => other.path === change.path && other.kind === 'add') }));
    }));
  rows.push({ ...projection, elapsedMs: trial.wallMs ?? null, runnerElapsedMs: result?.elapsedMs ?? null,
    attempts: result?.attempts ?? optional(path.join(root, 'progress.json'))?.attempts ?? null,
    error: result?.error ?? null, failureClass: result?.failureClass ?? null,
    uiReceipts: receipts, observedNativeFileDeletions, sourceHarnessSha256: state.harnessSha256 });
}
// Include interrupted pilot in lifecycle/model audit and cost, not formal rates.
for (const root of [...trials.map((row: any) => row.root).filter(Boolean), pilot.root]) {
  assert.equal(fs.existsSync(path.join(root, 'home/.codex/auth.json')), false, 'Authentication remains');
  const observed = runtime.AGENT.auditModels({ root, workspace: path.join(root, 'workspace'), home: path.join(root, 'home'), env: {} }).contexts;
  assert.ok(observed.length, 'No actual model observation');
  assert.ok(observed.every((context: any) => context.model === 'gpt-5.6-terra' && context.effort === 'medium'), 'Model mismatch');
  contexts.push(...observed);
  for (const name of fs.readdirSync(root).filter(name => /^ui-controller-\d+\.json$/.test(name))) {
    const controller = read(path.join(root, name));
    if (!controller.origin) continue;
    assert.match(controller.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    let reachable = false;
    try { await fetch(controller.origin + '/health', { signal: AbortSignal.timeout(1000) }); reachable = true; } catch { /* released */ }
    assert.equal(reachable, false, `UI server retained: ${controller.origin}`);
    closedUiOrigins.push(controller.origin);
  }
  const temporary = path.join(root, 'home/tmp');
  for (const name of fs.existsSync(temporary) ? fs.readdirSync(temporary).filter(name => name.endsWith('-connection.json')) : []) {
    const endpoint = read(path.join(temporary, name)).endpoint;
    if (!endpoint) continue;
    let reachable = false;
    try { await fetch(endpoint, { signal: AbortSignal.timeout(1000) }); reachable = true; } catch { /* closed */ }
    assert.equal(reachable, false, `Owned browser endpoint retained: ${endpoint}`);
    closedEndpoints.push(endpoint);
  }
}
const harnessDifferences = [...new Set([before, after].flatMap(state => runtime.files(path.join(state.project, 'e2e')).map((file: string) => path.relative(path.join(state.project, 'e2e'), file))))].sort().flatMap(name => {
  const digests = [before, after].map(state => {
    const file = path.join(state.project, 'e2e', name);
    return fs.existsSync(file) ? runtime.sha(file) : null;
  });
  return digests[0] === digests[1] ? [] : [{ file: name, current: digests[0], legacy: digests[1] }];
});
assert.deepEqual(read(path.join(before.project, 'e2e/workflow-policy.json')), read(path.join(after.project, 'e2e/workflow-policy.json')));
const allowedCompatibilityDiffs = new Set(['handoff.ts', 'nested-verifier.ts', 'resource-oracle.ts', 'runtime.ts',
  'workflow-policy.ts', 'workload.ts', 'interruption.test.ts', 'legacy-envelope.test.ts']);
assert.ok(harnessDifferences.every(diff => allowedCompatibilityDiffs.has(diff.file)), 'Undeclared harness changes');
const comparison = compareProducts(rows.filter(row => row.root));
const current = comparison.groups.find((group: any) => group.product === 'current');
const legacy = comparison.groups.find((group: any) => group.product === 'legacy');
const relativeChange = (newValue: number | null | undefined, oldValue: number | null | undefined) =>
  typeof newValue === 'number' && typeof oldValue === 'number' && oldValue > 0 ? (newValue - oldValue) / oldValue : null;
const delta = { direction: 'current relative to legacy; descriptive sample only',
  elapsed: relativeChange(current?.observedTotalMs, legacy?.observedTotalMs),
  input: relativeChange(current?.usage?.input, legacy?.usage?.input),
  uncachedInput: relativeChange(current?.usage ? current.usage.input - current.usage.cached : null,
    legacy?.usage ? legacy.usage.input - legacy.usage.cached : null),
  output: relativeChange(current?.usage?.output, legacy?.usage?.output) };
const commonPassedCases = cases.filter(caseId => ['current', 'legacy'].every(product =>
  rows.some(row => row.product === product && row.caseId === caseId && row.status === 'passed')));
const commonPassed = compareProducts(rows.filter(row => commonPassedCases.includes(row.caseId)));
const warnings = [
  'Each case/product has one fresh sample. Current ran before legacy; generation is stochastic, not a causal/population guarantee.',
  'The first-pass metric means the first outer attempt; internal fresh verification/repair is included in its time and cost.',
  'NOT a byte-identical harness comparison: legacy envelope admission and interruption handling were corrected after current formal trials. Product binaries, requirement bytes, public policy, business/UI acceptance and bounds stayed frozen. Exact changed files/digests are listed.',
  'Legacy uses genuine 0.5.4 project-local Skills/std and its historical enabled Modeling/Engineering preset; current uses the genuine 0.6.0 global SkillApp. Those version-specific workflow semantics differ.',
  'Review includes alignment with each automatically approved authored plan, not just the common external API. Generated plan constraints can differ; for example legacy Blog state-transition findings reference its own behavior/design/model. Rates are complete workflow-delivery observations, not a pure identical-assertion API score.',
  'The frozen public policy disables hanging Track GapLoop/AttractorCheck/HumanConfirm and retains fresh independent verification. This experiment does not measure those hooks when enabled or prove their production cost/performance equivalence.',
  'Infrastructure failure is not a business PASS. Overall trial rates retain it; business-only denominator is supplemental and must not disguise it.',
  'Input/cached/output are observed per-response deltas across parent and child logs, including failed/interrupted work. Cached is a subset of input, not extra tokens; this is not an account bill. Missing values are unknown.',
  'Costs cover the E2E execution sessions, not this orchestrating chat. All original harness logs/results remain; do not infer that models preserved every application-owned receipt. Observable native file deletions are listed for audit.',
  'A pre-existing release version assertion remains failing. This scoped test report does not claim the whole repository check or refactor mission completed.',
];
const evidence = { round: 55, observedAt: new Date().toISOString(), status: after.status, batches,
  candidates: before.candidates, requirementHashes: before.requirementHashes, workflowPolicy: policy,
  harnesses: { current: before.harnessSha256, legacy: after.harnessSha256, byteIdentical: before.harnessSha256 === after.harnessSha256, differences: harnessDifferences },
  formal: { ...comparison, warning: warnings.join(' '), rows, delta,
    commonPassed: { ...commonPassed, cases: commonPassedCases, warning: 'Post-hoc descriptive subset selected by both outcomes passing; not a causal estimate, not a substitute for all five formal trials.' } },
  supplementalPilot: { ...pilotReport, elapsedMs: pilot.wallMs, countedInFormalRates: false },
  protectedUnchanged: true, protectedAfter, installedSkills, contexts, closedEndpoints, closedUiOrigins, warnings };
runtime.writeJson(path.join(import.meta.dir, 'paired-e2e-round55.json'), evidence);
const minutes = (value: number | null) => typeof value === 'number' ? `${(value / 60000).toFixed(2)}` : 'unknown';
const tokens = (value: number | null | undefined) => typeof value === 'number' ? value.toLocaleString('en-US') : 'unknown';
const md = ['# Round55 新旧完整 E2E 对照', '',
  '重构后0.6.0与重构前0.5.4真实编译产物/配套Skill，各五项fresh完整规划→实现→独立验收。所有运行隔离/tmp；没有由本编排会话手工修生成应用，纠偏由测试中的模型执行；不修改原全局安装。', '',
  '| 版本 | 用例 | 正式结果 | 首次外层通过 | 外层次数 | 分钟 | input / cached / output |',
  '|---|---|---|---|---|---|---|',
  ...rows.map(row => `| ${row.product} | ${row.caseId} | ${row.status} | ${row.firstPass ?? 'unknown'} | ${row.attempts?.length ?? 'unknown'} | ${minutes(row.elapsedMs)} | ${tokens(row.usage?.input)} / ${tokens(row.usage?.cached)} / ${tokens(row.usage?.output)} |`),
  '', '## 分组汇总', '',
  '| 版本 | 正式试次 | 首次外层通过 | 最终通过 | infra/未完成 | 总分钟 | input | cached（input子集） | output |',
  '|---|---|---|---|---|---|---|---|---|',
  ...comparison.groups.map((group: any) => `| ${group.product} | ${group.trials} | ${group.firstPassed}/${group.trials} | ${group.passed}/${group.trials} | ${group.infrastructureOrIncomplete} | ${minutes(group.observedTotalMs)} | ${tokens(group.usage?.input)} | ${tokens(group.usage?.cached)} | ${tokens(group.usage?.output)} |`),
  '', '分母保留正式基础设施失败；业务-only分母、缺失数据数及阶段时间见JSON。未运行case保持unknown，不加入已执行试次率。', '',
  '```json', JSON.stringify(delta, null, 2), '```', '',
  '## 两版均通过的共同用例（事后描述子集）', '',
  `共同用例：${commonPassedCases.join(', ')}。不能用此子集替换五项总通过率，也不能称其为无偏/因果估计；它有助于看出总量下降是否来自不同infra结果。`, '',
  '| 版本 | 用例数 | 总分钟 | input | cached（input子集） | output |',
  '|---|---|---|---|---|---|',
  ...commonPassed.groups.map((group: any) => `| ${group.product} | ${group.trials} | ${minutes(group.observedTotalMs)} | ${tokens(group.usage?.input)} | ${tokens(group.usage?.cached)} | ${tokens(group.usage?.output)} |`), '',
  '## 各阶段耗时（分钟）', '',
  '失败阶段与内部修复均计入；driver总时间还包括初始化、CLI门禁、进程启动及清理。无该阶段的用例以—表示，不表示缺失的模型数据为零。', '',
  '| 版本 | 用例 | 规划 | 实现/纠偏 | 独立review | UI场景规划 | UI验收 |',
  '|---|---|---|---|---|---|---|',
  ...rows.map(row => `| ${row.product} | ${row.caseId} | ${['plan', 'implementation', 'review', 'ui-scenario', 'ui-acceptance'].map(phase => typeof row.phases[phase] === 'number' ? minutes(row.phases[phase]) : '—').join(' | ')} |`), '',
  '## 无效pilot成本（不计正式旧版失败）', '',
  `旧封套准入误判pilot：${pilot.root}；${minutes(pilot.wallMs)}分钟；input ${tokens(pilotReport?.usage?.input)} / cached ${tokens(pilotReport?.usage?.cached)} / output ${tokens(pilotReport?.usage?.output)}。原始记录保留，不重置预算。`, '',
  '## 比较边界', '', ...warnings.map(warning => `- ${warning}`),
  `- ${contexts.length}条实际模型上下文均Terra/medium；${installedSkills.length}个安装Skill根指纹保持；${closedEndpoints.length}个自有endpoint与${closedUiOrigins.length}个UI服务origin关闭、临时auth删除、原件保护指纹不变。`,
  `- current harness: ${before.harnessSha256}`, `- legacy harness: ${after.harnessSha256}`, '',
  '## 原始试次', '', ...rows.filter(row => row.root).map(row => `- ${row.product}/${row.caseId}: [日志与结果](${row.root})`), '',
  '阶段耗时、每次finding、原生UI收据、父子会话核算与source差异均保留在同名JSON；缺失/未运行项不填零。', ''];
fs.writeFileSync(path.join(import.meta.dir, 'paired-e2e-round55.md'), md.join('\n'));
console.log(JSON.stringify({ status: after.status, groups: comparison.groups, closedEndpoints: closedEndpoints.length, modelContexts: contexts.length, harnessDifferences }));
