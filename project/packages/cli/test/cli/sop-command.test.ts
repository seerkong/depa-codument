import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { dispatchCommand } from '../../src/cli/command-registry';
import { createCommandRuntime } from '../../src/cli/runtime';
import { writeSkillApp, writeSop } from '../fixtures/xnl-skill-app';

const roots: string[] = [];
afterEach(async () => {
  process.exitCode = 0;
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function pipeline(target = 'finish'): string {
  return [
    '<input_contract>', 'Input reference.', '</input_contract>', '',
    '<preconditions>', 'Input exists.', '</preconditions>', '',
    '<procedure format="markdown-step-graph/v1">', '',
    '## Entry', '', '`start`', '',
    '## Step `start` — Start', '',
    '### SOP', '', '`Test.SOP.Child`', '',
    '### Enter when', '', 'Input exists.', '',
    '### Input mapping', '', 'Pass the reference.', '',
    '### Success', '', 'A receipt exists.', '',
    '### Failure', '', 'Record the blocker.', '',
    `### Route \`completed\` → \`${target}\``, '', 'A complete receipt exists.', '',
    '## Step `finish` — Finish', '',
    '### SOP', '', '`Test.SOP.Child`', '',
    '### Enter when', '', 'A complete receipt exists.', '',
    '### Input mapping', '', 'Pass the receipt.', '',
    '### Success', '', 'The receipt is verified.', '',
    '### Failure', '', 'Keep the evidence.', '',
    '### End `success`', '', 'Return the receipt.', '',
    '</procedure>', '',
    '<effects>', 'Owned by the Child SOP.', '</effects>', '',
    '<output_contract>', 'Receipt reference.', '</output_contract>', '',
    '<success_criteria>', 'Receipt is verifiable.', '</success_criteria>',
  ].join('\n');
}

async function fixture(target = 'finish'): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-sop-command-'));
  roots.push(root);
  const skill = path.join(root, '.agents/skills/demo');
  await writeSkillApp(skill, 'demo');
  await writeSop(skill, 'Test.SOP.Child', 'child.md', '# Child');
  await writeSop(skill, 'Test.SOP.Pipeline', 'pipeline.md', pipeline(target), 'typed-pipeline');
  await writeSop(skill, 'Test.SOP.Freeform', 'freeform.md', '# Freeform');
  return root;
}

describe('SOP validate and graph commands', () => {
  test('returns a byte-stable stdout/JSON projection without writing a graph authority', async () => {
    const root = await fixture();
    const before = (await fs.readdir(path.join(root, '.agents/skills/demo/SOP'))).sort();
    const result = await dispatchCommand(['SOP', 'graph', '--fqn', 'Test.SOP.Pipeline'], createCommandRuntime(root), true);
    const mermaid = String(result.data?.mermaid);
    expect(result.message).toBe(mermaid);
    expect(result).toMatchObject({
      code: 0,
      data: {
        command: 'SOP.graph',
        fqn: 'Test.SOP.Pipeline',
        profile: 'typed-pipeline',
        format: 'markdown-step-graph/v1',
        contentDigest: expect.stringMatching(/^sha256:/),
        mermaid: expect.stringMatching(/^flowchart TD\n/u),
      },
    });
    expect((await fs.readdir(path.join(root, '.agents/skills/demo/SOP'))).sort()).toEqual(before);
  });

  test('rejects graph projection for non-pipeline profiles', async () => {
    const result = await dispatchCommand(
      ['SOP', 'graph', '--fqn', 'Test.SOP.Freeform'],
      createCommandRuntime(await fixture()),
      true,
    );
    expect(result).toMatchObject({ code: 1, data: { command: 'SOP.graph' } });
    expect(result.message).toContain('requires a valid typed-pipeline SOP');
  });

  test('shares stable protocol diagnostics between SOP and Resource validation', async () => {
    const runtime = createCommandRuntime(await fixture('missing'));
    const sop = await dispatchCommand(['SOP', 'validate', '--fqn', 'Test.SOP.Pipeline'], runtime, true);
    const resource = await dispatchCommand(['Resource', 'validate'], runtime, true);
    expect(resource.data?.diagnostics).toEqual(sop.data?.diagnostics);
    expect(sop).toMatchObject({ code: 1, data: { valid: false } });
    expect(resource).toMatchObject({ code: 1, data: { valid: false } });
    expect(sop.data?.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MSG006', location: 'SOP/pipeline.md' }),
    ]));
  });
});
