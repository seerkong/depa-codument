import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execute, sandbox, writeJson, type Run } from './runtime';
import { egoSpace, resolveEgo } from './ego-tools';
import { startBrowserChannel } from './browser-owner';

/** Only our known fixture, never a generated application's business workflow. */
export async function probeEgo(run: Run): Promise<void> {
  const id = egoSpace(), probeId = randomUUID(), marker = `probe-${probeId}`;
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('<!doctype html><input id="input"><button id="submit" onclick="document.querySelector(\'main\').textContent=document.querySelector(\'input\').value">Show</button><button id="dialog" onclick="prompt(\'Harness dialog probe\')">Dialog</button><button id="chain" onclick="const a=prompt(\'Fixture first\');const b=prompt(\'Fixture second\');document.querySelector(\'aside\').textContent=a+\':\'+b">Chain</button><main></main><aside></aside>', { headers: { 'content-type': 'text/html' } }) });
  const origin = `http://127.0.0.1:${server.port}`;
  const script = `const task=await taskSpace(${id}); const page=task.page("p1"); await page.goto(${JSON.stringify(origin)}); console.log(await page.snapshot()); await page.fill("#input",${JSON.stringify(marker)}); await page.click("#submit"); await page.waitForFunction((marker)=>document.querySelector("main").textContent===marker,${JSON.stringify(marker)},{timeout:10000}); console.log(await page.click("#dialog")); const dismissed=await page.dismissDialog(); if(!dismissed)throw Error("Harness dialog was not observed"); console.log("dialog-recovered"); await page.events(); console.log(await page.click("#chain")); await page.acceptDialog("fixture-a"); const deadline=Date.now()+5000; let events=[]; while(Date.now()<deadline){events.push(...await page.events()); if(JSON.stringify(events).includes("Fixture second"))break; await new Promise(resolve=>setTimeout(resolve,100));} console.log({events}); if(!JSON.stringify(events).includes("Fixture second"))throw Error("Follow-on dialog not observable"); await page.acceptDialog("fixture-b"); console.log(await page.snapshot());`;
  const log = path.join(run.root, `logs/ego-probe-${probeId}.log`);
  try {
    const result = await execute({ argv: sandbox(run, [resolveEgo().executable, 'nodejs', '-e', script], 'acceptance', true), cwd: run.workspace, env: run.env, log, timeoutMs: 40_000 });
    const output = fs.readFileSync(log, 'utf8');
    const passed = result.code === 0 && output.includes(marker) && output.includes('dialog-recovered') && output.includes('fixture-a:fixture-b');
    writeJson(path.join(run.root, `ego-preflight-${probeId}.json`), { status: passed ? 'passed' : 'infrastructure-failed', spaceId: id, origin, log, ...result });
    if (!passed) throw new Error(`Ego page-control preflight failed before model use: ${output.slice(-3000)}`);
  } finally { server.stop(true); }
}

