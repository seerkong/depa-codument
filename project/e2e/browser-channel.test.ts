import { expect, test } from 'bun:test';
import { channelState, dispatchBrowser, validateRequest, classifyBrowserFailure, type BrowserPort } from './browser-channel';
const origin='http://127.0.0.1:9';
const fixture=(overrides:Partial<BrowserPort>={})=>({page:{invoke:async()=>({}),events:async()=>[],control:async()=>true,url:async()=>origin,...overrides},origin,timeoutMs:100,pause:async()=>{},armDeadline:(ms:number,callback:()=>void)=>{const timer=setTimeout(callback,ms);return ()=>clearTimeout(timer);}});
test('persistent channel serializes concurrency and deduplicates effects',async()=> {
  const state=channelState();let active=0,max=0,calls=0;
  const runtime=fixture({invoke:async()=>{max=Math.max(max,++active);calls++;await Bun.sleep(5);active--;return {};}});
  const a={id:'a',op:'click',args:['agent-selected']};
  const result=await Promise.all([dispatchBrowser(runtime,state,a),dispatchBrowser(runtime,state,a),dispatchBrowser(runtime,state,{id:'b',op:'fill',args:['input','text']})]);
  expect(max).toBe(1);expect(calls).toBe(2);expect(result[0]).toEqual(result[1]);
  expect((await dispatchBrowser(runtime,state,{...a,args:['different']})).error).toContain('reused');expect(calls).toBe(2);
});
test('dialog authority stays in native receipts/events across separate requests',async()=> {
  const state=channelState();let events:unknown[]=[];const calls:string[]=[];
  const runtime=fixture({events:async()=>{const result=events;events=[];return result;},invoke:async(method)=>{
    calls.push(method);
    if(method==='click')return {dialog:{type:'prompt',message:'First',url:origin}};
    if(method==='acceptDialog')events=[{method:'Page.javascriptDialogClosed'},{method:'Page.javascriptDialogOpening',params:{type:'prompt',message:'Next',url:origin}}];
    return 'actual observation';
  }});
  expect((await dispatchBrowser(runtime,state,{id:'c',op:'click',args:['button']})).result?.dialog?.message).toBe('First');
  expect((await dispatchBrowser(runtime,state,{id:'s',op:'snapshot',args:[]})).status).toBe('dialog-open');expect(calls).toEqual(['click']);
  expect((await dispatchBrowser(runtime,state,{id:'empty',op:'acceptDialog',args:[]})).error).toContain('explicit text');
  expect((await dispatchBrowser(runtime,state,{id:'answer',op:'acceptDialog',args:['AI-chosen']})).result?.dialog?.message).toBe('Next');
  expect((await dispatchBrowser(runtime,state,{id:'info',op:'info',args:[]})).result?.dialog?.message).toBe('Next');expect(calls).toEqual(['click','acceptDialog']);
});
test('uncertain timeout fences late effects, never retries, and lost user control stops',async()=> {
  const state=channelState();let calls=0;
  const runtime={...fixture({invoke:async()=>{calls++;await Bun.sleep(30);return {};}}),timeoutMs:5};
  expect((await dispatchBrowser(runtime,state,{id:'t',op:'click',args:['button']})).error).toContain('uncertain');
  expect((await dispatchBrowser(runtime,state,{id:'later',op:'click',args:['button']})).error).toContain('fenced');expect(calls).toBe(1);
  const user=channelState();expect((await dispatchBrowser(fixture({control:async()=>false}),user,{id:'user',op:'snapshot',args:[]})).error).toContain('control');
});
test('limited commands reject external navigation and arbitrary evaluation',()=> {
  expect(()=>validateRequest({id:'x',op:'goto',args:['https://outside.invalid']},origin)).toThrow('outside');
  for(const op of ['evaluate','fetch','cdp','finish','claim','create'])expect(()=>validateRequest({id:'x',op,args:[]},origin)).toThrow('Invalid');
});
test('native navigation via a click cannot escape leased-origin admission',async()=> {
  const state=channelState();
  expect((await dispatchBrowser(fixture({url:async()=>'https://outside.invalid'}),state,{id:'link',op:'click',args:['a']})).error).toContain('left leased origin');
  expect((await dispatchBrowser(fixture(),state,{id:'after',op:'snapshot',args:[]})).status).toBe('error');
});
test('provider-reported timeout also fences mutations without replay',async()=> {
  const state=channelState();let calls=0;
  const runtime=fixture({invoke:async()=>{calls++;throw Error('CDP request timed out');}});
  expect((await dispatchBrowser(runtime,state,{id:'failed',op:'click',args:['button']})).error).toContain('uncertain');
  expect((await dispatchBrowser(runtime,state,{id:'retry',op:'click',args:['button']})).error).toContain('fenced');expect(calls).toBe(1);
});
test('invalid options are rejected before Page effects and corrected input can continue', async () => {
  for (const op of ['click', 'snapshot', 'waitForSelector']) {
    for (const options of ['{"label":"Fixture action"}', null, []]) {
      const state = channelState(); let calls = 0;
      const runtime = fixture({invoke: async () => { calls++; return 'observed'; }});
      const args = op === 'snapshot' ? [options] : ['button', options];
      expect((await dispatchBrowser(runtime, state, {id: 'bad', op, args})).error).toContain('options must be an object');
      expect(calls).toBe(0); expect(state.stopped).toBeNull();
      expect((await dispatchBrowser(runtime, state, {id: 'good', op: 'snapshot', args: []})).status).toBe('ok');
    }
  }
});
test('a supported timeout option mentioned in TypeError is not a native timeout', async () => {
  const state = channelState(); let calls = 0;
  const runtime = fixture({invoke: async () => {
    if (++calls === 1) throw new TypeError('page.click options must be an object. Expected: await page.click(selector, { timeout?, label? })');
    return 'observed';
  }});
  expect((await dispatchBrowser(runtime, state, {id: 'bad', op: 'click', args: ['button']})).error).toStartWith('TypeError:');
  expect(state.stopped).toBeNull();
  expect((await dispatchBrowser(runtime, state, {id: 'next', op: 'snapshot', args: []})).status).toBe('ok');
  expect(calls).toBe(2);
});
test('explicit late-effect flags and named provider timeouts remain fenced', async () => {
  const errors = [
    Object.assign(new TypeError('SDK failure'), {mayHaveLateEffects: true}),
    Object.assign(new Error('Deadline exceeded'), {name: 'CdpRequestTimeoutError'}),
    Object.assign(new Error('page.click timed out after 3000ms: page.click failed: element is disabled'), {name:'ElementResolutionError',mayHaveLateEffects:true}),
  ];
  for (const error of errors) {
    const state = channelState(); let calls = 0;
    const runtime = fixture({invoke: async () => { calls++; throw error; }});
    expect((await dispatchBrowser(runtime, state, {id: 'failed', op: 'click', args: ['button']})).error).toContain('uncertain');
    expect((await dispatchBrowser(runtime, state, {id: 'later', op: 'snapshot', args: []})).error).toContain('fenced');
    expect(calls).toBe(1);
  }
});
test.each([
  new TypeError('Cannot read properties of undefined after native input'),
  new TypeError('page.fill options must be an object'),
  new TypeError('page.click options must be an object. Expected: await page.click(selector, { timeout?, label? }); another failure'),
])('an unknown native TypeError is not evidence of safe input rejection: %s', async error => {
  const state = channelState(); let calls = 0;
  const runtime = fixture({invoke: async () => { calls++; throw error; }});
  expect((await dispatchBrowser(runtime,state,{id:'unknown',op:'click',args:['button']})).failure).toMatchObject({kind:'execution-uncertain',recoverable:false,mayHaveLateEffects:true});
  expect((await dispatchBrowser(runtime,state,{id:'observe',op:'snapshot',args:[]})).error).toContain('fenced');
  expect(calls).toBe(1);
});
test('known SDK argument diagnostics cannot override another operation or dispatch facts', () => {
  const error = new TypeError('page.click options must be an object. Expected: await page.click(selector, { timeout?, label? })');
  expect(classifyBrowserFailure(error,'fill').recoverable).toBe(false);
  expect(classifyBrowserFailure(error,'click','after-dispatch').recoverable).toBe(false);
  expect(classifyBrowserFailure(Object.assign(error,{mayHaveLateEffects:true}),'click').recoverable).toBe(false);
});
test.each([
  'page.click timed out after 3000ms: page.click failed: element is disabled',
  'page.click timed out after 3000ms: Selector #disabled matched 1 elements, but none can receive input; element is disabled',
])('documented disabled-element rejection is recoverable: %s', async (message) => {
  const state = channelState(); let calls = 0;
  const runtime = fixture({invoke: async () => {
    if (++calls === 1) throw Object.assign(new Error(message), {name: 'ElementResolutionError'});
    return 'observed';
  }});
  expect((await dispatchBrowser(runtime, state, {id: 'disabled', op: 'click', args: ['button']})).error).toContain('element is disabled');
  expect(state.stopped).toBeNull();
  expect((await dispatchBrowser(runtime, state, {id: 'observe', op: 'snapshot', args: []})).status).toBe('ok');
  expect(calls).toBe(2);
});
test('snapshots default to full-page discovery while explicit scope remains available', () => {
  expect(validateRequest({id:'full',op:'snapshot',args:[]},origin).args).toEqual([{scope:'full_page'}]);
  expect(validateRequest({id:'viewport',op:'snapshot',args:[{scope:'only_within_viewport'}]},origin).args).toEqual([{scope:'only_within_viewport'}]);
});
test('failure taxonomy separates read-only predicates, stale/pre-dispatch refusal and uncertain effects',()=>{
  expect(classifyBrowserFailure(Object.assign(new Error('not visible'),{kind:'predicate-unmet'}),'waitForSelector')).toMatchObject({kind:'predicate-unmet',recoverable:true});
  expect(classifyBrowserFailure(new Error('page.waitForSelector timed out after 500ms: selector not visible'),'waitForSelector')).toMatchObject({kind:'predicate-unmet',recoverable:true});
  expect(classifyBrowserFailure(new Error('CDP request timed out'),'waitForSelector')).toMatchObject({kind:'execution-uncertain',recoverable:false});
  expect(classifyBrowserFailure(Object.assign(new Error('late'),{kind:'predicate-unmet',mayHaveLateEffects:true}),'waitForSelector')).toMatchObject({recoverable:false});
  expect(classifyBrowserFailure(new Error('unknown mutation failure'),'click')).toMatchObject({mayHaveLateEffects:true,recoverable:false});
  expect(classifyBrowserFailure(new TypeError('timeout?'),'click','after-dispatch')).toMatchObject({recoverable:false});
});
test('predicate timeout allows re-observation but does not masquerade as successful state',async()=>{
  const state=channelState();const runtime=fixture({invoke:async(op)=>{if(op==='waitForSelector')throw new Error('page.waitForSelector timed out after 500ms: not visible');return 'actual';}});
  expect((await dispatchBrowser(runtime,state,{id:'wait',op:'waitForSelector',args:['#condition',{timeout:500}]})).failure).toMatchObject({kind:'predicate-unmet',recoverable:true});
  const observation=await dispatchBrowser(runtime,state,{id:'observe',op:'snapshot',args:[]});
  expect(observation.status).toBe('ok');expect(observation.result?.observationId).toBe('observe');
  for(const timeout of [0,Infinity,8001])expect(()=>validateRequest({id:'w',op:'waitForSelector',args:['#condition',{timeout}]},origin)).toThrow();
});
test('non-editable fill rejection permits rediscovery, not replay of uncertain writes',async()=>{
  const error=new Error('page.fill failed: element is not an input, textarea, or contenteditable element');
  const state=channelState();let calls=0;
  const runtime=fixture({invoke:async(op)=>{calls++;if(op==='fill')throw error;return 'unchanged native observation';}});
  const rejected=await dispatchBrowser(runtime,state,{id:'wrong-target',op:'fill',args:['button','text']});
  expect(rejected.failure).toEqual({kind:'precondition-rejected',recoverable:true,mayHaveLateEffects:false});
  expect((await dispatchBrowser(runtime,state,{id:'rediscover',op:'snapshot',args:[]})).status).toBe('ok');
  expect(calls).toBe(2);
  expect(classifyBrowserFailure(Object.assign(error,{mayHaveLateEffects:true}),'fill')).toMatchObject({recoverable:false});
  expect(classifyBrowserFailure(error,'fill','after-dispatch')).toMatchObject({recoverable:false});
  expect(classifyBrowserFailure(new Error(`${error.message}; CDP request timed out`),'fill')).toMatchObject({recoverable:false});
});

