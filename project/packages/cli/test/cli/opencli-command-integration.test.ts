import { describe, expect, test } from 'bun:test';
import * as path from 'node:path';
import { execCodeCommand } from '../../src/cli/commands/exec-code';
import { invokeCommand } from '../../src/cli/commands/invoke';
import { runWebApiCommand } from '../../src/cli/commands/run-web-api';
import { argvSchema, type CommandRuntime } from '../../src/cli/contracts/command';
import { createEmbeddedResourceEffect } from '../../src/cli/effects/resource';
import { createWorkspaceEffect } from '../../src/cli/effects/workspace';
import type { BrowserProviderSelection } from '../../src/cli/effects/browser-provider';

const capsule = path.resolve(import.meta.dir, '../fixtures/opencli-capsule');
const modulePath = path.join(capsule, 'browser-functions/items-list.js');
const selections: BrowserProviderSelection[] = [];

function runtime(defaultSelection?: BrowserProviderSelection | Error): CommandRuntime {
  return {
    resources: createEmbeddedResourceEffect([]),
    workspace: () => createWorkspaceEffect(capsule),
    async defaultBrowserSelection() {
      if (defaultSelection instanceof Error) throw defaultSelection;
      return defaultSelection ?? { transport: 'ego-browser' };
    },
    browserProviderFor(selection) {
      selections.push(selection);
      return {
        transport: selection.transport,
        session: selection.session ?? 'default',
        async browserFetch(request) {
          return {
            ok: true, status: 200, statusText: 'OK', url: request.url,
            contentType: 'application/json', text: JSON.stringify({ code: 0, data: [{ id: 'one' }] }),
          };
        },
      };
    },
  };
}

