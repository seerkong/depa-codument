import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createCodumentWorkspaceBlueprint } from 'depa-codument-product-capsule/workspace-app';
import { createCodumentWorkspaceInstaller } from 'depa-codument-product-capsule/workspace-install';
import { writeBundleResources } from '../fixtures/xnl-skill-app';

const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
async function invoke(root: string, explicit = true) {
  const child = Bun.spawn([process.execPath, resolve(import.meta.dir, '../../src/cli/index.ts'),
    ...explicit ? ['-w', root] : [], 'Resource', 'validate', '--json'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code, stdout, stderr };
}
test('real Resource validate enforces formal App membership and complete knowledge semantics locally', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codument-app-cli-'));
  try {
    const blueprint = createCodumentWorkspaceBlueprint();
    for (const directory of blueprint.directories) await mkdir(join(root, 'codument', directory), { recursive: true });
    const source = blueprint.manifest;
    await writeFile(join(root, 'codument/manifest.xnl'), source);
    await writeFile(join(root, 'codument/SKILL.md'), '---\nname: codument\ndescription: Isolated fixture\n---\n# Codument');
    for (const item of blueprint.catalogs.filter(item => !item.recursive)) {
      const body = item.kind === 'AttractorProfiles' ? '(<Profiles []>)' : '{enabled=false}';
      await writeFile(join(root, 'codument', item.root, item.entry!), `<${item.kind} #codument.config.${item.id} ${envelope} ${body}>`);
    }
    for (const explicit of [true, false]) {
      const result = await invoke(root, explicit);
      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({ valid: true, domain: { ready: true, appId: 'codument.workspace' } });
    }
    const file = join(root, 'codument/modeling/domain/orders/index.xnl');
    await mkdir(join(root, 'codument/modeling/domain/orders'), { recursive: true });
    const invalid = `<ModelingRegistry #knowledge.orders ${envelope} {modeling_schema="data-topology/v1"} [
      <object #domain.orders.order {kind="entity" semantic_role=["value"] authority_model="immutable_value" relations=[]}>
    ]>`;
    await writeFile(file, invalid);
    const semantic = await invoke(root);
    expect(semantic.code).toBe(1);
    expect(JSON.parse(semantic.stdout)).toMatchObject({ valid: false, domain: { ready: false } });
    expect(await readFile(file, 'utf8')).toBe(invalid);
    await writeFile(join(root, 'codument/manifest.xnl'), source.split('\n').filter(line => !line.includes('#modeling {')).join('\n'));
    const orphan = await invoke(root);
    expect(orphan.code).toBe(1);
    expect(JSON.parse(orphan.stdout).domain.findings.some((item: { rule: string }) => item.rule === 'workspace.orphan')).toBe(true);
    expect(await readdir(root)).toEqual(['codument']);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30_000);

test('installed formal App combines recursive knowledge with executable resources and rejects unknown Kinds', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'codument-app-mixed-'));
  try {
    await createCodumentWorkspaceInstaller(root).install({ agents: ['codex'] });
    const app = join(root, 'codument');
    await mkdir(join(app, 'modeling/domain/orders'), { recursive: true });
    await writeFile(join(app, 'modeling/domain/orders/index.xnl'), `<ModelingRegistry #knowledge.orders ${envelope} {modeling_schema="data-topology/v1"} [
      <object #domain.orders.order {kind="entity" semantic_role="value" authority_model="immutable" relations=[]} (<types ?>type Order = string</?>)>
    ]>`);
    await writeBundleResources(app, 'Codument.Mixed.Bundle', `const api = globalThis.Codument;
export const echo = api.defineLocalFunction({fqn: 'Codument.Mixed.Echo', operation: 'query', inputSchema: {}, configSchema: {}, outputSchema: {}, handler: (_runtime, input) => input});`);
    const valid = await invoke(root);
    expect(valid.code).toBe(0); expect(JSON.parse(valid.stdout)).toMatchObject({ valid: true, domain: { ready: true } });
    const child = Bun.spawn([process.execPath, resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root,
      'LocalFunction', 'invoke', '--fqn', 'Codument.Mixed.Echo', '--input', '{"message":"local-mixed"}', '--json'],
    { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
    expect(JSON.parse(stdout)).toMatchObject({ result: { message: 'local-mixed' } });
    expect((await readdir(app, { recursive: true })).some(p => p.includes('KindDefinitions'))).toBe(false);
    expect((await readdir(root)).includes('.codument')).toBe(false);
    const manifest = await readFile(join(app, 'manifest.xnl'), 'utf8');
    await mkdir(join(app, 'unknown'));
    await writeFile(join(app, 'manifest.xnl'), manifest.replace('  ]>\n)>', '    <FileResourceCatalog #unknown {resourceKind="UnknownKind" root="vfs://./unknown/"}>\n  ]>\n)>'));
    const unknown = await invoke(root);
    expect(unknown.code).toBe(1); expect(JSON.parse(unknown.stdout).valid).toBe(false);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30_000);
