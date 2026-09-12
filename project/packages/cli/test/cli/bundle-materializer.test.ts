import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  defineLocalFunction,
  definePageObject,
  definePageWorkflow,
  isHostResourceDefinition,
  type PageObjectSelector,
  type PageWorkflowSelector,
} from '../../src/cli/resources/definitions';
import {
  ResourceSchemaValidationError,
  invokeLocalFunctionDefinition,
  invokePageObjectActionDefinition,
  startPageWorkflowDefinition,
} from '../../src/cli/resources/schema-validator';
import { createBundleDefinitionCatalog } from '../../src/cli/resources/bundle-materializer';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { skillAppKindDefinitionSource, writeBundleResources, writeSkillApp } from '../fixtures/xnl-skill-app';

const temporaryRoots = new Set<string>();

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => fs.rm(root, { force: true, recursive: true })));
  temporaryRoots.clear();
});

function objectSchema(required: string[] = []): Readonly<Record<string, unknown>> {
  return { type: 'object', required, properties: Object.fromEntries(required.map((key) => [key, { type: 'string' }])), additionalProperties: false };
}

async function workspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-bundle-'));
  temporaryRoots.add(root);
  await fs.mkdir(path.join(root, '.agents/skills'), { recursive: true });
  return root;
}

async function addBundleResources(root: string, skillId: string, resourceId: string, moduleSource: string): Promise<string> {
  const skillRoot = path.join(root, '.agents/skills', skillId);
  await writeSkillApp(skillRoot, skillId);
  await writeBundleResources(skillRoot, resourceId, moduleSource);
  return skillRoot;
}

interface HostBundleFixture {
  readonly skillRoot: string;
  readonly bundleRoot: string;
  readonly bundleFqn: string;
}