/** Calibration of our transport protocol, not a generated application's oracle. */
export async function probePersistentBrowser(run: Run): Promise<void> {
  const probeId=randomUUID(),marker=`channel-${probeId}`;
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:(request)=> {
    const route = new URL(request.url).pathname;
    let html: string;
    if (route === '/obstructed') html = '<!doctype html><input id="covered" oninput="document.querySelector(\'main\').textContent=\'unexpected-dispatch\'"><aside style="position:fixed;inset:0;background:white;z-index:999">Fixture overlay</aside><main>no-input-dispatched</main>';
    else if (route === '/selection') html = '<!doctype html><input id="editable" oninput="document.querySelector(\'main\').textContent=this.value || \'empty-input\'"><select id="select" onchange="document.querySelector(\'aside\').textContent=this.value || \'empty-selection\'"><option value="">Any choice</option><option value="enabled">Enabled</option></select><main>no-input-dispatched</main><aside>no-selection-dispatched</aside>';
    else html = '<!doctype html><input id="input"><button id="show" onclick="document.querySelector(\'main\').textContent=document.querySelector(\'input\').value">Show</button><button id="disabled" disabled onclick="document.querySelector(\'main\').textContent=\'unexpected-disabled-click\'">Disabled</button><button id="offscreen" style="position:absolute;top:4000px" onclick="document.querySelector(\'aside\').textContent=\'offscreen-clicked\'">Offscreen fixture action</button><button id="chain" onclick="const a=prompt(\'Fixture first\');const b=prompt(\'Fixture second\');document.querySelector(\'aside\').textContent=a+\':\'+b">Chain</button><main></main><aside></aside>';
    return new Response(html,{headers:{'content-type':'text/html'}});
  }});
  const origin=`http://127.0.0.1:${server.port}`;
  let channel:Awaited<ReturnType<typeof startBrowserChannel>>|undefined;
  const rounds:unknown[]=[];
  try {
    channel=await startBrowserChannel(run,origin,egoSpace(),`probe-${probeId}`);
    const command=async(op:string,args:unknown[]=[],id=randomUUID(),expectedError=false)=> {
      const log=path.join(run.root,`logs/channel-client-${randomUUID()}.log`);
      const result=await execute({argv:sandbox(run,[process.execPath,channel!.client,channel!.connection,JSON.stringify({id,op,args})],'acceptance'),cwd:run.workspace,env:run.env,log,timeoutMs:35000});
      if(result.code!==(expectedError ? 1 : 0))throw Error(`Browser client failed: ${fs.readFileSync(log,'utf8')}`);
      return JSON.parse(fs.readFileSync(log,'utf8')) as import('./browser-channel').BrowserResponse;
    };
    for(let round=0;round<3;round++) {
      await command('goto',[`${origin}/selection`]);
      const absentOption=await command('selectOption',['#select','not-a-fixture-option'],randomUUID(),true);
      if(absentOption.failure?.kind!=='precondition-rejected' || !absentOption.failure.recoverable)throw Error(`Absent single option not recoverable: ${JSON.stringify(absentOption)}`);
      if(!(await command('snapshot')).result?.snapshot?.includes('no-selection-dispatched'))throw Error('Absent option dispatched a change or fenced observation');
      await command('selectOption',['#select','enabled']);
      await command('selectOption',['#select','']);
      await command('fill',['#editable',marker]);
      await command('fill',['#editable','']);
      const emptyState=(await command('snapshot')).result?.snapshot;
      if(!emptyState?.includes('empty-input') || !emptyState.includes('empty-selection'))throw Error('Legal empty values were not accepted by native inputs');
      await command('goto',[`${origin}/obstructed`]);
      const intercepted=await command('click',['#covered'],randomUUID(),true);
      if(intercepted.failure?.kind!=='precondition-rejected' || !intercepted.failure.recoverable)throw Error(`Pointer interception not recoverable: ${JSON.stringify(intercepted)}`);
      const afterInterception=await command('snapshot');
      if(afterInterception.status!=='ok' || !afterInterception.result?.snapshot?.includes('no-input-dispatched') || afterInterception.result.snapshot.includes('unexpected-dispatch'))throw Error('Intercepted pointer action dispatched input or fenced observation');
      await command('goto',[origin]);
      const rejected=await command('click',['#show','malformed options'],randomUUID(),true);
      if(rejected.status!=='error' || !rejected.error?.includes('options must be an object'))throw Error('Malformed options were not rejected');
      const discovery=await command('snapshot');
      if(discovery.status!=='ok')throw Error('Invalid arguments fenced the live session');
      const wrongTarget=await command('fill',['#show','must-not-change'],randomUUID(),true);
      if(wrongTarget.failure?.kind!=='precondition-rejected' || !wrongTarget.failure.recoverable)throw Error(`Non-editable fill target not recoverable: ${JSON.stringify(wrongTarget)}`);
      const unchanged=await command('snapshot');
      if(unchanged.status!=='ok' || unchanged.result?.snapshot?.includes('must-not-change'))throw Error('Rejected fill mutated the page or fenced observation');
      const predicate=await command('waitForSelector',['#absent-harness-fixture',{timeout:250}],randomUUID(),true);
      if(predicate.failure?.kind!=='predicate-unmet' || !predicate.failure.recoverable)throw Error(`Read-only predicate not recoverable: ${JSON.stringify(predicate)}`);
      if((await command('snapshot')).status!=='ok')throw Error('Predicate wait fenced subsequent observation');
      if(!discovery.result?.snapshot?.includes('Offscreen fixture action'))throw Error('Default snapshot omitted an offscreen control');
      const disabled=await command('click',['#disabled'],randomUUID(),true);
      if(!disabled.error?.includes('element is disabled'))throw Error('Disabled actionability rejection not observed');
      const recovery=await command('snapshot');
      if(recovery.status!=='ok' || recovery.result?.snapshot?.includes('unexpected-disabled-click'))throw Error('Disabled control dispatched an action or fenced observation');
      await command('click',['#offscreen']);
      if(!(await command('snapshot')).result?.snapshot?.includes('offscreen-clicked'))throw Error('Discovered offscreen control was not operable');
      await command('fill',['#input',marker]);await command('click',['#show']);
      if(!(await command('snapshot')).result?.snapshot?.includes(marker))throw Error('Actual visible click result missing');
      if((await command('click',['#chain'])).result?.dialog?.message!=='Fixture first')throw Error('First dialog not observed');
      const blocked=await command('snapshot');if(blocked.status!=='dialog-open')throw Error('Snapshot did not short-circuit pending dialog');
      const id=randomUUID();const answer=await command('acceptDialog',['fixture-a'],id);
      if(answer.result?.dialog?.message!=='Fixture second')throw Error('Follow-on dialog lost across client calls');
      const duplicate=await command('acceptDialog',['fixture-a'],id);
      if(JSON.stringify(answer)!==JSON.stringify(duplicate))throw Error('Duplicate action replayed');
      await command('acceptDialog',['fixture-b']);
      if(!(await command('snapshot')).result?.snapshot?.includes('fixture-a:fixture-b'))throw Error('Dialog answers did not take effect');
      rounds.push({round,status:'passed',argumentRejectionRecovered:true,disabledRejectionRecovered:true,pointerInterceptionRecovered:true,absentOptionRecovered:true,emptyValuesObserved:true,offscreenDiscovery:true});
    }
    await channel.close();
    const connection=JSON.parse(fs.readFileSync(channel.connection,'utf8'));
    let reachable=false;try{await fetch(connection.endpoint,{signal:AbortSignal.timeout(1000)});reachable=true;}catch{/* endpoint really closed */}
    if(reachable)throw Error('Browser worker endpoint leaked after owner close');
    writeJson(path.join(run.root,`persistent-preflight-${probeId}.json`),{status:'passed',origin,rounds,log:channel.log,workerReleased:true});
  }finally{if(channel)await channel.close();server.stop(true);}
}
