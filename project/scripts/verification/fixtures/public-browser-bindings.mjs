// Actual public providers; only their subprocess IO is replaced, never the provider implementation.
import assert from 'node:assert/strict';
import { createOneShotBrowserProvider } from 'halfcode-lite-browser-support';
import { resolveAdmittedExecutionPolicy, createArgvSchema } from 'halfcode-lite-cli-logic';
import { createCommandHost } from 'halfcode-lite-cli-capsule';
import { runCli } from 'halfcode-lite-cli-shell';
import { pathRoots } from 'halfcode-lite-cli-support';

const envelope = { ok: true, status: 200, statusText: 'OK', url: 'https://notes.test', contentType: 'text/plain', text: 'notes' };
const selections = [
  { transport: 'ego-browser' },
  { transport: 'opencli', backend: { transport: 'plugin' } },
  { transport: 'opencli', backend: { transport: 'browser-eval' } },
  { transport: 'mdd-browser-robot', backend: { transport: 'chrome-extension' } },
];
const policy = { placement: 'dynamic', runtimeProfile: 'browser' };
for (const selection of selections) {
  const calls = [];
  const effects = {
    ego: { binary: '/unused/ego', async runScript(script) {
      calls.push('ego-browser'); assert.ok(script.includes('notes-isolated'));
      return { code: 0, stdout: '__CLI_HOST_EGO_RESULT__' + JSON.stringify(envelope), stderr: '' };
    } },
    opencli: { async run(args) {
      calls.push('opencli');
      if (args[0] === 'plugin') return { code: 0, stdout: 'cli-host-opencli', stderr: '' };
      if (args.includes('get')) return { code: 0, stdout: 'https://notes.test', stderr: '' };
      if (args[0] === 'browser') assert.equal(args[1], 'notes-isolated');
      return { code: 0, stdout: JSON.stringify(envelope), stderr: '' };
    } },
    mdd: { binary: '/unused/mdd', async run(args, stdin) {
      calls.push('mdd-browser-robot'); assert.ok(args.includes('notes-isolated'));
      const request = JSON.parse(stdin);
      return { code: 0, stdout: JSON.stringify({ protocol: request.protocol, id: request.id, ok: true, result: envelope }), stderr: '' };
    } },
  };
  const host = createCommandHost({
    identity: { bin: 'notes', displayName: 'Notes', version: '1' },
    commands: [{
      name: 'fetch', summary: 'Fetch Notes', schema: createArgvSchema('notes fetch', [], []),
      doc: { summary: 'Fetch Notes', usage: ['notes fetch'], examples: [], options: [] },
      execution: policy,
      run: async ({ runtime }) => ({ code: 0, data: await runtime.provider.browserFetch({ url: 'https://notes.test', method: 'GET', headers: {} }) }),
    }],
  }, {
    createRuntime(_root, command) {
      assert.deepEqual(command.execution, policy);
      const runtime = createOneShotBrowserProvider({ ...selection, session: 'notes-isolated' }, effects);
      assert.equal(resolveAdmittedExecutionPolicy(command.execution, { backendLifetime: runtime.lifetime }).placement, 'local');
      assert.deepEqual(calls, [], 'Provider construction must not execute browser IO');
      return runtime;
    },
  }, { runtimeScope: 'invocation' });
  try {
    const output = [];
    assert.equal(await runCli(host, { args: ['fetch', '--json'], cwd: process.cwd() }, { roots: pathRoots, output: { write: value => output.push(value) } }), 0);
    assert.equal(JSON.parse(output.at(-1)).text, 'notes');
    assert.deepEqual([...new Set(calls)], [selection.transport]);
  } finally { await host.dispose(); }
}
assert.throws(() => createOneShotBrowserProvider({ transport: 'ego-browser', lifetime: 'one-shot' }));
assert.throws(() => createOneShotBrowserProvider({ transport: 'opencli', backend: { transport: 'unknown' } }));
assert.equal(resolveAdmittedExecutionPolicy(policy, { backendLifetime: 'host-persistent' }).placement, 'serve-required');
assert.throws(() => resolveAdmittedExecutionPolicy({ placement: 'local', runtimeProfile: 'basic' }, { backendLifetime: 'host-persistent' }));
console.log(JSON.stringify({ publicCliBackendMatrix: selections, actualProviderFactories: true, realBrowser: 'NOT_RUN' }));
