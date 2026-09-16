import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BIN, DISPLAY_NAME, PACKAGE_NAME, SKILLS, WORKSPACE_DIR } from '../../src/identity';
import { commandHelp, commandPaths, dispatchCommand, resolveCommandPath, rootHelp } from '../../src/cli/command-registry';
import { createCommandRuntime } from '../../src/cli/runtime';
import { managedInstructionBody } from '../../src/cli/install';
import { CODUMENT_OPERATION_ROUTES } from 'depa-codument-product-capsule/global-guidance';

describe('codument public surface', () => {
  test('root help documents agent selection and descriptive English operations', () => {
    const help = rootHelp();
    expect(help).toContain(`${BIN} init --agent=claude,codex,eidolon`);
    expect(help).not.toContain(`${BIN} demo`);
    for (const route of CODUMENT_OPERATION_ROUTES) {
      expect(route.description).toMatch(/^[A-Za-z][\x20-\x7e]+\.$/);
      expect(route.description.split(' ').length).toBeGreaterThanOrEqual(8);
      expect(help).toContain(route.description);
    }
  });
  test('identity is centralized', () => {
    expect(BIN).toBe('depa-codument');
    expect(PACKAGE_NAME).toMatch(/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/);
    expect(DISPLAY_NAME).toBe('DEPA Codument');
    expect(WORKSPACE_DIR).toBe('.codument');
    expect(SKILLS).toEqual(['codument-demo']);
    expect(managedInstructionBody()).not.toContain(`${BIN}-workspace`);
  });

  test('command registry exposes the required tree including the optional MCP App host', () => {
    expect(commandPaths()).toEqual([
      ...['track', 'Track'].flatMap(name => [
        [name], [name, 'create'], [name, 'transition'], [name, 'gap-round'], [name, 'task'],
        [name, 'task', 'transition'], [name, 'task', 'complete'], [name, 'context'], [name, 'ready'], [name, 'verify'],
      ]),
      ...['mission', 'Mission'].flatMap(name => [
        [name], [name, 'create'], [name, 'transition'], [name, 'gap-round'], [name, 'task'],
        [name, 'task', 'transition'], [name, 'archive'], [name, 'bind-track'],
      ]),
      ['decisions'], ['decisions', 'create'], ['decisions', 'validate'], ['decisions', 'frontier'],
      ['project'], ['project', 'bind'], ['project', 'bindings'], ['project', 'unbind'],
      ['list'], ['show'],
      ['validate'],
      ['schema'],
      ['std'], ['std', 'lint'],
      ['artifact'], ['artifact', 'sync'],
      ['archive'],
      ['migrate'], ['migrate', 'inspect'], ['migrate', 'plan'], ['migrate', 'apply'], ['migrate', 'verify'], ['migrate', 'guide'],
      ['upgrade-resource'], ['upgrade-track'],
      ['status'],
      ['init-global'],
      ['init-workspace'],
      ['init'],
      ['upgrade-global'],
      ['upgrade-workspace'],
      ['upgrade'],
      ['serve'],
      ['serve', 'start'],
      ['serve', 'stop'],
      ['serve', 'restart'],
      ['serve', 'status'],
      ['Resource'],
      ['Resource', 'tree'],
      ['Resource', 'validate'],
      ['SOP'],
      ['SOP', 'list'],
      ['SOP', 'detail'],
      ['SOP', 'validate'],
      ['SOP', 'graph'],
      ['SOP', 'notebook'],
      ['SOP', 'notebook', 'init'],
      ['Site'],
      ['Site', 'list'],
      ['Site', 'detail'],
      ['Site', 'validate'],
      ['PageBundle'],
      ['PageBundle', 'list'],
      ['PageBundle', 'detail'],
      ['PageBundle', 'validate'],
      ['Page'],
      ['Page', 'list'],
      ['Page', 'detail'],
      ['Page', 'validate'],
      ['mcp-app'],
      ['mcp-app', 'serve'],
      ['mcp-app', 'config'],
      ['LocalFunction'],
      ['LocalFunction', 'list'],
      ['LocalFunction', 'detail'],
      ['LocalFunction', 'validate'],
      ['LocalFunction', 'invoke'],
      ['ConfigurationProfile'],
      ['ConfigurationProfile', 'list'],
      ['ConfigurationProfile', 'detail'],
      ['ConfigurationProfile', 'validate'],
      ['DatabaseConnection'],
      ['DatabaseConnection', 'list'],
      ['DatabaseConnection', 'detail'],
      ['DatabaseConnection', 'validate'],
      ['BrowserWebApi'],
      ['BrowserWebApi', 'list'],
      ['BrowserWebApi', 'detail'],
      ['BrowserWebApi', 'validate'],
      ['BrowserWebApi', 'invoke'],
      ['PageWorkflow'],
      ['PageWorkflow', 'list'],
      ['PageWorkflow', 'detail'],
      ['PageWorkflow', 'validate'],
      ['PageWorkflow', 'start'],
      ['PageWorkflow', 'get'],
      ['PageObject'],
      ['PageObject', 'list'],
      ['PageObject', 'detail'],
      ['PageObject', 'validate'],
      ['PageObject', 'invoke'],
      ['run-web-api'],
      ['invoke'],
      ['exec'],
      ...['archive-mission', 'archive-track', 'artifact-sync', 'discuss', 'gap-loop',
        'impl-mission', 'impl-quick', 'impl-track', 'maintain-track', 'migrate-operation', 'plan-mission',
        'plan-track', 'validate-operation', 'verify'].map(name => [name]),
    ]);
    const publicHelp = [rootHelp(), commandHelp(['invoke']), commandHelp(['exec']), commandHelp(['LocalFunction'])].join('\n');
    expect(publicHelp).not.toMatch(/ExampleForbiddenBusinessSurface/i);
    expect(publicHelp).not.toMatch(/Claude session/i);
    const serveHelp = [
      commandHelp(['serve']),
      commandHelp(['serve', 'start']),
      commandHelp(['serve', 'stop']),
      commandHelp(['serve', 'restart']),
      commandHelp(['serve', 'status']),
    ];
    for (const help of serveHelp) {
      expect(help).toContain('Usage:');
      expect(help).toContain('Examples:');
      expect(help).toContain('Options:');
    }
    expect(serveHelp[0]).toContain('restart');
    expect(serveHelp[1]).toContain('reuse');
    expect(serveHelp[2]).toContain('recorded');
    expect(serveHelp[3]).toContain('fresh');
    expect(serveHelp[4]).toContain('status');
  });

  test('unknown commands fail closed', async () => {
    expect(dispatchCommand(['not-a-command'], createCommandRuntime())).rejects.toThrow('Unknown command');
    expect(resolveCommandPath(['ApplicationSOP', 'list'])).toEqual([]);
    await expect(dispatchCommand(['ApplicationSOP', 'list'], createCommandRuntime(), true)).rejects.toThrow('Unknown command');
  });

  test('mcp-app config returns a copy-only Claude Desktop snippet', async () => {
    const result = await dispatchCommand(['mcp-app', 'config'], createCommandRuntime(process.cwd()), true);
    expect(result.code).toBe(0);
    expect(result.data).toMatchObject({
      command: 'mcp-app-config',
      mutated: false,
      config: {
        mcpServers: {
          'depa-codument': {
            command: expect.any(String),
            args: [expect.stringContaining('index.ts'), 'mcp-app', 'serve', '--transport', 'stdio'],
          },
        },
      },
    });
  });

  test('registry option schema rejects unknown flags and missing values before handlers', async () => {
    const runtime = createCommandRuntime(process.cwd());
    await expect(dispatchCommand(['status', '--unknown'], runtime, true)).rejects.toThrow('Unknown option');
    await expect(dispatchCommand(['serve', '--port'], runtime, true)).rejects.toThrow('requires a value');
    await expect(dispatchCommand(['serve', '--port='], runtime, true)).rejects.toThrow('requires a value');
    await expect(dispatchCommand(['serve', '--port', '123', '--port'], runtime, true)).rejects.toThrow('cannot be repeated');
    await expect(dispatchCommand(['status', '--json=value'], runtime, true)).rejects.toThrow('does not accept a value');
    await expect(dispatchCommand(['demo'], runtime, true)).rejects.toThrow('Unknown command');
    expect(rootHelp()).not.toMatch(/^  demo\s/m);
  });

  test('invalid explicit agent scopes fail before every scoped command constructs a runtime', async () => {
    const entry = resolve(import.meta.dir, '../../src/cli/index.ts');
    for (const command of [
      ['serve'],
      ['Page', 'list'],
      ['PageWorkflow', 'get', '--run-id', 'example'],
      ['PageObject', 'list'],
    ]) {
      const child = Bun.spawn([process.execPath, entry, '--agent=definitely-invalid', ...command, '--json'], {
        stdout: 'pipe',
        stderr: 'ignore',
      });
      const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
      expect(exitCode).toBe(1);
      expect(JSON.parse(stdout)).toMatchObject({ ok: false, message: expect.stringContaining('Unsupported page control agent') });
    }
  });

  test('CLI workspace package owns the source command', () => {
    const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, '..', '..', 'package.json'), 'utf8')) as {
      name: string;
      bin: Record<string, string>;
    };
    expect(manifest.name).toBe(`${PACKAGE_NAME}-cli`);
    expect(manifest.bin).toEqual({ 'depa-codument': 'src/cli/index.ts' });
  });
});
