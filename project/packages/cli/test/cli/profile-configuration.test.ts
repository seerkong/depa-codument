import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createConfigurationProfileCatalog } from '../../src/cli/resources/profile-configuration';
import { createWorkspaceResourceCatalog } from '../../src/cli/resources/workspace-resource-catalog';
import { dispatchCommand } from '../../src/cli/command-registry';
import { createCommandRuntime } from '../../src/cli/runtime';
import { createProfiledBrowserWebApiEffect } from '../../src/cli/effects/profiled-browser-web-api';
import { createBundleDefinitionCatalog } from '../../src/cli/resources/bundle-materializer';
import { invokeBrowserWebApiDefinition } from '../../src/cli/resources/schema-validator';
import { skillAppKindDefinitionSource, writeBundleResources, writeSkillApp } from '../fixtures/xnl-skill-app';

const ENVELOPE = 'halfcode.resource-envelope/v1';

afterEach(() => { process.exitCode = 0; });

async function fixture(): Promise<{ root: string; skill: string; profile: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-profile-'));
  const skill = path.join(root, '.agents/skills/profile-demo');
  await writeSkillApp(skill, 'profile-demo');
  await fs.mkdir(path.join(skill, 'KindDefinitions/ConfigurationProfile'), { recursive: true });
  await fs.mkdir(path.join(skill, 'KindDefinitions/DatabaseConnection'), { recursive: true });
  await fs.writeFile(
    path.join(skill, 'KindDefinitions/ConfigurationProfile/manifest.xnl'),
    skillAppKindDefinitionSource('ConfigurationProfile'),
  );
  await fs.writeFile(
    path.join(skill, 'KindDefinitions/DatabaseConnection/manifest.xnl'),
    skillAppKindDefinitionSource('DatabaseConnection'),
  );
  const manifest = path.join(skill, 'manifest.xnl');
  await fs.writeFile(manifest, (await fs.readFile(manifest, 'utf8')).replace(
    '  ]>',
    [
      '    <ManifestResourceCatalog #database_connections { resourceKind = "DatabaseConnection" root = "vfs://./DatabaseConnection/" entry = "manifest.xnl" }>',
      '    <ManifestResourceCatalog #config_profiles { resourceKind = "ConfigurationProfile" root = "vfs://./config-profiles/" entry = "manifest.xnl" }>',
      '  ]>',
    ].join('\n'),
  ));
  await fs.mkdir(path.join(skill, 'DatabaseConnection/cache'), { recursive: true });
  await fs.writeFile(path.join(skill, 'DatabaseConnection/cache/manifest.xnl'), [
    `<DatabaseConnection #Test.Database.Cache envelopeVersion="${ENVELOPE}" specVersion=1 {`,
    '  description = "Fixture database"',
    '}>',
    '',
  ].join('\n'));
  const profile = path.join(skill, 'config-profiles/personal');
  await fs.mkdir(path.join(profile, 'app'), { recursive: true });
  await fs.writeFile(path.join(profile, 'manifest.xnl'), [
    `<ConfigurationProfile #Test.ProfileDemo.ConfigurationProfile.Personal envelopeVersion="${ENVELOPE}" specVersion=1 {`,
    '  profile = "personal"',
    '}>',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(profile, 'app/web-api-endpoints.yaml'), [
    `envelopeVersion: ${ENVELOPE}`,
    'specVersion: 1',
    'kind: ConfigBinding',
    'fqn: Test.ProfileDemo.Configuration.Personal.WebApiEndpoints',
    'spec:',
    '  targetRef:',
    '    kind: AppConfiguration',
    '    name: web-api-endpoints',
    '  value:',
    '    endpoints:',
    '      records:',
    '        baseUrl: https://example.test',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(profile, 'app/private-flag.yaml'), [
    `envelopeVersion: ${ENVELOPE}`,
    'specVersion: 1',
    'kind: ConfigBinding',
    'fqn: Test.ProfileDemo.Configuration.Personal.PrivateFlag',
    'spec:',
    '  targetRef:',
    '    kind: AppConfiguration',
    '    name: private-flag',
    '  value:',
    '    enabled: true',
    '',
  ].join('\n'));
  await fs.mkdir(path.join(profile, 'kinds/DatabaseConnection/cache'), { recursive: true });
  await fs.writeFile(path.join(profile, 'kinds/DatabaseConnection/cache/connection.yaml'), [
    `envelopeVersion: ${ENVELOPE}`,
    'specVersion: 1',
    'kind: ConfigBinding',
    'fqn: Test.ProfileDemo.Configuration.Personal.Database.Cache',
    'spec:',
    '  targetRef:',
    '    kind: DatabaseConnection',
    '    name: cache',
    '    fqn: Test.Database.Cache',
    '  value:',
    '    driver: sqlite',
    '    sqlite:',
    '      path: workspace://.runtime/profile-cache.sqlite',
    '',
  ].join('\n'));
  return { root, skill, profile };
}

function catalog(root: string) {
  return createConfigurationProfileCatalog(createWorkspaceResourceCatalog(root, ['.agents/skills']));
}

describe('profile-owned ConfigurationProfile material', () => {
  test('materializes a confined XNL profile and frozen app ConfigBinding', async () => {
    const { root } = await fixture();
    const profile = await catalog(root).detail('personal');
    expect(profile.fqn).toBe('Test.ProfileDemo.ConfigurationProfile.Personal');
    const binding = profile.app.get('web-api-endpoints');
    expect(binding).toMatchObject({
      targetRef: { kind: 'AppConfiguration', name: 'web-api-endpoints' },
      value: { endpoints: { records: { baseUrl: 'https://example.test' } } },
      sourceContentDigest: expect.stringMatching(/^sha256:/),
      effectiveContentDigest: expect.stringMatching(/^sha256:/),
      resolution: {
        writer: { specVersion: 1, contractFingerprint: expect.stringMatching(/^sha256:/) },
        reader: {
          readerId: 'cli-host.ConfigBinding.reader/v1',
          specVersion: 1,
          implementationFingerprint: expect.stringMatching(/^sha256:/),
        },
      },
    });
    expect(Object.isFrozen(binding!.value)).toBe(true);
  });

  test('rejects removed ConfigBinding apiVersion metadata instead of translating it', async () => {
    const { root, profile } = await fixture();
    await fs.writeFile(path.join(profile, 'app/web-api-endpoints.yaml'), [
      'apiVersion: codument.config/v1',
      'kind: ConfigBinding',
      'fqn: Test.ProfileDemo.Configuration.Legacy',
      'spec:',
      '  targetRef:',
      '    kind: AppConfiguration',
      '    name: web-api-endpoints',
      '  value: {}',
      '',
    ].join('\n'));
    await expect(catalog(root).list()).rejects.toThrow(
      'ConfigBinding must contain only envelopeVersion, fqn, kind, spec, specVersion',
    );
  });

  test('fails closed for binding schema errors without leaking host paths or values', async () => {
    const { root, profile } = await fixture();
    const file = path.join(profile, 'app/web-api-endpoints.yaml');
    await fs.writeFile(file, [
      `envelopeVersion: ${ENVELOPE}`,
      'specVersion: 1',
      'kind: ConfigBinding',
      'fqn: Test.ProfileDemo.Invalid',
      'spec:',
      '  targetRef:',
      '    kind: AppConfiguration',
      '    name: wrong-name',
      '  value: super-secret-value',
      '',
    ].join('\n'));
    const message = await catalog(root).list().then(
      () => '',
      (error: unknown) => error instanceof Error ? error.message : String(error),
    );
    expect(message).toContain('spec.targetRef.name must be web-api-endpoints');
    expect(message).not.toContain(root);
    expect(message).not.toContain('super-secret-value');
  });

  test('rejects invalid ConfigBinding materials through ConfigurationProfile and aggregate validation', async () => {
    const { root, profile } = await fixture();
    await fs.writeFile(path.join(profile, 'app/web-api-endpoints.yaml'), [
      `envelopeVersion: ${ENVELOPE}`,
      'specVersion: 1',
      'kind: ConfigBinding',
      'fqn: Test.ProfileDemo.Invalid',
      'spec:',
      '  targetRef:',
      '    kind: AppConfiguration',
      '    name: wrong-name',
      '  value: super-secret-value',
      '',
    ].join('\n'));
    const runtime = createCommandRuntime(root);
    for (const command of [
      ['ConfigurationProfile', 'validate'],
      ['ConfigurationProfile', 'validate', '--fqn', 'Test.ProfileDemo.ConfigurationProfile.Personal'],
      ['Resource', 'validate'],
    ]) {
      const result = await dispatchCommand(command, runtime, true);
      expect(result).toMatchObject({ code: 1, message: expect.stringContaining('spec.targetRef.name must be web-api-endpoints') });
      const message = String(result.message);
      expect(message).not.toContain(root);
      expect(message).not.toContain('super-secret-value');
    }
  });

  test('rejects duplicate ConfigBinding FQNs before exposing a partial profile', async () => {
    const { root, profile } = await fixture();
    await fs.writeFile(path.join(profile, 'app/secondary.yaml'), [
      `envelopeVersion: ${ENVELOPE}`,
      'specVersion: 1',
      'kind: ConfigBinding',
      'fqn: Test.ProfileDemo.Configuration.Personal.WebApiEndpoints',
      'spec:',
      '  targetRef:',
      '    kind: AppConfiguration',
      '    name: secondary',
      '  value: {}',
      '',
    ].join('\n'));
    await expect(catalog(root).list()).rejects.toThrow('duplicate ConfigBinding fqn');
  });

  test('rejects profile-material symlink escapes and duplicate target identity', async () => {
    const { root, profile } = await fixture();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-profile-outside-'));
    await fs.writeFile(path.join(outside, 'escaped.yaml'), 'not-used');
    await fs.symlink(outside, path.join(profile, 'app/linked'));
    await expect(catalog(root).list()).rejects.toThrow('must not contain symbolic links');

    await fs.unlink(path.join(profile, 'app/linked'));
    await fs.writeFile(path.join(profile, 'kinds/DatabaseConnection/cache/one.yaml'), [
      `envelopeVersion: ${ENVELOPE}`, 'specVersion: 1', 'kind: ConfigBinding', 'fqn: Test.One', 'spec:',
      '  targetRef:', '    kind: DatabaseConnection', '    name: cache', '    fqn: Test.Database.Cache',
      '  value: {}', '',
    ].join('\n'));
    await fs.writeFile(path.join(profile, 'kinds/DatabaseConnection/cache/two.yaml'), [
      `envelopeVersion: ${ENVELOPE}`, 'specVersion: 1', 'kind: ConfigBinding', 'fqn: Test.Two', 'spec:',
      '  targetRef:', '    kind: DatabaseConnection', '    name: cache', '    fqn: Test.Database.Cache',
      '  value: {}', '',
    ].join('\n'));
    await expect(catalog(root).list()).rejects.toThrow('duplicate ConfigBinding target identity');
  });

  test('projects only the selected frozen profile through runtime.resources.configuration', async () => {
    const { root, skill } = await fixture();
    const sandbox = path.join(skill, 'config-profiles/sandbox');
    await fs.mkdir(path.join(sandbox, 'app'), { recursive: true });
    await fs.writeFile(path.join(sandbox, 'manifest.xnl'), [
      `<ConfigurationProfile #Test.ProfileDemo.ConfigurationProfile.Sandbox envelopeVersion="${ENVELOPE}" specVersion=1 {`,
      '  profile = "sandbox"',
      '}>',
      '',
    ].join('\n'));
    await fs.writeFile(path.join(sandbox, 'app/web-api-endpoints.yaml'), [
      `envelopeVersion: ${ENVELOPE}`, 'specVersion: 1', 'kind: ConfigBinding',
      'fqn: Test.ProfileDemo.Configuration.Sandbox.WebApiEndpoints', 'spec:',
      '  targetRef:', '    kind: AppConfiguration', '    name: web-api-endpoints', '  value:', '    endpoints:',
      '      records:', '        baseUrl: https://sandbox.example.test', '',
    ].join('\n'));
    await fs.mkdir(path.join(root, '.codument'), { recursive: true });
    await fs.writeFile(path.join(root, '.codument/config.json'), JSON.stringify({
      tools: [], pageSources: { skills: true, workspace: false }, configuration: { defaultProfile: 'personal' }, updated_at: '',
    }));
    await writeBundleResources(skill, 'Test.ProfileDemo.Bundle', `
      const api = globalThis.Codument;
      export const profileProbe = api.defineLocalFunction({
        fqn: 'Test.ProfileDemo.LocalFunction.ProfileProbe', operation: 'query', description: 'Reads profile app config',
        runtimeCapabilities: ['configuration'],
        appConfigurationRefs: ['web-api-endpoints'],
        inputSchema: { type: 'object', additionalProperties: false },
        configSchema: { type: 'object', properties: { profile: { type: 'string' } }, additionalProperties: false },
        outputSchema: { type: 'object', properties: { profile: { type: 'string' }, baseUrl: { type: 'string' }, frozen: { const: true }, enumerable: { const: false } }, required: ['profile', 'baseUrl', 'frozen', 'enumerable'], additionalProperties: false },
        handler(runtime) {
          const endpoints = runtime.resources.configuration.app.get('web-api-endpoints');
          return { profile: runtime.resources.configuration.profile, baseUrl: endpoints.endpoints.records.baseUrl, frozen: Object.isFrozen(endpoints), enumerable: typeof runtime.resources.configuration.app.keys === 'function' };
        },
      });
      export const undeclaredConfigurationProbe = api.defineLocalFunction({
        fqn: 'Test.ProfileDemo.LocalFunction.UndeclaredConfigurationProbe', operation: 'query', description: 'Must not read undeclared configuration',
        runtimeCapabilities: ['configuration'], appConfigurationRefs: ['web-api-endpoints'],
        inputSchema: { type: 'object', additionalProperties: false }, configSchema: { type: 'null' }, outputSchema: { type: 'object' },
        handler(runtime) { return runtime.resources.configuration.app.get('private-flag'); },
      });
    `);
    const selected = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.ProfileProbe', '--config', '{"profile":"untrusted"}',
    ], createCommandRuntime(root), true);
    expect(selected).toMatchObject({ code: 0, data: { result: { profile: 'personal', baseUrl: 'https://example.test', frozen: true, enumerable: false } } });
    const explicit = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.ProfileProbe', '--config', '{}', '--profile', 'sandbox',
    ], createCommandRuntime(root), true);
    expect(explicit).toMatchObject({ code: 0, data: { result: { profile: 'sandbox', baseUrl: 'https://sandbox.example.test' } } });
    const undeclared = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.UndeclaredConfigurationProbe', '--config', 'null',
    ], createCommandRuntime(root), true);
    expect(undeclared).toMatchObject({ code: 1, message: expect.stringContaining("App configuration 'private-flag' is not declared") });
    const missing = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.ProfileProbe', '--config', '{}', '--profile', 'missing',
    ], createCommandRuntime(root), true);
    expect(missing).toMatchObject({ code: 1, message: expect.stringContaining('ConfigurationProfile was not found') });
  });

  test('opens SQLite only from a declared DatabaseConnection resource', async () => {
    const { root, skill, profile } = await fixture();
    await writeBundleResources(skill, 'Test.ProfileDemo.DatabaseBundle', `
      const api = globalThis.Codument;
      export const databaseProbe = api.defineLocalFunction({
        fqn: 'Test.ProfileDemo.LocalFunction.DatabaseProbe', operation: 'action', description: 'Uses declared database',
        runtimeCapabilities: ['database'], databaseConnections: ['Test.Database.Cache'],
        inputSchema: { type: 'object', properties: { connection: { type: 'string' } }, required: ['connection'], additionalProperties: false },
        configSchema: { type: 'null' },
        outputSchema: { type: 'object', properties: { fqn: { const: 'Test.Database.Cache' }, rows: { const: 1 } }, required: ['fqn', 'rows'], additionalProperties: false },
        handler(runtime, input) {
          const connection = runtime.resources.databaseConnections.require(input.connection);
          const database = runtime.effects.database.open(connection);
          database.exec('create table if not exists profile_probe (value text)');
          database.exec("insert into profile_probe values ('ok')");
          const rows = database.query('select count(*) as count from profile_probe').get().count;
          database.close();
          return { fqn: connection.fqn, rows };
        },
      });
    `);
    const opened = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.DatabaseProbe', '--input', '{"connection":"Test.Database.Cache"}',
    ], createCommandRuntime(root), true);
    expect(opened).toMatchObject({ code: 0, data: { result: { fqn: 'Test.Database.Cache', rows: 1 } } });
    expect((await fs.stat(path.join(root, '.runtime/profile-cache.sqlite'))).isFile()).toBe(true);
    const unclaimed = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.DatabaseProbe', '--input', '{"connection":"Test.Database.Other"}',
    ], createCommandRuntime(root), true);
    expect(unclaimed).toMatchObject({ code: 1, message: expect.stringContaining('is not declared by this LocalFunction') });

    const binding = path.join(profile, 'kinds/DatabaseConnection/cache/connection.yaml');
    const original = await fs.readFile(binding, 'utf8');
    await fs.writeFile(binding, original.replace('workspace://.runtime/profile-cache.sqlite', 'workspace://../outside.sqlite'));
    const parentEscape = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.DatabaseProbe', '--input', '{"connection":"Test.Database.Cache"}',
    ], createCommandRuntime(root), true);
    expect(parentEscape).toMatchObject({ code: 1, message: expect.stringContaining('escapes workspace') });

    await fs.writeFile(binding, original.replace('workspace://.runtime/profile-cache.sqlite', 'workspace:///tmp/outside.sqlite'));
    const absolute = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.DatabaseProbe', '--input', '{"connection":"Test.Database.Cache"}',
    ], createCommandRuntime(root), true);
    expect(absolute).toMatchObject({ code: 1, message: expect.stringContaining('must be workspace-confined') });

    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-profile-db-outside-'));
    await fs.symlink(outside, path.join(root, 'linked'));
    await fs.writeFile(binding, original.replace('workspace://.runtime/profile-cache.sqlite', 'workspace://linked/outside.sqlite'));
    const symlink = await dispatchCommand([
      'LocalFunction', 'invoke', '--fqn', 'Test.ProfileDemo.LocalFunction.DatabaseProbe', '--input', '{"connection":"Test.Database.Cache"}',
    ], createCommandRuntime(root), true);
    expect(symlink).toMatchObject({ code: 1, message: expect.stringContaining('contains a symbolic link') });
  });

  test('materializes BrowserWebApi leaves and sends only endpoint-relative requests through the selected provider', async () => {
    const { root, skill } = await fixture();
    await writeBundleResources(skill, 'Test.ProfileDemo.BrowserBundle', `
      const api = globalThis.Codument;
      export const apiProbe = api.defineBrowserWebApi({
        fqn: 'Test.ProfileDemo.BrowserWebApi.Probe', endpointKey: 'records', description: 'Fetches records',
        inputSchema: { type: 'object', additionalProperties: false }, outputSchema: { type: 'object' },
        handler: async (runtime, _input, config) => {
          if (config !== null) throw new Error('BrowserWebApi config must be null');
          return runtime.effects.browserWebApi.fetch({ path: '/v1/records' });
        },
      });
    `);
    const resources = createWorkspaceResourceCatalog(root, ['.agents/skills']);
    const definition = await createBundleDefinitionCatalog(resources).detail('Test.ProfileDemo.BrowserWebApi.Probe');
    expect(definition).toMatchObject({ kind: 'BrowserWebApi', endpointKey: 'records' });
    const calls: string[] = [];
    const effect = createProfiledBrowserWebApiEffect({
      profile: await catalog(root).detail('personal'), endpointKey: 'records',
      provider: {
        transport: 'mdd-browser-robot', session: 'fixture',
        async browserFetch(request) {
          calls.push(request.url);
          return { ok: true, status: 200, statusText: 'OK', url: request.url, contentType: 'application/json', text: '{}' };
        },
      },
    });
    await expect(invokeBrowserWebApiDefinition(definition as Extract<typeof definition, { kind: 'BrowserWebApi' }>, {
      browserWebApi: effect,
    }, {})).resolves.toMatchObject({ status: 200, url: 'https://example.test/v1/records' });
    expect(calls).toEqual(['https://example.test/v1/records']);
    await expect(effect.fetch({ path: 'https://attacker.test/' })).rejects.toThrow('must begin with one relative /');

    const runtime = createCommandRuntime(root);
    expect(await dispatchCommand(['ConfigurationProfile', 'list'], runtime, true)).toMatchObject({ code: 0, data: { count: 1 } });
    expect(await dispatchCommand(['DatabaseConnection', 'detail', '--fqn', 'Test.Database.Cache'], runtime, true)).toMatchObject({ code: 0, data: { kind: 'DatabaseConnection' } });
    runtime.defaultBrowserSelection = async () => ({ transport: 'mdd-browser-robot', backend: { transport: 'chrome-extension' } });
    runtime.browserProviderFor = (selection) => ({
      transport: selection.transport,
      session: selection.session ?? 'fixture',
      async browserFetch(request) {
        return { ok: true, status: 200, statusText: 'OK', url: request.url, contentType: 'application/json', text: '{"ok":true}' };
      },
    });
    const invoked = await dispatchCommand([
      'BrowserWebApi', 'invoke', '--fqn', 'Test.ProfileDemo.BrowserWebApi.Probe', '--profile', 'personal',
    ], runtime, true);
    expect(invoked).toMatchObject({
      code: 0,
      data: { profile: 'personal', endpointKey: 'records', transport: 'mdd-browser-robot', result: { status: 200 } },
    });
  });
});
