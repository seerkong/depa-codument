// Executed only after copying into an isolated, tarball-installed consumer.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createResourceHostRuntime } from 'halfcode-cli-lite-skill-app-capsule';
import { createLocalFunctionExecutor } from 'halfcode-cli-lite-skill-app-capsule/execution';
import { createBunLocalFunctionCapabilityBindings } from 'halfcode-cli-lite-skill-app-capsule/local-function-capabilities';
import { createLazyPageHost, startHttpHost } from 'halfcode-cli-lite-live-host-capsule';
import { createLocalFunctionHttpApp, LOCAL_FUNCTION_SERVE_PATH } from 'halfcode-cli-lite-http-shell';
import { createBunHttpListener } from 'halfcode-cli-lite-cli-host-support/http';
import { createWorkspaceEffect } from 'halfcode-cli-lite-skill-app-support/workspace';
import { createPageAutomationPlatform } from 'halfcode-cli-lite-skill-app-support/page-automation-platform';
import { createPageBuildPlatform } from 'halfcode-cli-lite-skill-app-support/page-build-platform';
import { createFilePageGenerationStore } from 'halfcode-cli-lite-skill-app-support/page-generation-store';
import { invokeLiveLocalFunctionClient } from 'halfcode-cli-lite-skill-app-logic/live-client';
import { createFetchLiveTransport } from 'halfcode-cli-lite-skill-app-support/live-transport';
import { createCommandHost } from 'halfcode-cli-lite-cli-host-capsule';
import { createRuntimeLifetime } from 'halfcode-cli-lite-cli-host-capsule/runtime-lifetime';
import { createCodexSidecar } from 'halfcode-cli-lite-cli-host-support/codex';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import { runCli } from 'halfcode-cli-lite-cli-host-shell';
import { pathRoots } from 'halfcode-cli-lite-cli-host-support';

const root = join(process.cwd(), 'live-workspace');
await mkdir(root);
await writeFile(join(root, 'manifest.xnl'), `<SkillApp #Notes.Live envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (
 <Catalogs [<DirectoryResourceCatalog #bundle {resourceKind="HostBundle" root="vfs://./" entry="bundle.xnl" scope="root"}>]>)>`);
await writeFile(join(root, 'bundle.xnl'), '<HostBundle #Notes.Bundle envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {entry="vfs://./entry.ts" sources=["vfs://./entry.ts"] runtime="bun" exports=["LocalFunction" "PageWorkflow"]}>');
const source = `export const resourceDefinitions=[
 {kind:'LocalFunction',protocolVersion:'2',fqn:'Notes.Start',operation:'action',inputSchema:{type:'object'},configSchema:{type:'object'},outputSchema:{type:'object'},runtimeCapabilities:['pageWorkflow'],handler:runtime=>runtime.pageWorkflow.start({fqn:'Notes.Flow',input:{}})},
 {kind:'PageWorkflow',protocolVersion:'2',fqn:'Notes.Flow',inputSchema:{type:'object'},outputSchema:{type:'number'},runtimeCapabilities:['page'],
 selectionPolicy:{kind:'external-page',urlPattern:'^https://notes.test/',cardinality:'exactly-one'},defaultSelector:{direct:{byExternalPage:{}}},
 start:async runtime=>(await runtime.page.session.send('Runtime.evaluate',{expression:'1'})).result.value}
];`;
await writeFile(join(root, 'entry.ts'), source);

function instance(name, value) {
  const resources = createResourceHostRuntime({ workspaceRoot: root, sources: [{ root: '.', scope: 'root', origin: 'notes' }], privateDirectory: '.notes' });
  let acquisitions = 0, providerCloses = 0, browserCalls = 0, active = true;
  const page = createLazyPageHost({
    async acquire() {
      acquisitions++;
      return {
        bindings: {
          resources: resources.resourceCatalog, definitions: resources.definitionCatalog,
          workspace: () => createWorkspaceEffect(root), automationPlatform: createPageAutomationPlatform(),
          browser: () => ({
            async listTabs() { browserCalls++; return [{ targetId: name, type: 'page', url: 'https://notes.test/' }]; },
            async selectTab() {}, async navigate() { throw new Error('No real browser allowed'); }, async evaluate() { return value; }, async download() {},
          }),
          buildPlatform: createPageBuildPlatform(), generationStore: createFilePageGenerationStore(root, '.notes/' + name),
          builder: { async watch() { throw new Error('This workflow must not build Vue'); } },
        },
      };
    },
  });
  const capabilities = createBunLocalFunctionCapabilityBindings();
  const executor = createLocalFunctionExecutor(resources, { workspace: () => createWorkspaceEffect(root) }, {
    ...capabilities,
    async buildRuntime(context, definition, options) {
      return page.use(live => capabilities.buildRuntime({ ...context, workflows: live.workflows }, definition, options));
    },
  });
  const identity = { workspaceRoot: root, agent: name, serverInstanceId: name };
  const codex = createCodexSidecar({
    command: process.execPath, cwd: root, clientInfo: { name, version: '1' },
    args: ['-e', `import {createInterface} from 'node:readline';
      createInterface({input:process.stdin}).on('line',line=>{
        const request=JSON.parse(line);if(request.id===undefined)return;
        const result=request.method==='thread/list'?{data:[{id:String(process.pid)}]}:{};
        process.stdout.write(JSON.stringify({id:request.id,result})+'\\n');
      });`],
  });
  const providerOwner = { async close() {
    await assert.rejects(() => codex.listThreads(), /closed/, 'Live sidecar must close before providers');
    if (acquisitions) providerCloses++;
  } };
  const lifetime = createRuntimeLifetime({ execution: [executor], live: [page, codex], providers: [providerOwner], resources: [resources] });
  const app = createLocalFunctionHttpApp({ identity, isCurrentInstance: async () => active, prepare: executor.prepare });
  const server = startHttpHost({
    listener: createBunHttpListener(), identity: { serverInstanceId: name, pid: process.pid, host: '127.0.0.1', port: 0 },
    platform: { randomUUID: () => crypto.randomUUID(), schedule: (callback, ms) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); } },
    pageSocketPath: '/page', instructionChannels: [], createHandler: () => request => app.fetch(request),
    async release() { active = false; await lifetime.close(); },
  });
  return { identity, resources, executor, page, server, codex, counts: () => ({ acquisitions, providerCloses, browserCalls }) };
}