test.each([
  ['click', 'page.click failed:'],
  ['fill', 'page.fill failed:'],
  ['click', 'Selector #covered matched 1 elements, but none can receive input;'],
])('exact native pointer interception allows observation without replay: %s %s', async (op, detail) => {
  const error = Object.assign(new Error(`page.${op} timed out after 3000ms: ${detail} <aside> intercepts pointer events`), {name:'ElementResolutionError'});
  const state = channelState(); const calls: string[] = [];
  const runtime = fixture({invoke:async(method)=>{ calls.push(method); if(method===op)throw error; return 'unchanged'; }});
  const args = op==='fill' ? ['#input','text'] : ['#button'];
  expect((await dispatchBrowser(runtime,state,{id:'blocked',op,args})).failure).toEqual({kind:'precondition-rejected',recoverable:true,mayHaveLateEffects:false});
  expect((await dispatchBrowser(runtime,state,{id:'observe',op:'snapshot',args:[]})).status).toBe('ok');
  expect(calls).toEqual([op,'snapshot']);
  expect(classifyBrowserFailure(error,op,'after-dispatch').recoverable).toBe(false);
  expect(classifyBrowserFailure(Object.assign(error,{mayHaveLateEffects:true}),op).recoverable).toBe(false);
});

test('interception-like unknown diagnostics remain uncertain', () => {
  const message='page.fill timed out after 3000ms: page.fill failed: <aside> intercepts pointer events';
  for(const error of [new Error(message),Object.assign(new Error(`${message}; CDP request timed out`),{name:'ElementResolutionError'})]) {
    expect(classifyBrowserFailure(error,'fill').recoverable).toBe(false);
  }
  expect(classifyBrowserFailure(Object.assign(new Error(message),{name:'ElementResolutionError'}),'click').recoverable).toBe(false);
});

