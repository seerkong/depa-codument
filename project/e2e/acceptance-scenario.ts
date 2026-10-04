import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeJson, type Run } from './runtime';

export type RequirementChannel = 'api' | 'ui' | 'cross-boundary' | 'artifact' | 'unspecified';
export interface RequirementScope {
  id: string; channel: RequirementChannel; source: 'request.md' | 'acceptance.md'; quote: string; reason: string;
}
export interface SetupRule {
  id: string; requirementId: string; method: string; pathTemplate: string;
  source: 'request.md' | 'acceptance.md'; quote: string; reason: string;
}
export interface AcceptancePlan { requirements: RequirementScope[]; setup: SetupRule[] }
export interface ScenarioReceipt { plan: AcceptancePlan; sourceDigests: Record<string,string>; prepared: true; log: string }
export class AcceptanceProtocolError extends Error {
  constructor(message: string, readonly failureClass: 'protocol-cost' | 'scope-unresolved' = 'protocol-cost') { super(message); }
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export function validateAcceptancePlan(value: unknown, sources: Record<string,string>): asserts value is AcceptancePlan {
  const plan = value as AcceptancePlan;
  assert.ok(Array.isArray(plan?.requirements) && plan.requirements.length > 0 && plan.requirements.length <= 100, 'Declare requirement scope before preparation');
  assert.ok(Array.isArray(plan.setup) && plan.setup.length <= 30, 'Declare a finite preparation capability list');
  const ids = new Set<string>();
  for (const r of plan.requirements) {
    assert.ok(text(r.id) && !ids.has(r.id), 'Unique requirement ID required'); ids.add(r.id);
    assert.ok(['api','ui','cross-boundary','artifact','unspecified'].includes(r.channel), 'Unknown requirement channel');
    assert.ok(['request.md','acceptance.md'].includes(r.source) && text(r.quote) && sources[r.source]?.includes(r.quote), `Requirement ${r.id} must quote an exact contiguous original excerpt from ${r.source}; do not paraphrase, merge lines or remove Markdown punctuation`);
    assert.ok(text(r.reason), 'Explain the scope interpretation, including ambiguities');
  }
  for (const name of Object.keys(sources)) assert.ok(plan.requirements.some(r => r.source === name), `Scope plan must consider ${name}`);
  const setupIds = new Set<string>();
  for (const rule of plan.setup) {
    assert.ok(text(rule.id) && !setupIds.has(rule.id), 'Unique setup capability ID required'); setupIds.add(rule.id);
    assert.ok(ids.has(rule.requirementId) && text(rule.reason), 'Preparation needs a requirement and reason');
    assert.ok(['GET','POST','PUT','PATCH','DELETE'].includes(rule.method), 'Unsupported preparation HTTP method');
    assert.ok(/^\/[A-Za-z0-9_/:.~-]+$/.test(rule.pathTemplate) && !rule.pathTemplate.includes('..') && !rule.pathTemplate.includes('//'), 'Preparation path must be an origin-relative declared route');
    assert.ok(['request.md','acceptance.md'].includes(rule.source) && text(rule.quote) && sources[rule.source]?.includes(rule.quote), `Preparation ${rule.id} must quote an exact original contract excerpt from ${rule.source}`);
    assert.ok(rule.quote.includes(`${rule.method} ${rule.pathTemplate}`), `Preparation ${rule.id} route/method ${rule.method} ${rule.pathTemplate} is not declared in its quoted contract`);
  }
}
export function resolveSetupUrl(origin: string, template: string, requested: string): string {
  assert.ok(typeof requested === 'string' && requested.startsWith('/') && !requested.includes('%') && !requested.includes('\\'), 'Preparation path must be literal and origin-relative');
  const expression = template.split('/').map(segment => segment.startsWith(':') ? '[A-Za-z0-9_.~-]+' : segment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/');
  assert.match(requested, new RegExp(`^${expression}$`), 'Preparation path does not match admitted capability');
  const url = new URL(requested, origin);
  assert.ok(url.origin === origin && url.pathname === requested, 'Preparation escaped leased origin');
  return url.href;
}
export interface ScenarioRuntime {
  origin: string; sources: Record<string,string>;
  http(url: string, init: RequestInit): Promise<{status: number; body: string}>;
  record(value: unknown): void;
}
export interface ScenarioState {
  plan?: AcceptancePlan; sealed: boolean; stopped?: string; calls: number;
  successes: Set<string>; requests: Map<string,{digest:string;response:Promise<unknown>}>; queue: Promise<void>;
}
export const scenarioState = (): ScenarioState => ({sealed:false,calls:0,successes:new Set(),requests:new Map(),queue:Promise.resolve()});
/** Capability admission and serialized setup only; no generated-app oracle. */
export function dispatchScenario(runtime: ScenarioRuntime, state: ScenarioState, raw: any): Promise<unknown> {
  const hash = digest(JSON.stringify(raw));
  if (!text(raw?.id)) return Promise.resolve({status:'error',error:'Request ID required'});
  const previous = state.requests.get(raw.id);
  if (previous) return previous.digest === hash ? previous.response : Promise.resolve({status:'error',error:'Request ID reused'});
  const response = state.queue.then(async () => {
    let result: unknown;
    try {
      assert.ok(!state.sealed && !state.stopped, state.stopped ?? 'Preparation is sealed');
      if (raw.op === 'plan') {
        assert.ok(!state.plan, 'Scope plan is immutable once admitted');
        validateAcceptancePlan(raw.plan,runtime.sources);
        state.plan = JSON.parse(JSON.stringify(raw.plan));
        result = {status:'ok',plan:state.plan};
      } else if (raw.op === 'prepare') {
        assert.ok(state.plan, 'Admit a scope plan first');
        const rule = state.plan.setup.find(r => r.id === raw.setupId);
        assert.ok(rule, 'Unknown preparation capability');
        const url = resolveSetupUrl(runtime.origin,rule.pathTemplate,raw.path);
        assert.ok(state.calls < 30, 'Preparation request budget exhausted');
        assert.ok(raw.headers === undefined || (raw.headers && typeof raw.headers === 'object' && !Array.isArray(raw.headers)), 'Headers must be an object');
        const headers = new Headers({'content-type':'application/json'});
        for (const [key,value] of Object.entries(raw.headers ?? {})) {
          assert.ok(['authorization'].includes(key.toLowerCase()) && typeof value === 'string', 'Only test-user authorization header is allowed'); headers.set(key,value as string);
        }
        ++state.calls;
        try {
          const http = await runtime.http(url,{method:rule.method,headers,redirect:'error',body:rule.method === 'GET' ? undefined : JSON.stringify(raw.body ?? {})});
          if (http.status >= 200 && http.status < 300) state.successes.add(rule.id);
          result = {status:'ok',kind:'preparation-only',http};
        } catch (error) { state.stopped = `Preparation transport outcome uncertain; no replay: ${String(error)}`; throw Error(state.stopped); }
      } else if (raw.op === 'seal') {
        assert.ok(state.plan, 'Admit a scope plan first');
        assert.ok(state.plan.setup.every(r => state.successes.has(r.id)), 'Declared preparation has not succeeded');
        state.sealed = true; result = {status:'ok',prepared:true};
      } else throw Error('Unknown scenario command');
    } catch (error) { result = {status:'error',error:String(error)}; }
    runtime.record({request:raw,response:result}); return result;
  });
  state.requests.set(raw.id,{digest:hash,response}); state.queue = response.then(() => {}); return response;
}

/** Host-owned Effect; agents receive only bounded localhost preparation capability. */
export function startScenario(run: Run, origin: string, name: string) {
  const sources = Object.fromEntries(['request.md','acceptance.md'].map(n => [n,fs.readFileSync(path.join(run.workspace,n),'utf8')]));
  const log = path.join(run.root,`logs/${name}-preparation.jsonl`), token = randomUUID(), state = scenarioState();
  fs.closeSync(fs.openSync(log,'wx',0o600));
  const runtime: ScenarioRuntime = {origin,sources,record:v => fs.appendFileSync(log,JSON.stringify(v)+'\n'),http:async(url,init) => {
    const res = await fetch(url,{...init,signal:AbortSignal.timeout(8000)});
    const body = await res.text(); assert.ok(body.length <= 65536,'Preparation response too large'); return {status:res.status,body};
  }};
  const server = Bun.serve({hostname:'127.0.0.1',port:0,fetch:async(req) => {
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/command' || req.headers.get('authorization') !== `Bearer ${token}`) return new Response('',{status:403});
    if (state.sealed) return Response.json({status:'error',error:'Preparation is sealed'},{status:409});
    try { const body = await req.text(); assert.ok(body.length <= 65536,'Scenario request too large'); return Response.json(await dispatchScenario(runtime,state,JSON.parse(body))); }
    catch(error) { return Response.json({status:'error',error:String(error)},{status:400}); }
  }});
  const connection = path.join(run.home,'tmp',`${name}-scenario-connection.json`), client = path.join(run.root,'bin/scenario-client.ts');
  fs.copyFileSync(path.join(import.meta.dir,'browser-client.ts'),client);
  writeJson(connection,{endpoint:`http://127.0.0.1:${server.port}`,token});
  return {client,connection,log,close:() => server.stop(true),receipt(): ScenarioReceipt {
    assert.ok(state.plan && state.sealed && !state.stopped,'Scenario was not prepared and sealed');
    return {plan:state.plan,prepared:true,log,sourceDigests:Object.fromEntries(Object.entries(sources).map(([k,v]) => [k,digest(v)]))};
  }};
}
