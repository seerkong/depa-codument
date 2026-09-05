import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

function operation(name: string): string {
  return fs.readFileSync(
    path.join(ROOT, 'src', 'templates', 'codument', 'std', 'operations', `${name}.md`),
    'utf8',
  );
}

function template(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, 'src', 'templates', ...relativePath.split('/')), 'utf8');
}

describe('workflow session hardening', () => {
  it('reconciles scope drift without creating a default stop point', () => {
    const implTrack = operation('impl-track');
    const implMission = operation('impl-mission');

    for (const content of [implTrack, implMission]) {
      expect(content).toContain('预期改动面');
      expect(content).toContain('目标内、局部且可逆');
      expect(content).toContain('计划或 authority 假设失效');
      expect(content).toContain('新产品决策、不可逆外部动作、缺少权限或输入');
      expect(content).toContain('不是文件或命令白名单');
      expect(content).not.toContain('权限内命令集合');
      expect(content).not.toContain('可执行命令白名单');
      expect(content).not.toContain('越界发现必须停下');
      expect(content).not.toContain('越界发现停下列出');
    }

    expect(implTrack).toContain('本小节不增加 `impl-mission.md §2.1` 之外的 mission 返回点');
    expect(implMission).toContain('本小节不增加 §2.1 之外的返回点');
    expect(implMission).toContain('有其他 ready branch 时先继续可执行分支');
  });

  it('keeps the canonical Mission superseded state wired through validation authority', () => {
    const validator = fs.readFileSync(path.join(ROOT, 'src', 'cli', 'mission', 'validate.ts'), 'utf8');
    const behavior = fs.readFileSync(
      path.join(ROOT, 'codument', 'behaviors', 'codument-core.xnl'),
      'utf8',
    );

    expect(validator).toContain("'ABANDONED', 'SUPERSEDED'");
    expect(validator).not.toContain("'ABANDONED', 'SUPERSED'");
    expect(behavior).toContain('<Case #mission-node-status-enum');
    expect(behavior).toContain('ABANDONED, SUPERSEDED');
    expect(behavior).toContain('legacy misspelling SUPERSED');
  });

  it('keeps rollback review as a qualified implementation event', () => {
    const implTrack = operation('impl-track');
    const implMission = operation('impl-mission');
    const hooks = template('codument/config/operation-hooks.xnl');

    expect(hooks).not.toContain('#rollback-review');
    expect(hooks).not.toContain('#impl-mission');
    expect(implTrack).toContain('不是 Operation、生命周期 hook、CLI 状态或返回条件');
    expect(implTrack).toContain('错误假设或错误路径被丢弃');
    expect(implTrack).toContain('对当前后续任务或未来工作有复用价值');
    expect(implTrack).toContain('普通 rebase/branch switch');
    expect(implTrack).toContain('用户明确要求的恢复');
    expect(implTrack).toContain('生成物清理');
    expect(implTrack).toContain('复盘后继续当前 task 的实现与验证');
    expect(implMission).toContain('按 `impl-track.md §8.1` 处理回退复盘事件');
    expect(implMission).toContain('不构成 mission 返回点');
  });

  it('defines a fresh read-only AttractorCheck with caller-owned rounds', () => {
    const protocol = template('codument/std/protocols/attractor-check.md');

    expect(protocol).toContain('status: PASS | GAP | BLOCKED');
    expect(protocol).toContain('轮次和控制流归调用方所有');
    expect(protocol).toContain('调用方修复所报差距并验证，然后启动新的 fresh reviewer');
    expect(protocol).toContain('同一 reviewer 不执行修复或自行续轮');
    expect(protocol).toContain('不自动成为 mission invocation 返回点');
    expect(protocol).toContain('二者互不替代');
    expect(protocol).toContain('不从 `GapLoopDefaults.verify_round` 推导对方是否运行');
    expect(protocol).not.toContain('BLOCKING-N');
    expect(protocol).not.toContain('NONBLOCKING-N');
    expect(protocol).not.toContain('结论: FAIL');
  });

  it('routes every AttractorCheck operation through the canonical protocol', () => {
    const operationDir = path.join(ROOT, 'src', 'templates', 'codument', 'std', 'operations');
    const callers = fs.readdirSync(operationDir)
      .filter((file) => file.endsWith('.md'))
      .filter((file) => fs.readFileSync(path.join(operationDir, file), 'utf8').includes('AttractorCheck'));

    expect(callers.sort()).toEqual([
      'discuss.md',
      'impl-quick.md',
      'impl-track.md',
      'plan-mission.md',
      'plan-track.md',
    ]);

    for (const file of callers) {
      const content = fs.readFileSync(path.join(operationDir, file), 'utf8');
      expect(content, file).toContain('std/protocols/attractor-check.md');
    }

    const implTrack = operation('impl-track');
    expect(implTrack).toContain('本文件只编排 caller 行为');
    expect(implTrack).toContain('GAP 时由 track executor 修复、验证并启动新的 fresh reviewer');
    expect(implTrack).not.toContain('裁决 PASS|GAP|BLOCKED');
    expect(implTrack).not.toContain('见 `std/protocols/validation.md`');
  });

  it('materializes retrospective candidates before the archive transaction', () => {
    const archive = operation('archive-track');
    const retrospective = archive.indexOf('写 `reports/retrospective.md`');
    const materialize = archive.indexOf('把复盘确认合格的 durable 内容物化');
    const validate = archive.indexOf('运行 `codument validate <track-id> --strict`');
    const transaction = archive.indexOf('运行 `codument archive <track-id>`');

    expect(retrospective).toBeGreaterThan(-1);
    expect(materialize).toBeGreaterThan(retrospective);
    expect(validate).toBeGreaterThan(materialize);
    expect(transaction).toBeGreaterThan(validate);
    expect(archive).toContain('after hook 必须把已归档 authority 视为只读');
    expect(archive).toContain('归档成功后发现的新想法属于后续 Track');
    expect(archive).not.toContain('session-budget');
    expect(archive).not.toContain('外部会话库');
  });

  it('removes the speculative session budget and resumes from existing authority', () => {
    const budget = path.join(
      ROOT,
      'src',
      'templates',
      'codument',
      'std',
      'methods',
      'session-budget.md',
    );
    const profile = template('codument/config/attractor-profiles.xnl');
    const mission = operation('impl-mission');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

    expect(fs.existsSync(budget)).toBe(false);
    expect(profile).not.toContain('session-budget');
    expect(profile).not.toContain('上下文预算方法');
    expect(readme).not.toContain('session-insights indexer');
    expect(readme).not.toContain('stable machine-readable plan surface');
    expect(readme).not.toContain('session-budget.md');
    expect(mission).toContain('只在**需要续跑的合法返回边界**');
    expect(mission).toContain('当前目标、已完成项、下一 ready operation、真实 blocker、关键证据路径');
    expect(mission).toContain('mission/track XNL 为状态 authority');
    expect(mission).toContain('从 `mission.xnl` 的 TaskSpace/TrackLink 重建 mission actual state');
    expect(mission).toContain('`codument track ready <id> --json`');
    expect(mission).not.toContain('codument mission ready');
    expect(mission).toContain('chat history 不是 authority');
    expect(mission).toContain('不估算 token 百分比');
    expect(mission).toContain('不发明 `current_state` 字段');
    expect(mission).toContain('task、phase、单条 Track、回退复盘或重规划完成后不得因此停下');
  });

  it('keeps dogfood workflow authorities aligned with packaged templates', () => {
    const managed = [
      'std/AGENTS.md',
      'std/operations/archive-track.md',
      'std/operations/discuss.md',
      'std/operations/impl-mission.md',
      'std/operations/impl-quick.md',
      'std/operations/impl-track.md',
      'std/operations/plan-mission.md',
      'std/operations/plan-track.md',
      'std/protocols/attractor-check.md',
      'std/protocols/cybernetic-loop.md',
      'std/spec/mission-xnl-spec.md',
    ];

    for (const relativePath of managed) {
      const packaged = template(`codument/${relativePath}`);
      const dogfood = fs.readFileSync(path.join(ROOT, 'codument', relativePath), 'utf8');
      expect(dogfood, relativePath).toBe(packaged);
    }

    const hooks = fs.readFileSync(
      path.join(ROOT, 'codument', 'config', 'operation-hooks.xnl'),
      'utf8',
    );
    const profile = fs.readFileSync(
      path.join(ROOT, 'codument', 'config', 'attractor-profiles.xnl'),
      'utf8',
    );
    expect(hooks).not.toContain('#rollback-review');
    expect(hooks).not.toContain('#impl-mission');
    expect(profile).not.toContain('session-budget');
  });
});
