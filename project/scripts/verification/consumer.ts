import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { cliRoles } from './architecture';
import { prepareCodeFirstConsumer } from './code-first-consumer';
import { openReleaseRegistry } from './release-set';
import { verifyCustomKindConsumer } from './custom-kind-consumer';

export async function command(args: string[], cwd: string): Promise<string> {
  const child = Bun.spawn([process.execPath, ...args], {
    cwd, env: { ...process.env, NODE_PATH: '', PATH: path.dirname(process.execPath) + path.delimiter + (process.env.PATH ?? '') },
    stdout: 'pipe', stderr: 'pipe',
  });
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 180_000);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    .finally(() => clearTimeout(deadline));
  if (timedOut) throw new Error(args.join(' ') + ': consumer command exceeded 180s: ' + stderr + stdout);
  if (code !== 0) throw new Error(args.join(' ') + ': ' + stderr + stdout);
  return stdout;
}
/** Installs the supplied immutable public release outside this repository; no workspace imports. */
export async function verifyCliConsumer(_root: string, withSkillApp = false, withBrowser = false, withVue = false, withMcp = false): Promise<void> {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-public-consumer-')));
  try {
    const consumer = path.join(temporary, 'consumer');
    fs.mkdirSync(consumer);
    const release = process.env.CODUMENT_VERIFY_RELEASE_SET;
    if (!release) throw new Error('UNVERIFIED: set CODUMENT_VERIFY_RELEASE_SET to a prepared immutable release directory');
    const registry = await openReleaseRegistry(path.resolve(release));
    let codeFirst: (() => Promise<void>) | undefined;
    const selected = [
      ...cliRoles.map(role => 'halfcode-lite-cli-' + role),
      ...(withSkillApp ? ['halfcode-lite-skill-app-capsule', 'halfcode-lite-live-host-capsule', 'halfcode-lite-http-shell'] : []),
      ...(withBrowser ? ['halfcode-lite-browser-support'] : []),
      ...(withVue ? ['halfcode-lite-page-builder-vue-support'] : []),
      ...(withMcp ? ['halfcode-lite-mcp-app-capsule'] : []),
    ];
    const dependencies: Record<string, string> = {};
    try {
      for (const name of selected) {
        const artifact = registry.set.artifacts.find(item => item.name === name && item.role === 'shared');
        if (!artifact) throw new Error('Release set missing public package: ' + name);
        dependencies[name] = artifact.version;
      }
      fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({
        name: 'notes-cli-fixture', private: true, type: 'module',
        dependencies: { ...dependencies, ...(withMcp ? { '@modelcontextprotocol/sdk': '^1.30.0' } : {}) },
      }));
      await command(['install', '--save-text-lockfile', '--ignore-scripts', '--registry', registry.url, '--cache-dir', path.join(temporary, 'registry-cache')], consumer);
      if (withSkillApp) codeFirst = await prepareCodeFirstConsumer(consumer, registry.url, command);
    } finally { await registry.close(); }
    fs.writeFileSync(path.join(consumer, 'index.ts'), `
import { createCommandHost } from 'halfcode-lite-cli-capsule';
import { createArgvSchema } from 'halfcode-lite-cli-logic';
import { runCli } from 'halfcode-lite-cli-shell';
import { pathRoots, streamOutput } from 'halfcode-lite-cli-support';
const host = createCommandHost({
  identity: { bin: 'notes', displayName: 'Independent Notes', version: '1' },
  commands: [{
    name: 'where', summary: 'Print workspace', usage: ['notes where'], examples: [],
    doc: { summary: 'Print workspace', usage: ['notes where'], examples: [], options: [] },
    schema: createArgvSchema('where', [], []),
    execution: { placement: 'local', runtimeProfile: 'notes' },
    run: ({runtime}) => ({ code: 0, data: { root: runtime.root, consumer: 'notes' } }),
  }],
}, { createRuntime(root) { return {root}; } });
try { process.exitCode = await runCli(host, { args: process.argv.slice(2), cwd: process.cwd() },
  { roots: pathRoots, output: streamOutput(process.stdout) }); }
finally { await host.dispose(); }
`);
    const help = await command(['index.ts', '--help'], consumer);
    if (!help.includes('Independent Notes') || help.includes('Codument')) throw new Error('Host identity leaked');
    const result = JSON.parse(await command(['index.ts', 'where', '--workspace-dir', 'notebook', '--json'], consumer));
    if (result.root !== path.join(consumer, 'notebook') || result.code !== 0 || result.consumer !== 'notes') {
      throw new Error('Isolated consumer output mismatch');
    }
    if (withSkillApp) await verifyPackagedTemplates(consumer);
    if (withSkillApp) await verifyCustomKindConsumer(consumer, command);
    await verifyPackagedCodex(consumer);
    await verifyPackagedService(consumer);
    if (withSkillApp) await verifyPackagedSkillApp(consumer);
    if (withSkillApp) await verifyPackagedHttp(consumer);
    await codeFirst?.();
    if (withBrowser) await verifyPackagedBrowser(consumer);
    if (withVue) await verifyPackagedVue(consumer);
    if (withMcp) await verifyPackagedMcp(consumer);
    for (const name of Object.keys(dependencies)) {
      const installed = path.join(consumer, 'node_modules', name);
      if (!fs.realpathSync(installed).startsWith(temporary + path.sep)) throw new Error('Workspace dependency escaped fixture: ' + name);
      const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
      if (Object.values(manifest.dependencies ?? {}).some((value) => String(value).startsWith('workspace:'))) {
        throw new Error('Unresolved workspace dependency in tarball: ' + name);
      }
    }
    console.log(JSON.stringify({ packages: Object.keys(dependencies), consumer: 'notes-cli-fixture', releaseDigest: registry.digest, normalRegistryResolution: true, transitiveOverrides: false, registryStoppedBeforeRuntime: true, workspaceIsolated: true }));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

/** Pack the actual public dependency closure, not a hand-maintained transitive list. */
export function workspaceClosure(root: string, seeds: readonly string[]): string[] {
  const packages = fs.readdirSync(path.join(root, 'packages')).flatMap((directory) => {
    const file = path.join(root, 'packages', directory, 'package.json');
    if (!fs.existsSync(file)) return [];
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    return [{ directory, manifest }];
  });
  const byName = new Map(packages.map((entry) => [entry.manifest.name, entry]));
  const selected = new Set<string>();
  function visit(directory: string): void {
    if (selected.has(directory)) return;
    const entry = packages.find((item) => item.directory === directory);
    if (!entry || entry.manifest.private) throw new Error('Consumer requires a public package: ' + directory);
    selected.add(directory);
    for (const name of Object.keys(entry.manifest.dependencies ?? {})) {
      const dependency = byName.get(name);
      if (dependency) visit(dependency.directory);
    }
  }
  for (const seed of seeds) visit(seed);
  return [...selected];
}

async function verifyPackagedService(consumer: string): Promise<void> {
  fs.writeFileSync(path.join(consumer, 'service-peer.ts'), `Bun.serve({hostname:'127.0.0.1',port:Number(process.argv[2]),fetch:()=>Response.json({ok:true,command:'notes-health',notesVersion:1})});`);
  fs.writeFileSync(path.join(consumer, 'service.ts'), `
import {createServiceSupervisor} from 'halfcode-lite-cli-capsule/service';
import {spawnDetachedProcess,isPidAlive,stopProcess,probeHttpHealth,allocateTcpPort} from 'halfcode-lite-cli-support/process';
let record, launches=0;
const owned=[];
const supervisor=createServiceSupervisor({
  records:{read:async()=>record,write:async value=>{record=value;},clear:async()=>{record=undefined;}},
  process:{isAlive:isPidAlive,stop:stopProcess,probeHealth:url=>probeHttpHealth(url,{path:'/health',command:'notes-health',versionField:'notesVersion',version:1,timeoutMs:500})},
  sleep:ms=>Bun.sleep(ms),
  async launch({host}){
    const port=allocateTcpPort(host);
    const pid=await spawnDetachedProcess({command:process.execPath,args:['service-peer.ts',String(port)],cwd:process.cwd(),env:process.env});
    owned.push(pid); launches++;
    return {pid,host,port,url:'http://'+host+':'+port+'/'};
  },
},{defaultHost:'127.0.0.1',defaultPort:0});
try{
  const [started,reused]=await Promise.all([supervisor.run({action:'start'}),supervisor.run({action:'start'})]);
  if(!started.running||reused.reason!=='reused'||launches!==1)throw new Error('Persistent service was not reused');
  const restarted=await supervisor.run({action:'restart'});
  if(!restarted.running||launches!==2||isPidAlive(started.record.pid))throw new Error('Restart did not retire previous PID');
  const stopped=await supervisor.run({action:'stop'});
  if(stopped.running||record||owned.some(isPidAlive))throw new Error('Service stop did not release process authority');
}finally{await supervisor.close();for(const pid of owned)await stopProcess(pid);}
console.log(JSON.stringify({service:true,realDetachedProcess:true,reuse:true,restart:true,stopped:true}));
`);
  const result = JSON.parse(await command(['service.ts'], consumer));
  if (!result.service || !result.stopped) throw new Error('Installed service lifecycle failed');
  console.log(JSON.stringify({ scope: 'service-slice', ...result }));
}

async function verifyPackagedTemplates(consumer: string): Promise<void> {
  fs.writeFileSync(path.join(consumer, 'templates.ts'), `
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {createSourceResourceEffect} from 'halfcode-lite-cli-support';
import {installTemplates,installInstructionBlocks} from 'halfcode-lite-cli-logic/install';
import {withFileBackup,FileBackupFailure} from 'halfcode-lite-cli-support/file-backup';
import {createWorkspaceEffect} from 'halfcode-lite-skill-app-support/workspace';
const root=path.join(process.cwd(),'template-source'),target=path.join(process.cwd(),'template-target');
await fs.mkdir(path.join(root,'skills/notes'),{recursive:true});
await fs.writeFile(path.join(root,'skills/notes/SKILL.md'),'# Notes');
await fs.mkdir(target);
const workspace=createWorkspaceEffect(target);
await workspace.writeText('AGENTS.md','User-owned instructions');
const receipt=await installTemplates(createSourceResourceEffect(root),workspace,{sourceRoot:'skills',destinationRoot:'.agents/skills',overwrite:false});
if(receipt.written!==1||!(await workspace.readText('.agents/skills/notes/SKILL.md')).includes('# Notes'))throw new Error('Packed templates not installed');
await installInstructionBlocks(workspace,['AGENTS.md'],{marker:'notes',body:'Read Notes'});
const first=await workspace.readText('AGENTS.md');
await installInstructionBlocks(workspace,['AGENTS.md'],{marker:'notes',body:'Read Notes'});
if(!first.includes('User-owned instructions')||await workspace.readText('AGENTS.md')!==first)throw new Error('Instruction ownership/idempotence failed');
let restored=false;
try {await withFileBackup({root:target,managedPaths:['.agents/skills/notes'],backupParent:'.notes/backups',prefix:'test'},async()=>{
  await workspace.writeText('.agents/skills/notes/SKILL.md','changed');throw new Error('simulated install failure');
});}catch(error){restored=error instanceof FileBackupFailure&&error.rollbackErrors.length===0;}
if(!restored||!(await workspace.readText('.agents/skills/notes/SKILL.md')).includes('# Notes'))throw new Error('Packaged checkpoint did not restore templates');
console.log(JSON.stringify({templates:true,instructions:true,idempotent:true,backupRestored:true}));
`);
  const result = JSON.parse(await command(['templates.ts'], consumer));
  if (!result.templates || !result.idempotent) throw new Error('Installed templates consumer failed');
  console.log(JSON.stringify({scope: 'templates-slice', ...result}));
}

async function verifyPackagedCodex(consumer: string): Promise<void> {
  fs.writeFileSync(path.join(consumer, 'codex-peer.ts'), `
import {createInterface} from 'node:readline';
let client;
createInterface({input:process.stdin}).on('line',line=>{
  const request=JSON.parse(line);
  if(request.id===undefined)return;
  if(request.method==='initialize')client=request.params.clientInfo;
  let result={};
  if(request.method==='thread/list')result={data:[{id:'fixture',name:client.name,cwd:process.cwd()}]};
  if(request.method==='turn/start')result={turn:{id:request.params.input[0].text}};
  process.stdout.write(JSON.stringify({id:request.id,result})+'\\n');
});
`);
  fs.writeFileSync(path.join(consumer, 'codex.ts'), `
import {createCodexSidecar} from 'halfcode-lite-cli-support/codex';
import {createCodexClient} from 'halfcode-lite-cli-capsule/codex';
import {encodeIpcFrame,decodeIpcFrames} from 'halfcode-lite-cli-support/codex-desktop';
if(decodeIpcFrames(encodeIpcFrame({name:'notes'})).messages[0].name!=='notes')throw new Error('IPC codec not packaged');
function start(name){
  const sidecar=createCodexSidecar({command:process.execPath,args:['codex-peer.ts'],cwd:process.cwd(),clientInfo:{name,version:'1'}});
  return createCodexClient({desktop:null,sidecar,cwd:process.cwd(),release:()=>sidecar.close()});
}
const first=start('first'),second=start('second');
try{
  if((await first.listThreads())[0].name!=='first'||(await second.listThreads())[0].name!=='second')throw new Error('Client identity leaked');
  if((await first.sendMessage({threadId:'fixture',message:'simulated-turn'})).turnId!=='simulated-turn')throw new Error('Simulated turn not delivered');
  await first.close();
  if((await second.listThreads())[0].name!=='second')throw new Error('Closing first affected second');
}finally{await first.close();await second.close();}
console.log(JSON.stringify({codex:true,simulatedPeer:true,realMessagesSent:false,isolated:true,closed:true}));
`);
  const result = JSON.parse(await command(['codex.ts'], consumer));
  if (!result.closed || result.realMessagesSent !== false) throw new Error('Codex protocol consumer failed');
  console.log(JSON.stringify({ scope: 'codex-slice', ...result }));
}

async function verifyPackagedHttp(consumer: string): Promise<void> {
  fs.writeFileSync(path.join(consumer, 'http.ts'), `
import { startHttpHost } from 'halfcode-lite-live-host-capsule';
import { createBunHttpListener } from 'halfcode-lite-cli-support/http';
import { createPageChannelPlatform } from 'halfcode-lite-skill-app-support/page-channels';
let released = 0;
function start(name) {
  let channels;
  const host = startHttpHost({
    listener: createBunHttpListener(), platform: createPageChannelPlatform(),
    identity: {serverInstanceId:name, pid:process.pid, host:'127.0.0.1', port:0},
    pageSocketPath:'/notes/pages', instructionChannels:[{path:'/notes/instructions',channel:'notes'}],
    createHandler(input) { channels = input; return () => Response.json({name,port:input.identity.port,targets:input.pages.list()}); },
    release() { released++; },
  });
  return {host,channels};
}
const first = start('first');
const second = start('second');
let socket;
try {
  if ((await (await fetch(first.host.url)).json()).name !== 'first') throw new Error('HTTP handler not isolated');
  socket = new WebSocket(first.host.url.replace('http:','ws:') + 'notes/pages');
  const target = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Page registration timed out')), 3000);
    socket.onopen = () => socket.send(JSON.stringify({type:'page.register',pageName:'notes'}));
    socket.onerror = error => { clearTimeout(timer); reject(error); };
    socket.onmessage = event => {
      const value = JSON.parse(event.data);
      if (value.type === 'page.registered') { clearTimeout(timer); resolve(value.targetRef); }
      if (value.type === 'page.request') socket.send(JSON.stringify({type:'page.response',requestId:value.requestId,ok:true,result:{title:'Notes'}}));
    };
  });
  if ((await first.channels.pages.invoke(target,'getState')).title !== 'Notes') throw new Error('Page RPC failed');
  if (second.channels.pages.list().length) throw new Error('Page channels leaked between instances');
  await first.host.stop();
  if (first.channels.pages.list().length) throw new Error('Stopped targets retained');
  if ((await (await fetch(second.host.url)).json()).name !== 'second') throw new Error('Stopping first affected second');
} finally { socket?.close(); await first.host.stop(); await second.host.stop(); }
if (released !== 2) throw new Error('Runtime ownership not released exactly once');
console.log(JSON.stringify({http:true,localNetwork:true,pageRpc:true,instancesIsolated:true,closed:true}));
`);
  const result = JSON.parse(await command(['http.ts'], consumer));
  if (!result.http || !result.closed) throw new Error('Isolated HTTP consumer failed');
  console.log(JSON.stringify({scope: 'http-slice', ...result}));
}

async function verifyPackagedMcp(consumer: string): Promise<void> {
  fs.writeFileSync(path.join(consumer, 'mcp.ts'), `
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpPageTargetStore, serveMcpApp, APP_RESOURCE_URI } from 'halfcode-lite-mcp-app-capsule';
const targets = createMcpPageTargetStore();
const otherTargets = createMcpPageTargetStore();
const runtime = {
  hostSkill: 'notes', hostVersion:'notes-1', targets,
  pages: { list: async () => [{name:'notes',description:'Notes',status:'ready',appReady:true,sopFqn:'Notes.SOP.Read'}], renderApp: async () => '<html><main>Notes</main></html>' },
  automation: { list: async () => [] },
  sops: { get: async (fqn) => ({fqn,profile:'freeform',markdown:'# Notes',contentDigest:'sha256:notes',diagnostics:[]}) },
  workflows: { start: async ({fqn}) => ({runId:'notes-run',fqn,status:'queued'}), get: () => undefined },
};
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = await serveMcpApp(runtime, {transport:serverTransport});
const client = new Client({name:'independent-notes',version:'1'}, {capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}}});
try {
  await client.connect(clientTransport);
  if(client.getServerVersion()?.version!=='notes-1')throw new Error('MCP product version binding lost');
  const tools = await client.listTools();
  if (!tools.tools.some(t => t.name === 'sop_get')) throw new Error('Missing SOP tool');
  const sop = await client.callTool({name:'sop_get',arguments:{fqn:'Notes.SOP.Read'}});
  if (sop.isError || !JSON.stringify(sop).includes('# Notes')) throw new Error('SOP failed');
  const invalid = await client.callTool({name:'sop_get',arguments:{fqn:42}});
  if (!invalid.isError) throw new Error('Schema was bypassed');
  const app = await client.readResource({uri:APP_RESOURCE_URI});
  if (!JSON.stringify(app).includes('<main>Notes</main>')) throw new Error('App resource unavailable');
  const target = targets.register('notes');
  if (otherTargets.get(target.targetRef)) throw new Error('Target state leaked');
  targets.release(target.targetRef);
  if (targets.get(target.targetRef)) throw new Error('Released target remained live');
} finally { await client.close(); await server.close(); }
console.log(JSON.stringify({mcp:true,negotiated:true,schemaEnforced:true,resourceRead:true,closed:true}));
`);
  const result = JSON.parse(await command(['mcp.ts'], consumer));
  if (!result.mcp || !result.closed) throw new Error('Isolated MCP consumer failed');
  console.log(JSON.stringify({scope: 'mcp-slice', ...result}));
}

async function verifyPackagedVue(consumer: string): Promise<void> {
  const pageRoot = path.join(consumer, 'vue-page');
  fs.mkdirSync(path.join(pageRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(pageRoot, 'src/App.vue'), '<template><main>Independent Notes</main></template>');
  fs.writeFileSync(path.join(pageRoot, 'vite.config.ts'), 'throw new Error("App config must not execute")');
  fs.writeFileSync(path.join(consumer, 'vue.ts'), `
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { buildVuePage } from 'halfcode-lite-page-builder-vue-support';
import { createVuePageBuilderPort, resolveVueWorkerEntry } from 'halfcode-lite-page-builder-vue-support/worker-port';
import { PageBuildCoordinator } from 'halfcode-lite-live-host-capsule/page-build';
import { createFilePageGenerationStore } from 'halfcode-lite-skill-app-support/page-generation-store';
import { createPageBuildPlatform } from 'halfcode-lite-skill-app-support/page-build-platform';
const pageRoot = path.join(process.cwd(), 'vue-page');
const request = { pageName:'notes-page', pageRoot, entry:'src/App.vue', expose:'./app', outputDirectory:path.join(process.cwd(),'vue-output') };
const receipt = await buildVuePage(request);
if (receipt.remoteEntry !== 'remoteEntry.js' || receipt.toolchain.builderVersion !== '0.1.0') throw new Error('Builder receipt mismatch');
await fs.access(path.join(receipt.snapshotDirectory, receipt.mfManifest));
const worker = await resolveVueWorkerEntry();
if (!worker.startsWith(process.cwd() + path.sep)) throw new Error('Worker escaped installed closure');
let readyResolve, readyReject;
const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
const timer = setTimeout(() => readyReject(new Error('Worker build timed out')), 15000);
const coordinator = new PageBuildCoordinator({
  generationStore: createFilePageGenerationStore(process.cwd(), '.notes/cache/builds'),
  platform: createPageBuildPlatform(), builder: createVuePageBuilderPort(),
});
coordinator.subscribe(event => {
  if (event.type === 'page.build-ready') readyResolve(event);
  if (event.type === 'page.build-error' || event.type === 'page.unavailable') readyReject(new Error(JSON.stringify(event)));
});
try {
  await coordinator.open(request);
  const watched = await ready;
  if (!(await coordinator.asset('notes-page', watched.generation, 'remoteEntry.js'))?.length) throw new Error('Published asset missing');
  if (coordinator.get('notes-page')?.status !== 'ready') throw new Error('Coordinator state missing');
} finally { clearTimeout(timer); await coordinator.shutdown(); }
if (await fs.stat('.notes/cache/builds/work/notes-page').catch(() => undefined)) throw new Error('Watcher work leaked after shutdown');
if (await fs.stat('.codument').catch(() => undefined)) throw new Error('Product cache identity leaked');
console.log(JSON.stringify({vue:true, directBuild:true, workerBuild:true, workerClosed:true, coordinator:true, publishedAsset:true, appConfigExecuted:false}));
`);
  const result = JSON.parse(await command(['vue.ts'], consumer));
  if (!result.vue || !result.workerClosed) throw new Error('Isolated Vue worker consumer failed');
  console.log(JSON.stringify({scope: 'vue-slice', ...result}));
}

async function verifyPackagedBrowser(consumer: string): Promise<void> {
  fs.writeFileSync(path.join(consumer, 'browser-modules.ts'), `
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createWebApiModuleLoader } from 'halfcode-lite-browser-support/web-api';
import { runDebugCode } from 'halfcode-lite-browser-support/debug-code';
import { resolveDiscoveredFunction, resolveModulePath } from 'halfcode-lite-browser-support/registry';
const registryRoot = path.join(process.cwd(), 'debug/skills/notes/browser-functions');
await fs.mkdir(registryRoot, { recursive: true });
await fs.writeFile(path.join(registryRoot, 'registry.json'), JSON.stringify({ functions: [{ fqn: 'Notes.Fetch', module: 'fetch.js' }] }));
await fs.writeFile(path.join(registryRoot, 'fetch.js'), 'export default async () => (await client_fetch("https://notes.test/")).text();');
const found = resolveDiscoveredFunction({ cwd: process.cwd(), capsule: 'debug' }, 'Notes.Fetch');
const loader = createWebApiModuleLoader();
const before = Object.getOwnPropertyDescriptor(globalThis, 'client_fetch');
try {
  const modulePath = resolveModulePath(found.registryFile, found.entry.module);
  const result = await Promise.all(['a', 'b'].map(value => loader.run({ modulePath, input: {}, clientFetch: async () => new Response(value) })));
  if (result.join(',') !== 'a,b' || Object.getOwnPropertyDescriptor(globalThis, 'client_fetch') !== before) throw new Error('Fetch authority leaked');
} finally { await loader.close(); }
const bundlePath = path.join(registryRoot, 'bundle.js');
await fs.writeFile(path.join(registryRoot,'helper.js'), 'export async function read(url){return (await client_fetch(url)).text();}');
await fs.writeFile(bundlePath, 'import {read} from "./helper.js"; export function resolve_browser_function(){return {url:"https://notes.test"};} export function run_web_api(url){return read(url);}');
const debug = await Promise.all(['a','b'].map(value => runDebugCode({bundlePath,code:'run_web_api(resolve_browser_function().url)',clientFetch:async()=>new Response(value)})));
if(debug.join(',')!=='a,b'||Object.getOwnPropertyDescriptor(globalThis,'client_fetch')!==before)throw new Error('Debug exports lost sync helpers or fetch isolation');
console.log(JSON.stringify({ moduleLoader: true, registry: true, debugExports:true, globalsUntouched: true }));
`);
  const moduleResult = JSON.parse(await command(['browser-modules.ts'], consumer));
  if (!moduleResult.moduleLoader || !moduleResult.globalsUntouched) throw new Error('Packed Web API module consumer failed');
  fs.writeFileSync(path.join(consumer, 'browser.ts'), `
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { materializeOpenCliPlugin, createOpenCliEffect, createEgoBrowserSupervisor } from 'halfcode-lite-browser-support';
const directory = await materializeOpenCliPlugin({ cacheRoot: path.join(process.cwd(), 'plugin-cache') });
const files = await fs.readdir(directory);
if (files.length !== 5) throw new Error('Plugin closure missing');
const requestModule = await import(path.join(directory, 'request.js'));
const request = requestModule.parseBrowserFetchRequest('{"url":"https://example.test"}');
if (request.origin !== 'https://example.test') throw new Error('Plugin module failed');
let calls = 0;
const provider = createOpenCliEffect({ session: 'notes-isolated', pluginDir: directory, run: async (args) => {
  calls++;
  if (args[0] === 'plugin') return { code: 0, stdout: args[1] === 'list' ? 'cli-host-opencli' : '', stderr: '' };
  if (args[0] !== 'cli-host-opencli') throw new Error('Wrong plugin identity');
  return { code: 0, stdout: JSON.stringify({ ok: true, status: 200, text: 'notes' }), stderr: '' };
} });
if (calls) throw new Error('Construction started browser');
const response = await provider.browserFetch({ url: 'https://example.test', method: 'GET', headers: {} });
if (response.text !== 'notes' || calls !== 2) throw new Error('Provider dispatch failed');
const events = [];
function supervisor(name) { return createEgoBrowserSupervisor({ taskSpace: name, effect: {
  transport: 'ego-browser', session: name, browserFetch: async () => ({ok:true,status:200,statusText:'',url:'',contentType:'',text:name}),
}, prepareTaskSpace: async () => { events.push(name); } }); }
const a = supervisor('notes-a'), b = supervisor('notes-b');
await a.prepare(); await a.close();
let rejected = false;
try { await a.prepare(); } catch { rejected = true; }
if (!rejected) throw new Error('Closed supervisor restarted');
const other = await b.browserFetch({ url: 'https://example.test', method: 'GET', headers: {} });
await b.close();
if (other.text !== 'notes-b' || events.join(',') !== 'notes-a,notes-b') throw new Error('Lifecycle leaked');
console.log(JSON.stringify({ browser: true, pluginFiles: files.length, isolated: true }));
`);
  const result = JSON.parse(await command(['browser.ts'], consumer));
  if (!result.browser || !result.isolated) throw new Error('Packed browser consumer failed');
  // Prove raw assets survive compilation with no installed source tree at runtime.
  const binary = path.join(consumer, process.platform === 'win32' ? 'browser-smoke.exe' : 'browser-smoke');
  await command(['build', '--compile', 'browser.ts', '--outfile', binary], consumer);
  const installed = path.join(consumer, 'node_modules');
  const detached = path.join(consumer, 'detached-modules');
  fs.renameSync(installed, detached);
  try {
    const runRoot = path.join(consumer, 'compiled-run');
    fs.mkdirSync(runRoot);
    const child = Bun.spawn([binary], { cwd: runRoot, env: { ...process.env, NODE_PATH: '' }, stdout: 'pipe', stderr: 'pipe' });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    if (code !== 0 || !JSON.parse(stdout).browser) throw new Error('Compiled browser closure failed: ' + stderr);
  } finally { fs.renameSync(detached, installed); }
  console.log(JSON.stringify({scope: 'browser-slice', ...result, ...moduleResult, compiledAssets: true, realBrowser: 'NOT_RUN'}));
}

async function verifyPackagedSkillApp(consumer: string): Promise<void> {
  const app = path.join(consumer, 'notes');
  const functions = path.join(app, 'functions');
  fs.mkdirSync(functions, { recursive: true });
  fs.writeFileSync(path.join(app, 'manifest.xnl'), `<SkillApp #Notes.App envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (
    <Catalogs [
      <DirectoryResourceCatalog #functions { resourceKind = "LocalFunctionBundle" root = "vfs://./functions/" entry = "manifest.xnl" scope = "root" }>
      <DirectoryResourceCatalog #workflows { resourceKind = "PageWorkflowBundle" root = "vfs://./workflows/" entry = "manifest.xnl" scope = "root" }>
      <ManifestResourceCatalog #pages { resourceKind = "Page" root = "vfs://./pages/" entry = "manifest.xnl" }>
      <ManifestResourceCatalog #sites { resourceKind = "Site" root = "vfs://./sites/" entry = "manifest.xnl" }>
    ]>
  )>`);
  fs.mkdirSync(path.join(app, 'pages/home'), { recursive: true });
  fs.mkdirSync(path.join(app, 'sites/notes'), { recursive: true });
  fs.writeFileSync(path.join(app, 'pages/home/manifest.xnl'), `<Page #Notes.Page.Home envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    name = "home" description = "Independent Notes" localFunctions = ["Notes.LocalFunction.Echo"]
  }>`);
  fs.writeFileSync(path.join(app, 'pages/home/index.html'), '<h1>Independent Notes</h1>');
  fs.writeFileSync(path.join(app, 'sites/notes/manifest.xnl'), `<Site #Notes.Site.Main envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    name = "notes" description = "Notes site" defaultMount = "home"
  } (<PageMounts [<PageMount #home { path = "/" pageFqn = "Notes.Page.Home" }> ]>)>`);
  const workflows = path.join(app, 'workflows');
  fs.mkdirSync(workflows);
  fs.writeFileSync(path.join(workflows, 'manifest.xnl'), `<PageWorkflowBundle #Notes.Workflows envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    entry = "vfs://./bundle.js" runtime = "bun"
  }>`);
  fs.writeFileSync(path.join(workflows, 'bundle.js'), `
const { definePageWorkflow } = globalThis.Notes;
export const resourceDefinitions = [definePageWorkflow({
  fqn: 'Notes.Workflow.Read', runtimeCapabilities: ['page'],
  selectionPolicy: { kind: 'external-page', urlPattern: '^https://notes.test/', cardinality: 'exactly-one' },
  defaultSelector: { direct: { byExternalPage: {} } },
  inputSchema: { type: 'object' }, outputSchema: { type: 'string' },
  async start(runtime) { return (await runtime.page.session.send('Runtime.evaluate', { expression: 'document.title' })).result.value; },
})];
`);
  fs.writeFileSync(path.join(functions, 'manifest.xnl'), `<LocalFunctionBundle #Notes.Functions envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {
    entry = "vfs://./bundle.js" runtime = "bun"
  }>`);
  fs.writeFileSync(path.join(functions, 'bundle.js'), `
const { defineLocalFunction } = globalThis.Notes;
export const resourceDefinitions = [defineLocalFunction({
  fqn: 'Notes.LocalFunction.Echo', operation: 'query',
  inputSchema: { type: 'string' }, configSchema: { type: 'null' }, outputSchema: { type: 'string' },
  runtimeCapabilities: [], handler: (_runtime, input) => input,
}), defineLocalFunction({
  fqn: 'Notes.LocalFunction.Write', operation: 'action',
  inputSchema: { type: 'string' }, configSchema: { type: 'null' }, outputSchema: { type: 'string' },
  runtimeCapabilities: ['sqlite', 'workspace'],
  async handler(runtime, input) {
    const db = runtime.sqlite.open('.notes/data.sqlite');
    db.exec('create table if not exists notes (value text)');
    db.transaction(() => db.prepare('insert into notes values (?)').run(input))();
    if (input === 'fail') throw new Error('fixture handler failure');
    await runtime.workspace.writeTextAtomic('note.txt', input);
    return db.query('select value from notes order by rowid desc limit 1').get().value;
  },
})];
`);
  fs.writeFileSync(path.join(consumer, 'skill-app.ts'), `
import { createResourceHostRuntime } from 'halfcode-lite-skill-app-capsule';
import { createLocalFunctionCatalog, localFunctionPlacement } from 'halfcode-lite-skill-app-logic/local-function';
import { createSqliteConnectionScope } from 'halfcode-lite-skill-app-support/sqlite';
import { createWorkspaceEffect } from 'halfcode-lite-skill-app-support/workspace';
import { createPageHostRuntime, createPageProjectionRuntime } from 'halfcode-lite-live-host-capsule/pages';
import { createPageHttpApp } from 'halfcode-lite-http-shell/page-http';
import { createPageAutomationPlatform } from 'halfcode-lite-skill-app-support/page-automation-platform';
import { createPageBuildPlatform } from 'halfcode-lite-skill-app-support/page-build-platform';
import { createFilePageGenerationStore } from 'halfcode-lite-skill-app-support/page-generation-store';
import { installResourceDefinitionGlobals } from 'halfcode-lite-skill-app-support/resources/definition-globals';
const host = createResourceHostRuntime({workspaceRoot: process.cwd(), sources: [{root: 'notes', scope: 'root', origin: 'notes'}], privateDirectory: '.notes'}, {
  beforeLoadDefinitions() { installResourceDefinitionGlobals({target:globalThis},{},{names:['Notes']}); },
});
const resources = host.resourceCatalog;
const snapshot = await resources.snapshot();
if (!snapshot.ready) throw new Error(JSON.stringify(snapshot.diagnostics));
const definition = await host.definitionCatalog.detail('Notes.LocalFunction.Echo');
if (definition.kind !== 'LocalFunction') throw new Error('Wrong kind');
const scopes = new WeakMap(), handles = [];
const functions = createLocalFunctionCatalog(host.definitionCatalog, {
  async buildRuntime() {
    const scope = createSqliteConnectionScope(process.cwd());
    const capabilities = { workspace: createWorkspaceEffect(process.cwd()), sqlite: { open(file) {
      const db = scope.open(file); handles.push(db); return db;
    } } };
    scopes.set(capabilities, scope);
    return capabilities;
  },
  releaseRuntime(capabilities) { scopes.get(capabilities).dispose(); scopes.delete(capabilities); },
});
const result = await functions.invoke({}, definition.fqn, 'isolated-echo', null);
if (result !== 'isolated-echo') throw new Error('Wrong result');
const prepared = await functions.prepare(definition.fqn);
if (localFunctionPlacement(prepared.descriptor.runtimeCapabilities) !== 'local' || await prepared.invoke({}, 'prepared-echo', null) !== 'prepared-echo') throw new Error('Public pinned LocalFunction admission failed');
let rejected = false;
try { await functions.invoke({}, definition.fqn, 42, null); } catch { rejected = true; }
if (!rejected) throw new Error('Input schema was bypassed');
if (await functions.invoke({}, 'Notes.LocalFunction.Write', 'packed-sqlite', null) !== 'packed-sqlite') throw new Error('SQLite action failed');
let failureMessage;
try { await functions.invoke({}, 'Notes.LocalFunction.Write', 'fail', null); } catch (error) { failureMessage = error.message; }
if (failureMessage !== 'fixture handler failure' || handles.length !== 2) throw new Error('Failure path mismatch: ' + JSON.stringify({failureMessage, handles: handles.length}));
for (const handle of handles) {
  let closed = false;
  try { handle.query('select 1'); } catch { closed = true; }
  if (!closed) throw new Error('Invocation leaked a connection');
}
function coordinator(name) { return createPageHostRuntime({
  resources: host.resourceCatalog, definitions: host.definitionCatalog,
  workspace: () => createWorkspaceEffect(process.cwd()), automationPlatform: createPageAutomationPlatform(), buildPlatform: createPageBuildPlatform(),
  generationStore: createFilePageGenerationStore(process.cwd(), '.notes/builds-' + name),
  builder: { async watch() { throw new Error('Static Page must not start a builder'); } },
  browser: () => ({
    listTabs: async () => [{ targetId: name, type: 'page', url: 'https://notes.test/' }],
    selectTab: async () => {}, navigate: async () => {}, evaluate: async () => name, download: async () => {},
  }),
}); }
const a = coordinator('notes-a'), b = coordinator('notes-b');
const projection = createPageProjectionRuntime({
  resources: host.resourceCatalog, definitions: host.definitionCatalog,
  buildPlatform: createPageBuildPlatform(), generationStore: createFilePageGenerationStore(process.cwd(), '.notes/projection'),
  builder: { async watch() { throw new Error('Static projection must not start a builder'); } },
});
if ('workflows' in projection || (await projection.pages.get('home'))?.name !== 'home') throw new Error('Page projection acquired a live coordinator or lost its catalog');
await projection.close();
const page = await a.pages.get('home');
const asset = await a.pages.asset('home', 'index.html');
const site = await a.sites.get('notes');
if (page?.localFunctions[0] !== 'Notes.LocalFunction.Echo' || new TextDecoder().decode(asset?.body) !== '<h1>Independent Notes</h1>' || site?.mounts[0].pageFqn !== 'Notes.Page.Home') throw new Error('Page/Site public composition failed');
const http = createPageHttpApp({
  targets: { get: () => undefined, request: async () => { throw new Error('No connected targets'); } },
  pages: () => a.pages, sites: () => a.sites, workflows: () => a.workflows, builds: () => a.builds,
  localFunctions: () => ({ invoke: (fqn,input,config,pages) => functions.invoke({},fqn,input,config,{pages}) }),
  invokePageObject: async () => { throw new Error('No PageObjects installed'); },
  webAsset: async () => ({body:new TextEncoder().encode('<main>Notes Shell</main>'),contentType:'text/html'}),
  moduleFederationRuntime: async () => new Uint8Array(),
});
const pageList = await (await http.request('/api/pages')).json();
if (pageList.pages[0]?.name !== 'home' || await (await http.request('/page-content/home')).text() !== '<h1>Independent Notes</h1>') throw new Error('Public HTTP catalog/assets failed');
if (!(await (await http.request('/sites/notes/')).text()).includes('Notes Shell')) throw new Error('Site shell missing');
const post = body => http.request('/api/pages/home/local-functions/invoke', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
if ((await (await post({fqn:'Notes.LocalFunction.Echo',input:'http-echo',config:null})).json()).result !== 'http-echo') throw new Error('HTTP LocalFunction not executed');
if ((await post({fqn:'Notes.LocalFunction.Write',input:'forbidden',config:null})).status !== 403) throw new Error('HTTP Page allowlist bypassed');
if ((await post({fqn:'Notes.LocalFunction.Echo',input:42,config:null})).status !== 400) throw new Error('HTTP schema bypassed');
const [runA, runB] = await Promise.all([a.workflows.start({ fqn: 'Notes.Workflow.Read', input: {} }), b.workflows.start({ fqn: 'Notes.Workflow.Read', input: {} })]);
await Promise.all([a.close(), b.close()]);
if (a.workflows.get(runA.runId)?.result !== 'notes-a' || b.workflows.get(runB.runId)?.result !== 'notes-b' || a.workflows.get(runB.runId)) throw new Error('PageWorkflow instance state leaked');
await functions.close();
let preparedClosed = false;
try { await prepared.invoke({}, 'must-not-run', null); } catch { preparedClosed = true; }
if (!preparedClosed) throw new Error('Pinned LocalFunction bypassed closed admission');
await host.close();
let definitionsClosed = false;
try { await host.definitionCatalog.list(); } catch { definitionsClosed = true; }
if (!definitionsClosed) throw new Error('Resource host accepted definitions after close');
console.log(JSON.stringify({kind: 'SkillApp', result, schemaEnforced: rejected, sqliteClosedOnSuccessAndFailure: true, pageWorkflowIsolated: true, pageSiteComposed: true, pageHttpRoutes: true, resources: snapshot.resources.map(x => x.fqn)}));
`);
  const result = JSON.parse(await command(['skill-app.ts'], consumer));
  if (!result.schemaEnforced || result.result !== 'isolated-echo') throw new Error('Skill App consumer did not execute');
  const paths = fs.readdirSync(app, { recursive: true });
  if (paths.some((file) => String(file).includes('KindDefinitions') || String(file).includes('__host_contracts__'))) {
    throw new Error('Builtin definitions leaked to workspace filesystem');
  }
  console.log(JSON.stringify({ scope: 'skill-app-slice', ...result }));
}
