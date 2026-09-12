import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const modeling = `<ModelingRegistry #knowledge.orders ${envelope} {modeling_schema="data-topology/v1"} [<object #domain.orders.value {kind="object" semantic_role="immutable_value" authority_model="value" relations=[]} (<types ?>type Value = string</?>)>]>`;
const engineering = `<EngineeringRegistry #knowledge.project ${envelope} [<overview #global.overview.project.example {kind="overview"} (<desc ?>Project</?><mental-model ?>Current system</?>)>]>`;
async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, ...args], {stdout: 'pipe', stderr: 'pipe'});
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return {code, stdout, stderr};
}
it('knowledge scaffold retains both option families and text protocol, with one source owner and no Serve', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-knowledge-scaffold-cli-'));
  const modelArgs = ['modeling', 'scaffold', 'entity', 'order', '--plane', 'domain', '--context', 'orders', '--fields', 'id:string,total:number', '--json'];
  try {
    expect((await invoke(root, modelArgs)).code).toBe(1); expect(await fs.readdir(root)).toEqual([]);
    await fs.mkdir(path.join(root, 'codument'));
    const modelFile = path.join(root, 'codument/modeling/domain/orders/index.xnl');
    expect(await invoke(root, modelArgs)).toEqual({code: 0, stdout: `modeling scaffold: entity 'order' appended to ${modelFile}\n`, stderr: ''});
    const entity = await fs.readFile(modelFile, 'utf8');
    expect(entity).toContain('id: string'); expect(entity).toContain('total: number'); expect(entity).toContain('data-topology/v1');
    const state = await invoke(root, ['modeling', 'scaffold', 'state-machine', 'process', '--plane', 'domain', '--context', 'orders', '--states', 'created,done']);
    expect(state.code).toBe(0); expect((await fs.readFile(modelFile, 'utf8'))).toContain('created --> done: next');
    const modelSource = await fs.readFile(modelFile, 'utf8');
    expect((await invoke(root, modelArgs)).code).toBe(1);
    expect(await fs.readFile(modelFile, 'utf8')).toBe(modelSource);
    const engineeringFile = path.join(root, 'codument/engineering/global/overview/project.xnl');
    expect(await invoke(root, ['engineering', 'scaffold', 'overview', 'guide', '--plane', 'global', '--category', 'overview', '--topic', 'project', '--json']))
      .toEqual({code: 0, stdout: `engineering scaffold: overview 'guide' appended to ${engineeringFile}\n`, stderr: ''});
    expect((await fs.readFile(engineeringFile, 'utf8'))).toContain('<EngineeringRegistry');
    // Structural draft acceptance is not a fresh semantic verdict on TODOs.
    expect((await invoke(root, ['modeling', 'validate', '--json'])).code).toBe(0);
    expect((await invoke(root, ['engineering', 'validate', 'codument/engineering'])).code).toBe(0);
    const files = (await fs.readdir(root, {recursive: true})).sort();
    for (const args of [modelArgs.map(value => value === 'orders' ? '../escape' : value),
      ['modeling', 'scaffold', 'object', 'bad', '--plane', 'domain'],
      ['engineering', 'scaffold', 'overview', 'bad', '--plane', 'global', '--category', 'overview', '--topic', 'project', '--unknown']]) expect((await invoke(root, args)).code).toBe(1);
    expect((await fs.readdir(root, {recursive: true})).sort()).toEqual(files);
    expect(await fs.readdir(root)).toEqual(['codument']);
    expect(files.some(file => file.includes('KindDefinition') || file.includes('.lock') || file.includes('serve'))).toBe(false);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
}, 30_000);
it('scaffold deltas use the current Track directory and preserve a legacy flat registry for explicit migration', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-knowledge-scaffold-delta-'));
  const track = path.join(root, 'codument/tracks/pending/work');
  try {
    await fs.mkdir(track, {recursive: true});
    await fs.writeFile(path.join(track, 'track.xnl'), `<Track #work ${envelope} {status="new"}>`);
    const modelArgs = ['modeling', 'scaffold', 'object', 'value', '--plane', 'domain', '--context', 'orders', '--track', 'work'];
    expect(await invoke(root, modelArgs)).toEqual({code: 0, stdout: "modeling scaffold: object 'value' appended to codument/tracks/pending/work/modeling_deltas/domain/orders.xnl\n", stderr: ''});
    const engineeringArgs = ['engineering', 'scaffold', 'rule', 'rule', '--plane', 'global', '--category', 'rules', '--topic', 'project', '--track', 'work'];
    expect((await invoke(root, engineeringArgs)).code).toBe(0);
    expect(await fs.exists(path.join(track, 'engineering_deltas/global/rules/project.xnl'))).toBe(true);
    await fs.mkdir(path.join(root, 'codument/modeling/domain'), {recursive: true});
    const oldFile = path.join(root, 'codument/modeling/domain/orders.xnl'), oldSource = '<object #domain.orders.legacy {kind="object"}>';
    await fs.writeFile(oldFile, oldSource);
    const refused = await invoke(root, modelArgs.slice(0, -2));
    expect(refused.code).toBe(1); expect(refused.stderr).toContain('migrate');
    expect(await fs.readFile(oldFile, 'utf8')).toBe(oldSource);
    expect(await fs.exists(path.join(root, 'codument/modeling/domain/orders/index.xnl'))).toBe(false);
  } finally {await fs.rm(root, {recursive: true, force: true});}
}, 30_000);
it('knowledge CLI keeps gates, explicit root, JSON exceptions, lint advice and local read-only behavior', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-knowledge-cli-'));
  async function write(file: string, source: string) { await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true}); await fs.writeFile(path.join(root, file), source); }
  try {
    const empty = await invoke(root, ['modeling', 'validate', '--json']);
    expect(empty.code).toBe(0); expect(JSON.parse(empty.stdout)[0].severity).toBe('warning');
    const disabled = await invoke(root, ['engineering', 'validate', '--json']);
    expect(disabled).toEqual({code: 0, stdout: 'engineering disabled，跳过 (set enabled="true" in codument/config/engineering.xnl)\n', stderr: ''});
    expect(await fs.readdir(root)).toEqual([]);
    await write('codument/modeling/domain/orders/index.xnl', modeling);
    await write('codument/engineering/global/overview/project.xnl', engineering);
    expect(await invoke(root, ['modeling', 'validate', '--json'])).toEqual({code: 0, stdout: '[]\n', stderr: ''});
    const modelConfig = `<ModelingConfig #config.modeling ${envelope} {enabled=false} (<Lint {max_nodes=0}>)>`;
    await write('codument/config/modeling.xnl', modelConfig);
    expect((await invoke(root, ['modeling', 'validate', '--json'])).stdout).toStartWith('modeling disabled，跳过');
    expect((await invoke(root, ['modeling', 'validate', 'codument/modeling', '--json'])).stdout).toBe('[]\n');
    const lint = await invoke(root, ['modeling', 'lint', '--json']);
    expect(lint.code).toBe(0); expect(lint.stdout).toContain('1 nodes > 0'); expect(lint.stdout).toStartWith('modeling lint: 1 fractal-split candidate(s)');
    const explicitEngineering = await invoke(root, ['engineering', 'validate', 'codument/engineering', '--json']);
    expect(explicitEngineering).toEqual({code: 0, stdout: '✓ engineering validate: no issues in codument/engineering\n', stderr: ''});
    expect((await invoke(root, ['engineering', 'lint', '--max-lines', '0'])).stdout).toContain('1 lines > 0');
    expect((await invoke(root, ['modeling', 'lint', '--max-nodes', 'not-number'])).code).toBe(1);
    await write('codument/config/engineering.xml', '<Engineering enabled="true"/>');
    expect((await invoke(root, ['engineering', 'validate'])).code).toBe(1);
    expect((await invoke(root, ['engineering', 'validate', 'codument/engineering'])).code).toBe(0);
    expect(await fs.readFile(path.join(root, 'codument/modeling/domain/orders/index.xnl'), 'utf8')).toBe(modeling);
    expect(await fs.readFile(path.join(root, 'codument/config/modeling.xnl'), 'utf8')).toBe(modelConfig);
    expect(await fs.readdir(root)).toEqual(['codument']);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
}, 30_000);
it('knowledge delta reads reject ambiguous/legacy/unsafe authorities and do not hide invalid sources', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-knowledge-delta-'));
  const track = path.join(root, 'codument/tracks/pending/example');
  try {
    await fs.mkdir(path.join(track, 'modeling_deltas/domain'), {recursive: true});
    await fs.writeFile(path.join(track, 'track.xnl'), `<Track #example ${envelope} {status="new"}>`);
    const file = path.join(track, 'modeling_deltas/domain/orders.xnl');
    await fs.writeFile(file, modeling);
    expect(await invoke(root, ['modeling', 'validate', '--deltas', 'example', '--json'])).toEqual({code: 0, stdout: '[]\n', stderr: ''});
    expect((await invoke(root, ['modeling', 'validate', 'elsewhere', '--deltas', 'example'])).code).toBe(1);
    expect((await invoke(root, ['modeling', 'validate', '--deltas', '../example'])).code).toBe(1);
    await fs.writeFile(file, modeling.replace('relations=[]', 'relations=[{relation="observes" target="modeling://domain/orders/missing"}]'));
    const dangling = await invoke(root, ['modeling', 'validate', '--deltas', 'example', '--json']);
    expect(dangling.code).toBe(1); expect(JSON.parse(dangling.stdout).map((item: {rule: string}) => item.rule)).toContain('modeling.dangling-reference');
    await fs.writeFile(file, new Uint8Array([255]));
    const invalid = await invoke(root, ['modeling', 'validate', '--deltas', 'example', '--json']);
    expect(invalid.code).toBe(1); expect(invalid.stdout).toBe('');
    await fs.rm(file); await fs.symlink(path.join(track, 'track.xnl'), file);
    expect((await invoke(root, ['modeling', 'validate', '--deltas', 'example'])).stderr).toContain('symlink');
    await fs.rm(file); await fs.writeFile(file, modeling);
    await fs.mkdir(path.join(root, 'codument/tracks/active/example'), {recursive: true});
    await fs.writeFile(path.join(root, 'codument/tracks/active/example/track.xnl'), `<Track #example ${envelope} {status="in_progress"}>`);
    expect((await invoke(root, ['modeling', 'validate', '--deltas', 'example'])).stderr).toContain('2 eligible authorities');
    expect(await fs.readFile(file, 'utf8')).toBe(modeling);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
}, 30_000);