async function addHostBundle(
  root: string,
  skillId: string,
  sources: readonly string[] = ['vfs://./entry.ts', 'vfs://./helper.ts'],
): Promise<HostBundleFixture> {
  const skillRoot = path.join(root, '.agents/skills', skillId);
  const bundleRoot = path.join(skillRoot, 'HostBundle/demo');
  const bundleFqn = `Test.${skillId}.HostBundle.Demo`;
  await writeSkillApp(skillRoot, skillId);
  await fs.mkdir(path.join(skillRoot, 'KindDefinitions/HostBundle'), { recursive: true });
  await fs.mkdir(bundleRoot, { recursive: true });
  await fs.writeFile(path.join(skillRoot, 'KindDefinitions/HostBundle/manifest.xnl'), skillAppKindDefinitionSource('HostBundle'));
  const manifestPath = path.join(skillRoot, 'manifest.xnl');
  const manifest = await fs.readFile(manifestPath, 'utf8');
  await fs.writeFile(manifestPath, manifest.replace(
    '  ]>\n)>',
    '    <DirectoryResourceCatalog #host_bundles { resourceKind = "HostBundle" root = "vfs://./HostBundle/" entry = "manifest.xnl" scope = "children" }>\n  ]>\n)>',
  ));
  await fs.writeFile(path.join(bundleRoot, 'manifest.xnl'), [
    `<HostBundle #${bundleFqn} envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {`,
    '  entry = "vfs://./entry.ts"',
    '  runtime = "bun"',
    `  sources = [${sources.map((source) => JSON.stringify(source)).join(' ')}]`,
    '  exports = ["LocalFunction"]',
    '}>',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(bundleRoot, 'helper.ts'), 'export const value = "first";\n');
  await fs.writeFile(path.join(bundleRoot, 'entry.ts'), [
    'import { value } from "./helper.ts";',
    'const api = globalThis.Codument;',
    'export const resourceDefinitions = [api.defineLocalFunction({',
    `  fqn: "Test.${skillId}.LocalFunction.Value", operation: "query",`,
    '  inputSchema: { type: "object" }, configSchema: { type: "object" }, outputSchema: { type: "object" },',
    '  runtimeCapabilities: [], handler: () => ({ value }),',
    '})];',
    '',
  ].join('\n'));
  return { skillRoot, bundleRoot, bundleFqn };
}

async function addSkillModuleHostBundle(
  root: string,
  skillId: string,
  exports: readonly string[] = ['PageWorkflow', 'PageObject'],
): Promise<HostBundleFixture> {
  const skillRoot = path.join(root, '.agents/skills', skillId);
  const moduleRoot = path.join(skillRoot, 'modules/search');
  const bundleRoot = path.join(moduleRoot, 'host');
  const bundleFqn = `Test.${skillId}.HostBundle.Search`;
  await writeSkillApp(skillRoot, skillId);
  await Promise.all([
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/SkillModule'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/HostBundle'), { recursive: true }),
    fs.mkdir(bundleRoot, { recursive: true }),
  ]);
  await fs.writeFile(path.join(skillRoot, 'KindDefinitions/SkillModule/manifest.xnl'), skillAppKindDefinitionSource('SkillModule'));
  await fs.writeFile(path.join(skillRoot, 'KindDefinitions/HostBundle/manifest.xnl'), skillAppKindDefinitionSource('HostBundle'));
  await fs.writeFile(path.join(moduleRoot, 'manifest.xnl'), [
    `<SkillModule #Test.${skillId}.Module.Search envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (`,
    '  <Catalogs [',
    '    <DirectoryResourceCatalog #host { resourceKind = "HostBundle" root = "vfs://./host/" entry = "manifest.xnl" scope = "root" }>',
    '  ]>',
    ')>',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(bundleRoot, 'manifest.xnl'), [
    `<HostBundle #${bundleFqn} envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {`,
    '  entry = "vfs://./entry.ts"',
    '  runtime = "bun"',
    '  sources = ["vfs://./entry.ts"]',
    `  exports = [${exports.map((kind) => JSON.stringify(kind)).join(' ')}]`,
    '}>',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(bundleRoot, 'entry.ts'), [
    'const api = globalThis.Codument;',
    `const workflowFqn = "Test.${skillId}.PageWorkflow.Search";`,
    `const objectFqn = "Test.${skillId}.PageObject.Search";`,
    'export const resourceDefinitions = [',
    '  api.definePageWorkflow({ fqn: workflowFqn, inputSchema: { type: "object" }, outputSchema: { type: "object" }, runtimeCapabilities: [], selectionPolicy: { kind: "external-page", urlPattern: "^https://example\\\\.test", cardinality: "exactly-one" }, defaultSelector: { direct: { byExternalPage: {} } }, start: (_runtime, _selector, invocation) => invocation.payload }),',
    '  api.definePageObject({ fqn: objectFqn, runtimeCapabilities: [], selectionPolicy: { kind: "external-page", urlPattern: "^https://example\\\\.test", cardinality: "exactly-one" }, actions: [{ fqn: `${objectFqn}.Read`, inputSchema: { type: "object" }, outputSchema: { type: "object" }, handler: (_runtime, _selector, invocation) => invocation.payload }] }),',
    '];',
    '',
  ].join('\n'));
  return { skillRoot, bundleRoot, bundleFqn };
}

describe('Host resource definitions', () => {
  test('creates deeply frozen, branded definitions without exporting a forgeable token', () => {
    const schema = objectSchema(['value']);
    const local = defineLocalFunction({
      fqn: 'Template.Demo.LocalFunction.Echo',
      description: 'echo',
      operation: 'query',
      inputSchema: schema,
      configSchema: objectSchema(),
      outputSchema: schema,
      runtimeCapabilities: ['clock'],
      handler: (_runtime, input) => input,
    });
    const workflow = definePageWorkflow({
      fqn: 'Template.Demo.PageWorkflow.Open',
      inputSchema: schema,
      outputSchema: schema,
      runtimeCapabilities: ['page'],
      selectionPolicy: { kind: 'external-page', urlPattern: '^https://example\\.com', cardinality: 'exactly-one' },
      defaultSelector: { direct: { byExternalPage: {} } },
      activation: { onMissing: 'open', url: 'https://example.com' },
      start: (_runtime, _selector, invocation) => invocation.payload,
    });
    const pageObject = definePageObject({
      fqn: 'Template.Demo.PageObject.Example',
      runtimeCapabilities: ['page'],
      selectionPolicy: { kind: 'external-page', urlPattern: '^https://example\\.com', cardinality: 'exactly-one' },
      actions: [{ fqn: 'Template.Demo.PageObject.Example.Read', inputSchema: objectSchema(), outputSchema: schema, handler: () => ({ value: 'ok' }) }],
    });

    expect(isHostResourceDefinition(local)).toBe(true);
    expect(isHostResourceDefinition({ ...local })).toBe(false);
    expect(Object.isFrozen(local)).toBe(true);
    expect(Object.isFrozen(local.inputSchema)).toBe(true);
    expect(Object.isFrozen(workflow.selectionPolicy)).toBe(true);
    expect(Object.isFrozen(pageObject.actions)).toBe(true);
    expect(Object.isFrozen(pageObject.actions[0])).toBe(true);
  });

  test('rejects invalid identity, capability, duplicate actions, and malformed JSON Schema', () => {
    const base = {
      description: 'invalid', operation: 'query' as const, inputSchema: {}, configSchema: {}, outputSchema: {}, handler: () => null,
    };
    expect(() => defineLocalFunction({ ...base, fqn: 'invalid' })).toThrow('FQN');
    expect(() => defineLocalFunction({ ...base, fqn: 'Template.Invalid.Capability', runtimeCapabilities: ['ambient' as never] })).toThrow('capability');
    expect(() => defineLocalFunction({ ...base, fqn: 'Template.Invalid.Configuration', runtimeCapabilities: ['configuration'] })).toThrow('appConfigurationRefs');
    expect(() => defineLocalFunction({ ...base, fqn: 'Template.Invalid.ConfigurationRef', appConfigurationRefs: ['app-settings'] })).toThrow('require runtime capability');
    expect(() => defineLocalFunction({ ...base, fqn: 'Template.Invalid.Schema', inputSchema: { type: 'not-a-type' } })).toThrow(ResourceSchemaValidationError);
    expect(() => definePageObject({
      fqn: 'Template.Demo.PageObject.Duplicate',
      selectionPolicy: { kind: 'served-page', pageName: 'demo', cardinality: 'exactly-one' },
      actions: [
        { fqn: 'Template.Demo.Action.Same', inputSchema: {}, outputSchema: {}, handler: () => null },
        { fqn: 'Template.Demo.Action.Same', inputSchema: {}, outputSchema: {}, handler: () => null },
      ],
    })).toThrow('duplicate');
  });
});

describe('Host Bundle definition catalog', () => {
  test('discovers heterogeneous definitions from a nested SkillModule host bundle without adding callable structural kinds', async () => {
    const root = await workspace();
    const fixture = await addSkillModuleHostBundle(root, 'nested');
    const snapshot = await createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot();
    expect(snapshot.ready).toBe(true);
    expect(snapshot.resources.map((resource) => [resource.kind, resource.fqn])).toContainEqual([
      'SkillModule',
      'Test.nested.Module.Search',
    ]);
    expect(snapshot.resources.map((resource) => [resource.kind, resource.fqn])).toContainEqual([
      'HostBundle',
      fixture.bundleFqn,
    ]);

    const catalog = createBundleDefinitionCatalog(snapshot);
    expect((await catalog.list()).map((definition) => [definition.kind, definition.fqn])).toEqual([
      ['PageObject', 'Test.nested.PageObject.Search'],
      ['PageWorkflow', 'Test.nested.PageWorkflow.Search'],
    ]);
    expect(await catalog.source('Test.nested.PageWorkflow.Search')).toMatchObject({
      bundleKind: 'HostBundle',
      bundleFqn: fixture.bundleFqn,
    });
    await expect(catalog.detail('Test.nested.Module.Search')).rejects.toThrow('not found');
    await expect(catalog.detail(fixture.bundleFqn)).rejects.toThrow('not found');
  });

  test('enforces HostBundle exports and rejects duplicate leaf FQNs across new and legacy profiles', async () => {
    const allowlistRoot = await workspace();
    await addSkillModuleHostBundle(allowlistRoot, 'allowlist', ['PageWorkflow']);
    const allowlistSnapshot = await createWorkspaceResourceCatalog(allowlistRoot, ['.agents/skills']).snapshot();
    await expect(createBundleDefinitionCatalog(allowlistSnapshot).list()).rejects.toThrow('may only export PageWorkflow');

    const duplicateRoot = await workspace();
    const fixture = await addSkillModuleHostBundle(duplicateRoot, 'profiles');
    await writeBundleResources(fixture.skillRoot, 'Test.profiles.Legacy', [
      'const api = globalThis.Codument;',
      'export const definitions = [api.definePageWorkflow({ fqn: "Test.profiles.PageWorkflow.Search", inputSchema: { type: "object" }, outputSchema: { type: "object" }, runtimeCapabilities: [], selectionPolicy: { kind: "external-page", urlPattern: "^https://example\\\\.test", cardinality: "exactly-one" }, defaultSelector: { direct: { byExternalPage: {} } }, start: (_runtime, _selector, invocation) => invocation.payload })];',
    ].join('\n'));
    const duplicateSnapshot = await createWorkspaceResourceCatalog(duplicateRoot, ['.agents/skills']).snapshot();
    await expect(createBundleDefinitionCatalog(duplicateSnapshot).list()).rejects.toThrow('Duplicate Bundle leaf definition FQN');
  });

  test('includes every declared HostBundle source in material identity and reloads helpers from a new generation', async () => {
    const root = await workspace();
    const fixture = await addHostBundle(root, 'closure');
    const firstSnapshot = await createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot();
    const firstBundle = firstSnapshot.resources.find((resource) => resource.fqn === fixture.bundleFqn);
    const firstDefinition = await createBundleDefinitionCatalog(firstSnapshot).detail('Test.closure.LocalFunction.Value');
    await expect(invokeLocalFunctionDefinition(firstDefinition as never, {}, {}, {})).resolves.toEqual({ value: 'first' });

    await fs.writeFile(path.join(fixture.bundleRoot, 'helper.ts'), 'export const value = "second";\n');
    const secondSnapshot = await createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot();
    const secondBundle = secondSnapshot.resources.find((resource) => resource.fqn === fixture.bundleFqn);
    const secondDefinition = await createBundleDefinitionCatalog(secondSnapshot).detail('Test.closure.LocalFunction.Value');

    expect(firstBundle?.materialDigest).toBeDefined();
    expect(secondBundle?.materialDigest).toBeDefined();
    expect(secondBundle?.materialDigest).not.toBe(firstBundle?.materialDigest);
    expect(secondSnapshot.revision).not.toBe(firstSnapshot.revision);
    await expect(invokeLocalFunctionDefinition(secondDefinition as never, {}, {}, {})).resolves.toEqual({ value: 'second' });
  });

  test('rejects undeclared local imports, escaped or duplicate sources, and entries outside the source closure', async () => {
    const cases = [
      { id: 'undeclared', sources: ['vfs://./entry.ts'] },
      { id: 'escaped', sources: ['vfs://./entry.ts', 'vfs://../outside.ts'] },
      { id: 'duplicate', sources: ['vfs://./entry.ts', 'vfs://./helper.ts', 'vfs://./helper.ts'] },
      { id: 'missing-entry', sources: ['vfs://./helper.ts'] },
    ] as const;
    for (const item of cases) {
      const root = await workspace();
      await addHostBundle(root, item.id, item.sources);
      const snapshot = await createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot();
      expect(snapshot.ready, item.id).toBe(false);
      expect(snapshot.diagnostics.some((diagnostic) => item.id === 'duplicate'
        ? diagnostic.code === 'WRITER_SCHEMA_INVALID'
        : diagnostic.code.startsWith('WORKSPACE_HOST_BUNDLE_')), item.id).toBe(true);
    }
  });

  test('rejects symlink sources and source drift after the workspace snapshot', async () => {
    const symlinkRoot = await workspace();
    const symlinkFixture = await addHostBundle(symlinkRoot, 'symlink');
    await fs.unlink(path.join(symlinkFixture.bundleRoot, 'helper.ts'));
    await fs.symlink(path.join(symlinkFixture.bundleRoot, 'entry.ts'), path.join(symlinkFixture.bundleRoot, 'helper.ts'));
    const symlinkSnapshot = await createWorkspaceResourceCatalog(symlinkRoot, ['.agents/skills']).snapshot();
    expect(symlinkSnapshot.ready).toBe(false);
    expect(symlinkSnapshot.diagnostics.some((diagnostic) => diagnostic.code === 'WORKSPACE_HOST_BUNDLE_SOURCE_SYMLINK')).toBe(true);

    const driftRoot = await workspace();
    const driftFixture = await addHostBundle(driftRoot, 'source-drift');
    const observed = await createWorkspaceResourceCatalog(driftRoot, ['.agents/skills']).snapshot();
    await fs.writeFile(path.join(driftFixture.bundleRoot, 'helper.ts'), 'export const value = "drifted";\n');
    await expect(createBundleDefinitionCatalog(observed).list()).rejects.toThrow('material changed');
  });

  test('loads only branded leaf definitions through real directory Bundle resources', async () => {
    const root = await workspace();
    await addBundleResources(root, 'demo', 'Template.Demo.Bundles', [
      'const api = globalThis.Codument;',
      'export const ignored = { kind: "LocalFunction", fqn: "Template.Forged.LocalFunction" };',
      'export const definitions = [',
      '  api.defineLocalFunction({ fqn: "Template.Demo.LocalFunction.Echo", operation: "query", inputSchema: { type: "object" }, configSchema: { type: "object" }, outputSchema: { type: "object" }, runtimeCapabilities: [], handler: (_runtime, input) => input }),',
      '  api.definePageWorkflow({ fqn: "Template.Demo.PageWorkflow.Open", inputSchema: { type: "object" }, outputSchema: { type: "object" }, runtimeCapabilities: [], selectionPolicy: { kind: "external-page", urlPattern: "^https://example\\\\.test", cardinality: "exactly-one" }, defaultSelector: { direct: { byExternalPage: {} } }, start: (_runtime, _selector, invocation) => invocation.payload }),',
      '];',
      '',
    ].join('\n'));
    const snapshot = await createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot();
    const catalog = createBundleDefinitionCatalog(snapshot);

    expect((await catalog.list()).map((definition) => definition.fqn)).toEqual([
      'Template.Demo.LocalFunction.Echo',
      'Template.Demo.PageWorkflow.Open',
    ]);
    expect(await catalog.detail('Template.Demo.LocalFunction.Echo')).toMatchObject({ kind: 'LocalFunction', operation: 'query' });
    await expect(catalog.detail('Template.Forged.LocalFunction')).rejects.toThrow('not found');
  });

  test('fails closed for duplicate definitions and package revision drift', async () => {
    const root = await workspace();
    const source = 'const api = globalThis.Codument; export const definitions = [api.definePageWorkflow({ fqn: "Template.Demo.PageWorkflow.Same", inputSchema: {}, outputSchema: {}, runtimeCapabilities: [], selectionPolicy: { kind: "external-page", urlPattern: "^https://example\\\\.test", cardinality: "exactly-one" }, defaultSelector: { direct: { byExternalPage: {} } }, start: (_runtime, _selector, invocation) => invocation.payload })];\n';
    await addBundleResources(root, 'first', 'Template.Demo.Bundles.First', source);
    await addBundleResources(root, 'second', 'Template.Demo.Bundles.Second', source);
    const duplicateSnapshot = await createWorkspaceResourceCatalog(root, ['.agents/skills']).snapshot();
    await expect(createBundleDefinitionCatalog(duplicateSnapshot).list()).rejects.toThrow('Duplicate');

    const driftRoot = await workspace();
    const skillRoot = await addBundleResources(driftRoot, 'drift', 'Template.Demo.Bundles.Drift', source);
    const observed = await createWorkspaceResourceCatalog(driftRoot, ['.agents/skills']).snapshot();
    await fs.appendFile(path.join(skillRoot, 'PageWorkflow/bundle/index.js'), '\nexport const changed = true;\n');
    await expect(createBundleDefinitionCatalog(observed).list()).rejects.toThrow('changed');
  }, 15_000);
});

describe('least-authority runtime adapters', () => {
  test('injects only declared capabilities and rejects unavailable capabilities before execution', async () => {
    let observed: unknown;
    const definition = defineLocalFunction({
      fqn: 'Template.Demo.LocalFunction.Clock',
      operation: 'query', inputSchema: objectSchema(), configSchema: objectSchema(), outputSchema: { type: 'number' },
      runtimeCapabilities: ['clock'],
      handler: (runtime) => { observed = runtime; return runtime.clock.now(); },
    });
    await expect(invokeLocalFunctionDefinition(definition, { clock: { now: () => 42 }, ids: { randomUUID: () => 'secret' } }, {}, {})).resolves.toBe(42);
    expect(observed).toEqual({ clock: { now: expect.any(Function) } });
    expect(Object.isFrozen(observed)).toBe(true);
    await expect(invokeLocalFunctionDefinition(definition, {}, {}, {})).rejects.toThrow('clock');
  });

  test('validates all three adapters without mutating input values', async () => {
    const input = { value: 'ok', extra: true };
    const local = defineLocalFunction({
      fqn: 'Template.Demo.LocalFunction.Validate', operation: 'action', inputSchema: objectSchema(['value']), configSchema: objectSchema(), outputSchema: objectSchema(['value']), runtimeCapabilities: [], handler: (_runtime, value) => value,
    });
    await expect(invokeLocalFunctionDefinition(local, {}, input, {})).rejects.toBeInstanceOf(ResourceSchemaValidationError);
    expect(input).toEqual({ value: 'ok', extra: true });

    const workflowSelector: PageWorkflowSelector = { direct: { byExternalPage: {} } };
    const workflow = definePageWorkflow({
      fqn: 'Template.Demo.PageWorkflow.Validate', inputSchema: objectSchema(), outputSchema: { type: 'string' }, runtimeCapabilities: [],
      selectionPolicy: { kind: 'external-page', urlPattern: '^https://example\\.test', cardinality: 'exactly-one' },
      defaultSelector: workflowSelector, start: () => 1 as never,
    });
    await expect(startPageWorkflowDefinition(workflow, {}, workflowSelector, { type: workflow.fqn, kind: 'command', payload: {} }, null)).rejects.toMatchObject({ phase: 'output' });

    const pageObject = definePageObject({
      fqn: 'Template.Demo.PageObject.Validate', runtimeCapabilities: [],
      selectionPolicy: { kind: 'served-page', pageName: 'demo', cardinality: 'exactly-one' },
      actions: [{ fqn: 'Template.Demo.PageObject.Validate.Read', inputSchema: objectSchema(['value']), outputSchema: objectSchema(), handler: () => ({}) }],
    });
    const actionFqn = 'Template.Demo.PageObject.Validate.Read';
    await expect(invokePageObjectActionDefinition(
      pageObject, actionFqn, {}, { byServedPageRef: 'target' }, { type: actionFqn, kind: 'command', payload: {} }, null,
    )).rejects.toMatchObject({ phase: 'input' });
  });

  test('passes runtime first and separates selector, invocation and config for targeted leaves', async () => {
    const workflowSelector: PageWorkflowSelector = Object.freeze({
      direct: Object.freeze({ byExternalPage: Object.freeze({}) }),
    });
    const objectSelector: PageObjectSelector = Object.freeze({ byServedPageRef: 'page_target_one' });
    let workflowObserved: unknown;
    let actionObserved: unknown;
    const workflow = definePageWorkflow({
      fqn: 'Template.Demo.PageWorkflow.RuntimeFirst',
      inputSchema: objectSchema(['value']), outputSchema: objectSchema(['value']),
      runtimeCapabilities: ['page'],
      selectionPolicy: { kind: 'external-page', urlPattern: '^https://example\\.test/', cardinality: 'exactly-one' },
      defaultSelector: workflowSelector,
      activation: { onMissing: 'open', url: 'https://example.test/' },
      start: (runtime, selector, invocation, config) => {
        workflowObserved = { runtime, selector, invocation, config };
        return invocation.payload;
      },
    });
    const pageObject = definePageObject({
      fqn: 'Template.Demo.PageObject.RuntimeFirst', runtimeCapabilities: ['page'],
      selectionPolicy: { kind: 'served-page', pageName: 'demo', cardinality: 'exactly-one' },
      actions: [{
        fqn: 'Template.Demo.PageObject.RuntimeFirst.Write',
        inputSchema: objectSchema(['value']), outputSchema: objectSchema(['value']),
        handler: (runtime, selector, invocation, config) => {
          actionObserved = { runtime, selector, invocation, config };
          return invocation.payload;
        },
      }],
    });
    const page = Object.freeze({ session: Object.freeze({ send: async () => ({}), listTargets: async () => [] }) });
    await expect(startPageWorkflowDefinition(
      workflow, { page }, workflowSelector,
      { type: workflow.fqn, kind: 'command', payload: { value: 'workflow' } }, null,
    )).resolves.toEqual({ value: 'workflow' });
    await expect(invokePageObjectActionDefinition(
      pageObject, 'Template.Demo.PageObject.RuntimeFirst.Write', { page }, objectSelector,
      { type: 'Template.Demo.PageObject.RuntimeFirst.Write', kind: 'command', payload: { value: 'action' } }, null,
    )).resolves.toEqual({ value: 'action' });
    expect(workflowObserved).toEqual({
      runtime: { page }, selector: workflowSelector,
      invocation: { type: workflow.fqn, kind: 'command', payload: { value: 'workflow' } }, config: null,
    });
    expect(actionObserved).toEqual({
      runtime: { page }, selector: objectSelector,
      invocation: { type: 'Template.Demo.PageObject.RuntimeFirst.Write', kind: 'command', payload: { value: 'action' } }, config: null,
    });
    expect(Object.isFrozen((workflowObserved as { selector: unknown }).selector)).toBe(true);
    expect(Object.isFrozen((workflowObserved as { invocation: unknown }).invocation)).toBe(true);
    expect(Object.isFrozen((actionObserved as { selector: unknown }).selector)).toBe(true);
    expect(Object.isFrozen((actionObserved as { invocation: unknown }).invocation)).toBe(true);
  });

  test('rejects non-closed selectors and selector copies in payload before executing handlers', async () => {
    let executions = 0;
    const pageObject = definePageObject({
      fqn: 'Template.Demo.PageObject.ClosedSelector', runtimeCapabilities: [],
      selectionPolicy: { kind: 'served-page', pageName: 'demo', cardinality: 'exactly-one' },
      actions: [{
        fqn: 'Template.Demo.PageObject.ClosedSelector.Write',
        inputSchema: objectSchema(), outputSchema: objectSchema(),
        handler: () => { executions += 1; return {}; },
      }],
    });
    const invoke = (selector: unknown, payload: unknown = {}) => invokePageObjectActionDefinition(
      pageObject, 'Template.Demo.PageObject.ClosedSelector.Write', {}, selector as PageObjectSelector,
      { type: 'Template.Demo.PageObject.ClosedSelector.Write', kind: 'command', payload }, null,
    );
    await expect(invoke({})).rejects.toThrow('selector');
    await expect(invoke({ byServedPageRef: 'one', byExternalPage: {} })).rejects.toThrow('selector');
    await expect(invoke({ byServedPageRef: 'one', extra: true })).rejects.toThrow('selector');
    await expect(invoke({ byExternalPage: {} })).rejects.toThrow('selector');
    await expect(invoke({ byServedPageRef: 'one' }, { targetRef: 'one' })).rejects.toThrow('payload');
    await expect(invoke({ byServedPageRef: 'one' }, { outputPath: 'output/result.json' })).rejects.toThrow('payload');
    expect(executions).toBe(0);
  });
});