const first = instance('notes-one', 1), second = instance('notes-two', 2);
async function send(target, request) {
  return fetch(new URL(LOCAL_FUNCTION_SERVE_PATH, target.server.url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
}
try {
  assert.equal(first.counts().acquisitions, 0);
  assert.deepEqual((await first.resources.resourceCatalog.snapshot()).diagnostics, []);
  const admitted = await first.executor.prepare('Notes.Start');
  assert.equal(first.counts().acquisitions, 0, 'Preflight must not construct Page');
  const request = { ...first.identity, protocol: 'local-function-invoke/v1', fqn: 'Notes.Start', input: {}, config: {}, profile: null, admissionDigest: admitted.receipt.digest };
  for (const mutation of [{ serverInstanceId: 'other' }, { agent: 'other' }, { workspaceRoot: '/other' }, { profile: 'other' }, { admissionDigest: 'stale' }, { code: 'arbitrary' }]) {
    assert.equal((await send(first, { ...request, ...mutation })).status, 409);
  }
  assert.equal(first.counts().acquisitions, 0);
  const responses = await Promise.all([send(first, request), send(first, request)]);
  for (const response of responses) {
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.admissionDigest, admitted.receipt.digest);
    const run = await first.page.use(live => live.workflows.wait(body.result.runId));
    assert.equal(run.status, 'completed'); assert.equal(run.result, 1);
  }
  assert.equal(first.counts().acquisitions, 1);
  const recordPath = join(root, 'client-record.json');
  await writeFile(recordPath, JSON.stringify({ ...first.identity, url: first.server.url }));
  const clientRuntime = {
    scope: { workspaceRoot: root, agent: first.identity.agent },
    records: { async read(scope) {
      assert.equal(scope.workspaceRoot, root);
      assert.equal(scope.agent, first.identity.agent);
      return JSON.parse(await readFile(recordPath, 'utf8'));
    } },
    transport: createFetchLiveTransport({ fetch }, { timeoutMs: 2000 }),
  };
  const output = [];
  const commandHost = createCommandHost({ identity: { bin: 'notes', displayName: 'Notes', version: '1.0.0' }, commands: [{
    name: 'start', summary: 'Start Notes workflow', usage: ['notes start'], examples: [],
    doc: { summary: 'Start Notes workflow', usage: ['notes start'], examples: [], options: [] },
    schema: createArgvSchema('notes start', [], []), execution: { placement: 'serve-required', runtimeProfile: 'live-client' },
    run: async ({ runtime }) => ({ code: 0, data: await invokeLiveLocalFunctionClient(runtime, {
      fqn: 'Notes.Start', input: {}, config: {}, profile: null, admissionDigest: admitted.receipt.digest,
    }) }),
  }] }, { createRuntime: (_root, selection) => {
    assert.equal(selection.execution.runtimeProfile, 'live-client');
    assert.equal(selection.execution.placement, 'serve-required');
    return clientRuntime;
  } }, { runtimeScope: 'invocation' });
  try {
    assert.equal(await runCli(commandHost, { args: ['start', '--json'], cwd: root }, { roots: pathRoots, output: { write: value => output.push(value) } }), 0);
    const result = JSON.parse(output.at(-1));
    assert.equal((await first.page.use(live => live.workflows.wait(result.runId))).result, 1);
  } finally { await commandHost.dispose(); }
  const next = await second.executor.prepare('Notes.Start');
  const firstPid = Number((await first.codex.listThreads())[0].id);
  const secondPid = Number((await second.codex.listThreads())[0].id);
  assert.notEqual(firstPid, secondPid);
  const other = await (await send(second, { ...request, ...second.identity, admissionDigest: next.receipt.digest })).json();
  assert.equal((await second.page.use(live => live.workflows.wait(other.result.runId))).result, 2);
  await writeFile(join(root, 'entry.ts'), source + '\n// changed admission');
  assert.equal((await send(first, request)).status, 409);
  const closed = first.server.stop(); assert.equal(first.server.stop(), closed); await closed;
  assert.throws(() => process.kill(firstPid, 0));
  process.kill(secondPid, 0);
  assert.equal(first.counts().providerCloses, 1);
  assert.equal(second.counts().providerCloses, 0);
  assert.equal((await second.page.use(async live => live.workflows.get(other.result.runId))).result, 2);
} finally { await Promise.all([first.server.stop(), second.server.stop()]); }
console.log(JSON.stringify({ publicLive: true, publicCliClient: true, exactServiceRecord: true, realLoopbackHttp: true, serverReadmission: true, lazySingleAcquisition: true, workflowExecution: true, twoInstances: true, ownedClose: true, actualCodexPeerReaped: true, realBrowser: 'NOT_RUN' }));
