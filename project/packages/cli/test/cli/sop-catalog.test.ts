import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSopCatalog } from '../../src/cli/sop/catalog';
import { createWorkspaceResourceCatalog, type WorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { writeSkillApp, writeSop } from '../fixtures/xnl-skill-app';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

async function fixture(profile?: string): Promise<{ root: string; skill: string; file: string; resources: WorkspaceResourceCatalog }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-sop-catalog-'));
  roots.push(root);
  const skill = path.join(root, '.agents/skills/demo');
  await writeSkillApp(skill, 'demo');
  await writeSop(skill, 'Test.SOP.Hello', 'hello.md', '# Hello', profile);
  return {
    root,
    skill,
    file: path.join(skill, 'SOP/hello.md'),
    resources: createWorkspaceResourceCatalog(root, ['.agents/skills']),
  };
}

describe('SopCatalog canonical projection', () => {
  test('reads one exact canonical SOP from a single ready snapshot', async () => {
    const { root, resources } = await fixture();
    const document = await createSopCatalog(resources).get('Test.SOP.Hello');
    expect(document).toMatchObject({
      fqn: 'Test.SOP.Hello',
      profile: 'freeform',
      logicalPath: 'SOP/hello.md',
      markdown: expect.stringContaining('# Hello'),
      contentDigest: expect.stringMatching(/^sha256:/),
      diagnostics: [],
    });
    expect(JSON.stringify(document)).not.toContain(root);
    await expect(createSopCatalog(resources).get('Test.ApplicationSOP.Hello')).rejects.toThrow('SOP_NOT_FOUND');
  });

  test('returns workspace-relative diagnostics for an unknown profile', async () => {
    const { root, resources } = await fixture('unknown-profile');
    const validation = await createSopCatalog(resources).validate();
    expect(validation).toMatchObject({
      valid: false,
      count: 0,
      diagnostics: [expect.objectContaining({ code: 'SOP_PROFILE_INVALID', location: 'SOP/hello.md' })],
    });
    expect(JSON.stringify(validation)).not.toContain(root);
  });

  test('projects only the resolved snapshot even if authored Markdown changes later', async () => {
    const { file, resources } = await fixture();
    const snapshot = await resources.snapshot();
    const drifting: WorkspaceResourceCatalog = {
      contractRuntime: resources.contractRuntime,
      async snapshot() {
        await fs.appendFile(file, '\nchanged-after-snapshot\n');
        return snapshot;
      },
      list: resources.list,
      detail: resources.detail,
    };
    await expect(createSopCatalog(drifting).get('Test.SOP.Hello')).resolves.toMatchObject({
      markdown: expect.not.stringContaining('changed-after-snapshot'),
    });
  });

  test('invalidates a workspace that still declares the removed resource Kind', async () => {
    const { skill } = await fixture();
    await fs.rename(path.join(skill, 'KindDefinitions/SOP'), path.join(skill, 'KindDefinitions/ApplicationSOP'));
    await fs.rename(path.join(skill, 'SOP'), path.join(skill, 'ApplicationSOP'));
    for (const relative of ['manifest.xnl', 'KindDefinitions/ApplicationSOP/manifest.xnl', 'ApplicationSOP/hello.md']) {
      const file = path.join(skill, relative);
      await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replaceAll('SOP', 'ApplicationSOP'));
    }
    const snapshot = await createWorkspaceResourceCatalog(path.dirname(path.dirname(path.dirname(skill))), ['.agents/skills']).snapshot();
    expect(snapshot).toMatchObject({ ready: false, resources: [] });
    expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'WORKSPACE_RESOURCE_KIND_REMOVED' }),
    ]));
  });

  test('projects a typed pipeline and resolves every Child SOP from that same snapshot', async () => {
    const { skill, resources } = await fixture();
    await writeSop(skill, 'Test.SOP.Child', 'child.md', '# Child');
    const pipeline = [
      '<input_contract>', 'Input reference.', '</input_contract>', '',
      '<preconditions>', 'Input exists.', '</preconditions>', '',
      '<procedure format="markdown-step-graph/v1">', '',
      '## Entry', '', '`run`', '',
      '## Step `run` — Run child', '',
      '### SOP', '', '`Test.SOP.Child`', '',
      '### Enter when', '', 'Input exists.', '',
      '### Input mapping', '', 'Pass the input reference.', '',
      '### Success', '', 'A receipt exists.', '',
      '### Failure', '', 'Record the blocker.', '',
      '### End `success`', '', 'Return the receipt.', '',
      '</procedure>', '',
      '<effects>', 'Owned by the Child SOP.', '</effects>', '',
      '<output_contract>', 'Receipt reference.', '</output_contract>', '',
      '<success_criteria>', 'Receipt is verifiable.', '</success_criteria>',
    ].join('\n');
    await writeSop(skill, 'Test.SOP.Hello', 'hello.md', pipeline, 'typed-pipeline');
    let snapshotCalls = 0;
    const tracking: WorkspaceResourceCatalog = {
      contractRuntime: resources.contractRuntime,
      async snapshot() {
        snapshotCalls++;
        return resources.snapshot();
      },
      list: resources.list,
      detail: resources.detail,
    };
    const document = await createSopCatalog(tracking).get('Test.SOP.Hello');
    expect(snapshotCalls).toBe(1);
    expect(document).toMatchObject({
      profile: 'typed-pipeline',
      semanticBlocks: { inputContract: { markdown: 'Input reference.' } },
      graph: {
        format: 'markdown-step-graph/v1',
        entry: 'run',
        steps: [{ id: 'run', childSopFqn: 'Test.SOP.Child' }],
      },
      diagnostics: [],
    });
  });

  test('fails closed when a pipeline Child SOP is absent from its ready snapshot', async () => {
    const { skill, resources } = await fixture('typed-pipeline');
    const source = await fs.readFile(path.join(skill, 'SOP/hello.md'), 'utf8');
    await fs.writeFile(path.join(skill, 'SOP/hello.md'), source.replace('# Hello', [
      '<input_contract>', 'Input.', '</input_contract>',
      '<preconditions>', 'Ready.', '</preconditions>',
      '<procedure format="markdown-step-graph/v1">',
      '## Entry', '`run`',
      '## Step `run`',
      '### SOP', '`Missing.SOP.Child`',
      '### Enter when', 'Ready.',
      '### Input mapping', 'Input.',
      '### Success', 'Receipt.',
      '### Failure', 'Stop.',
      '### End `failure`', 'No receipt.',
      '</procedure>',
      '<effects>', 'None.', '</effects>',
      '<output_contract>', 'Receipt.', '</output_contract>',
      '<success_criteria>', 'Verified.', '</success_criteria>',
    ].join('\n')));
    const validation = await createSopCatalog(resources).validate('Test.SOP.Hello');
    expect(validation).toMatchObject({
      valid: false,
      diagnostics: [expect.objectContaining({ code: 'MSG102', location: 'SOP/hello.md' })],
    });
  });
});
