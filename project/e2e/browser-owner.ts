import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { sandbox, type Run, writeJson } from './runtime';
import { resolveEgo } from './ego-tools';

/** Harness Effect lifecycle. It owns the log; agents cannot write native evidence. */
export async function startBrowserChannel(run: Run, origin: string, space: number, name: string) {
  const worker=path.join(run.root,'bin/browser-worker.mjs');
  const build=await Bun.build({entrypoints:[path.join(import.meta.dir,'browser-worker.ts')],target:'node',format:'esm'});
  if(!build.success) throw Error(`Browser worker build failed: ${build.logs}`);
  fs.writeFileSync(worker,await build.outputs[0]!.text());
  const client=path.join(run.root,'bin/browser-client.ts');fs.copyFileSync(path.join(import.meta.dir,'browser-client.ts'),client);
  const log=path.join(run.root,`logs/${name}-browser-channel.jsonl`),token=randomUUID(),adminToken=randomUUID();
  fs.closeSync(fs.openSync(log,'wx',0o600));
  const stderr=path.join(run.root,`logs/${name}-browser-process.log`),fd=fs.openSync(stderr,'wx',0o600);
  const privateConfig=path.join(run.root,'bin',`browser-private-${name}.json`);
  writeJson(privateConfig,{space,origin,token,adminToken,log});fs.chmodSync(privateConfig,0o600);
  // Owner capabilities never appear in process argv, which is visible to tools.
  const script=`const fs=await import("node:fs"); const config=JSON.parse(fs.readFileSync(${JSON.stringify(privateConfig)},"utf8")); const {startBrowserWorker}=await import(${JSON.stringify(worker)}); await startBrowserWorker(taskSpace,config);`;
  const argv=sandbox(run,[resolveEgo().executable,'nodejs','-e',script],'acceptance',true);
  // Only the harness worker may append this one native log. Reviewer sandbox
  // keeps its deny-write rule; the model cannot forge channel evidence.
  argv[2] += `(allow file-write* (literal ${JSON.stringify(log)}))`;
  const child=spawn(argv[0]!,argv.slice(1),{cwd:run.workspace,env:run.env,detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
  let spawnError:unknown;child.on('error',e=>{spawnError=e;});
  const stop=()=> {try{process.kill(-child.pid!,'SIGKILL');}catch{/* terminal */}};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  let endpoint:string|undefined;let heartbeat:ReturnType<typeof setInterval>|undefined;
  let closing:Promise<void>|undefined;
  const close=()=> closing??=(async()=> {
    if(heartbeat)clearInterval(heartbeat);process.off('SIGTERM',stop);process.off('SIGINT',stop);
    if(endpoint) {
      try {await fetch(endpoint+'/close',{method:'POST',headers:{authorization:`Bearer ${adminToken}`},signal:AbortSignal.timeout(2000)});}catch{/* watchdog closes on owner loss */}
      await Bun.sleep(100);
    }
    stop();
    fs.rmSync(privateConfig,{force:true});
  })();
  try {
    const deadline=Date.now()+15000;
    while(Date.now()<deadline) {
      for(const line of fs.readFileSync(log,'utf8').split('\n')) {try{endpoint=JSON.parse(line).channelReady??endpoint;}catch{/* native diagnostic */}}
      if(endpoint)break;
      if(spawnError || child.exitCode!==null)throw Error(`Browser worker exited: ${spawnError??fs.readFileSync(stderr,'utf8')}`);
      await Bun.sleep(50);
    }
    if(!endpoint)throw Error(`Browser worker not ready: ${fs.readFileSync(stderr,'utf8')}`);
    heartbeat=setInterval(()=>{void fetch(endpoint!+'/heartbeat',{method:'POST',headers:{authorization:`Bearer ${adminToken}`},signal:AbortSignal.timeout(2000)}).catch(()=>{});},15000);
    const connection=path.join(run.home,'tmp',`${name}-browser-connection.json`);writeJson(connection,{endpoint,token});
    return {client,connection,log,close,async command(op:string,args:unknown[]=[],id=randomUUID()) {
      const response=await fetch(endpoint+'/command',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({id,op,args}),signal:AbortSignal.timeout(35000)});
      return response.json() as Promise<import('./browser-channel').BrowserResponse>;
    }};
  }catch(error){await close();throw error;}
}