describe('explicit OpenCLI command transports', () => {
  test('invoke forwards plugin transport and session into the shared runtime', async () => {
    selections.length = 0;
    const context = argvSchema.parse([
      '--fqn', 'Example.OpenCli.Items.List', '--capsule', capsule,
      '--transport', 'opencli', '--opencli-transport', 'plugin', '--session', 'plugin-session', '--input', '{"limit":"2"}',
    ], ['invoke'], runtime());
    const result = await invokeCommand(context);
    expect(result.code).toBe(0);
    expect(result.data).toMatchObject({ transport: 'opencli', opencliSubtransport: 'plugin', lastStatus: 200, result: { code: 0 } });
    expect(selections).toEqual([{ transport: 'opencli', session: 'plugin-session', backend: { transport: 'plugin' } }]);
  });

  test('exec forwards browser-eval transport into the bundle runner', async () => {
    selections.length = 0;
    const context = argvSchema.parse([
      '--code', '(async () => run_web_api("Example.OpenCli.Items.List", {limit:"1"}))()',
      '--capsule', capsule, '--transport', 'opencli', '--opencli-transport', 'browser-eval', '--session', 'eval-session',
    ], ['exec'], runtime());
    const result = await execCodeCommand(context);
    expect(result.code).toBe(0);
    expect(result.data?.result).toMatchObject({ code: 0 });
    expect(selections).toEqual([{ transport: 'opencli', session: 'eval-session', backend: { transport: 'browser-eval' } }]);
  });

  test('run-web-api uses the same explicit plugin effect', async () => {
    selections.length = 0;
    const context = argvSchema.parse([
      modulePath, '--transport', 'opencli', '--opencli-transport', 'plugin', '--session', 'web-api-session', '--input', '{"limit":"3"}',
    ], ['run-web-api'], runtime());
    const result = await runWebApiCommand(context);
    expect(result.code).toBe(0);
    expect(result.data).toMatchObject({ transport: 'opencli', opencliSubtransport: 'plugin', lastStatus: 200 });
    expect(selections).toEqual([{ transport: 'opencli', session: 'web-api-session', backend: { transport: 'plugin' } }]);
  });

  test('all browser-fetch commands use the workspace transport when the option is absent', async () => {
    selections.length = 0;
    const configured = runtime({ transport: 'opencli', backend: { transport: 'plugin' } });
    const contexts = [
      [invokeCommand, argvSchema.parse([
        '--fqn', 'Example.OpenCli.Items.List', '--capsule', capsule, '--input', '{}',
      ], ['invoke'], configured)],
      [execCodeCommand, argvSchema.parse([
        '--code', '(async () => run_web_api("Example.OpenCli.Items.List", {}))()', '--capsule', capsule,
      ], ['exec'], configured)],
      [runWebApiCommand, argvSchema.parse([modulePath, '--input', '{}'], ['run-web-api'], configured)],
    ] as const;
    for (const [command, context] of contexts) expect((await command(context)).code).toBe(0);
    expect(selections).toEqual([
      { transport: 'opencli', session: undefined, backend: { transport: 'plugin' } },
      { transport: 'opencli', session: undefined, backend: { transport: 'plugin' } },
      { transport: 'opencli', session: undefined, backend: { transport: 'plugin' } },
    ]);
  });

  test('an explicit transport overrides workspace config and config failures fail closed', async () => {
    selections.length = 0;
    const configured = runtime({ transport: 'opencli', backend: { transport: 'plugin' } });
    const explicit = argvSchema.parse([
      '--fqn', 'Example.OpenCli.Items.List', '--capsule', capsule, '--transport', 'ego-browser', '--input', '{}',
    ], ['invoke'], configured);
    expect((await invokeCommand(explicit)).data?.transport).toBe('ego-browser');
    expect(selections).toEqual([{ transport: 'ego-browser', session: undefined }]);

    const invalid = argvSchema.parse([
      '--fqn', 'Example.OpenCli.Items.List', '--capsule', capsule, '--input', '{}',
    ], ['invoke'], runtime(new Error('config browser.transport is invalid')));
    const result = await invokeCommand(invalid);
    expect(result).toMatchObject({ code: 1, message: 'config browser.transport is invalid' });
  });

  test('selects the Chrome Extension-only MDD provider from CLI or workspace', async () => {
    selections.length = 0;
    const explicit = argvSchema.parse([
      '--fqn', 'Example.OpenCli.Items.List', '--capsule', capsule,
      '--transport', 'mdd-browser-robot', '--session', 'mdd-explicit', '--input', '{}',
    ], ['invoke'], runtime());
    expect((await invokeCommand(explicit)).data?.transport).toBe('mdd-browser-robot');

    const configured = runtime({
      transport: 'mdd-browser-robot',
      backend: { transport: 'chrome-extension' },
    });
    const workspace = argvSchema.parse([
      '--fqn', 'Example.OpenCli.Items.List', '--capsule', capsule, '--input', '{}',
    ], ['invoke'], configured);
    expect((await invokeCommand(workspace)).data?.transport).toBe('mdd-browser-robot');
    const debug = argvSchema.parse([
      '--code', '(async () => run_web_api("Example.OpenCli.Items.List", {}))()', '--capsule', capsule,
    ], ['exec'], configured);
    expect((await execCodeCommand(debug)).data?.transport).toBe('mdd-browser-robot');
    const webApi = argvSchema.parse([modulePath, '--input', '{}'], ['run-web-api'], configured);
    expect((await runWebApiCommand(webApi)).data?.transport).toBe('mdd-browser-robot');
    expect(selections).toEqual([
      { transport: 'mdd-browser-robot', session: 'mdd-explicit', backend: { transport: 'chrome-extension' } },
      { transport: 'mdd-browser-robot', session: undefined, backend: { transport: 'chrome-extension' } },
      { transport: 'mdd-browser-robot', session: undefined, backend: { transport: 'chrome-extension' } },
      { transport: 'mdd-browser-robot', session: undefined, backend: { transport: 'chrome-extension' } },
    ]);
  });
});