test('selection and empty text arguments retain native capabilities without guessing data', () => {
  for(const value of ['', 'label', {value:''}, {label:'label'}, {index:0}, [], null, ['one',{value:'two'}]]) {
    expect(validateRequest({id:'selection',op:'selectOption',args:['select',value]},origin).args[1]).toEqual(value);
  }
  expect(validateRequest({id:'clear',op:'fill',args:['input','']},origin).args[1]).toBe('');
  for(const value of [true, 2, {}, {index:-1}, {index:0.5}, {value:2}, {force:true}, ['one',false]]) {
    expect(()=>validateRequest({id:'bad',op:'selectOption',args:['select',value]},origin)).toThrow('Selection');
  }
});

test('an absent single option permits rediscovery, never effect replay or partial selection assumptions', async () => {
  const message='page.selectOption timed out after 3000ms: page.selectOption failed: option "all" was not found; available options: 0: value="", label="Any choice"; 1: value="enabled", label="Enabled"';
  const error=Object.assign(new Error(message),{name:'ElementResolutionError'});
  const state=channelState();const calls:string[]=[];
  const runtime=fixture({invoke:async(op)=>{calls.push(op);if(op==='selectOption')throw error;return 'unchanged';}});
  expect((await dispatchBrowser(runtime,state,{id:'absent',op:'selectOption',args:['select','all']})).failure).toEqual({kind:'precondition-rejected',recoverable:true,mayHaveLateEffects:false});
  expect((await dispatchBrowser(runtime,state,{id:'observe',op:'snapshot',args:[]})).status).toBe('ok');
  expect(calls).toEqual(['selectOption','snapshot']);
  for(const args of [undefined,['select',['valid','missing']],['select',{index:8}]]) expect(classifyBrowserFailure(error,'selectOption','invoke',args).recoverable).toBe(false);
  expect(classifyBrowserFailure(error,'selectOption','after-dispatch',['select','all']).recoverable).toBe(false);
  expect(classifyBrowserFailure(Object.assign(new Error(message),{name:'ElementResolutionError',mayHaveLateEffects:true}),'selectOption','invoke',['select','all']).recoverable).toBe(false);
  expect(classifyBrowserFailure(Object.assign(new Error(message+'; CDP request timed out'),{name:'ElementResolutionError'}),'selectOption','invoke',['select','all']).recoverable).toBe(false);
});
