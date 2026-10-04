/** Fresh Ego Lite acceptance agent; only the harness admits official receipts. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { agentTurn, AgentTransportFailure } from './workload';
import { EGO_SKILL, resolveEgo } from './ego-tools';
import type { Run } from './runtime';
import type { BrowserRequest, BrowserResponse } from './browser-channel';
import { UI_ACTION_GUIDANCE, UI_BUDGETS, validateUiActions } from './ui-contract';
import { AcceptanceProtocolError, startScenario, type ScenarioReceipt } from './acceptance-scenario';
import { runAcceptanceProtocol } from './acceptance-protocol';
import { AGENT, writeJson } from './runtime';
import { readUiProposal, uiProposalSchema } from './ui-proposal';

export const ACCEPTANCE_TIMEOUT_MS = UI_BUDGETS.review;
export class AcceptanceInfrastructureError extends Error {
  constructor(message: string) { super(message); this.name = 'AcceptanceInfrastructureError'; }
}
export interface UiAcceptanceContext {
  run: Run; caseId: string; attempt: number; origin: string; leaseId: string;
  sourceFingerprint: string; dataDirectory: string; session: string;
  scenario?: ScenarioReceipt;
}
export interface BrowserTraceEvent { tool: 'ego-browser'; command: string; exitCode: number | null; output: string; native?: {space:number;request:BrowserRequest;response:BrowserResponse} }
export interface AcceptanceResult { proposal: unknown; trace: BrowserTraceEvent[]; scenario?: ScenarioReceipt }
export function proposalPath(run: Run, attempt: number): string { return path.join(run.home, 'tmp', `ui-acceptance-${attempt}.json`); }

/** Decode a single literal argv. No evaluation, substitutions, or compound scripts. */
function literalArgv(command: string): string[] | null {
  const args: string[] = []; let word = ''; let quote = ''; let active = false;
  for (let i = 0; i < command.length; i++) {
    const c = command[i]!;
    if (quote === "'") { if (c === "'") quote = ''; else word += c; continue; }
    if (c === '\\') {
      const next = command[++i]; if (next === undefined) return null;
      if (quote === '"' && !['$', '`', '"', '\\', '\n'].includes(next)) word += '\\';
      word += next; active = true; continue;
    }
    if (c === '$' || c === '`') return null;
    if (quote) { if (c === quote) quote = ''; else word += c; continue; }
    if (c === "'" || c === '"') { quote = c; active = true; continue; }
    if (';|&<>\n'.includes(c)) return null;
    if (/\s/.test(c)) { if (active) { args.push(word); word = ''; active = false; } }
    else { word += c; active = true; }
  }
  if (quote) return null;
  if (active) args.push(word);
  return args;
}
export function browserArgv(command: string): string[] | null {
  let args = literalArgv(command);
  for (let depth = 0; args && depth < 3; depth++) {
    if (!['sh', 'bash', 'zsh'].includes(path.basename(args[0] ?? ''))) return args;
    if (args.length !== 3 || !/^-[lc]*c[lc]*$/.test(args[1]!)) return null;
    args = literalArgv(args[2]!);
  }
  return null;
}
export function commandExecutable(command: string): string { return browserArgv(command)?.[0] ?? ''; }
export function classifyBrowserCommand(command: string): BrowserTraceEvent['tool'] | null {
  const args = browserArgv(command);
  return args && path.basename(args[0] ?? '') === 'ego-browser' && args[1] === 'nodejs' && args[2] === '-e' && args.length === 4 ? 'ego-browser' : null;
}
/** Inspect actual JS call syntax, never matching method names inside strings. */
export function egoCalls(command: string): { space?: number; urls: string[]; observation: boolean; interaction: boolean } {
  const result = { space: undefined as number | undefined, urls: [] as string[], observation: false, interaction: false };
  if (!classifyBrowserCommand(command)) return result;
  const source = ts.createSourceFile('browser.js', browserArgv(command)![3]!, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'taskSpace' && node.arguments[0] && ts.isNumericLiteral(node.arguments[0])) result.space = Number(node.arguments[0].text);
      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'goto' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) result.urls.push(node.arguments[0].text);
        if (method === 'snapshot' || method === 'screenshot') result.observation = true;
        if (['click', 'fill', 'selectOption', 'press', 'acceptDialog', 'dismissDialog', 'dblclick', 'paste', 'type'].includes(method)) result.interaction = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source); return result;
}
export function readBrowserTrace(evidenceFile: string): BrowserTraceEvent[] {
  if (!fs.existsSync(evidenceFile)) return [];
  const events: BrowserTraceEvent[] = []; const started = new Map<string, string>();
  const push = (command: string, exitCode: number | null, output: string) => { if (classifyBrowserCommand(command)) events.push({ tool: 'ego-browser', command, exitCode, output }); };
  for (const line of fs.readFileSync(evidenceFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let event: Record<string, any>; try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'item.completed' && event.item?.type === 'command_execution' && typeof event.item.command === 'string') {
      push(event.item.command, Number.isInteger(event.item.exit_code) ? event.item.exit_code : null, event.item.aggregated_output ?? event.item.output ?? event.item.stdout ?? event.item.stderr ?? '');
    }
    const summary = event.summary ?? {};
    if (event.type === 'history' && event.stream === 'tool_call_start' && typeof summary.toolCallId === 'string') {
      try { const parsed = JSON.parse(summary.argumentsText ?? '{}'); if (typeof parsed.command === 'string') started.set(summary.toolCallId, parsed.command); } catch { /* non-shell */ }
    }
    if (event.type === 'history' && event.stream === 'tool_call_result' && typeof summary.toolCallId === 'string') {
      const command = started.get(summary.toolCallId); started.delete(summary.toolCallId); if (!command) continue;
      const output = typeof summary.resultText === 'string' ? summary.resultText : '';
      const matched = /exit(?:\s+code)?\s*[:=]\s*(-?\d+)/i.exec(output);
      push(command, summary.isError === false ? 0 : matched ? Number(matched[1]) : null, output);
    }
  }
  return events;
}
export function readChannelTrace(file: string): BrowserTraceEvent[] {
  const events: BrowserTraceEvent[]=[]; const seen=new Set<string>();
  for(const line of fs.readFileSync(file,'utf8').split('\n')) {
    let record: any; try {record=JSON.parse(line);}catch{continue;}
    if(record.channel!=='browser-channel-v1' || !record.request || !record.response)continue;
    const {request,response}=record;
    if(response.status==='ok') {if(seen.has(request.id))continue;seen.add(request.id);}
    const result=response.result??{};
    events.push({tool:'ego-browser',command:'',exitCode:response.status==='ok'?0:1,
      output:typeof result.snapshot==='string'?result.snapshot:result.url??'',native:{space:record.space,request,response}});
  }
  return events;
}
function eventCalls(event: BrowserTraceEvent) {
  if(!event.native)return egoCalls(event.command);
  const {space,request,response}=event.native;
  return {space,urls:request.op==='goto'?[String(request.args[0])]:[],observation:request.op==='snapshot' && typeof response.result?.snapshot==='string',interaction:['click','fill','selectOption','press','acceptDialog','dismissDialog'].includes(request.op)};
}
/** Quotes may themselves be copied from escaped JSON tool output. */
export function findingExcerpts(text: string): string[] {
  const excerpts:string[]=[];let quote='',start=0;
  for(let i=0;i<text.length;i++) {
    const c=text[i]!;
    if(!quote && (c==='"' || c==='“')) {quote=c==='“'?'”':'"';start=i+1;}
    else if(quote && c===quote && text[i-1]!=='\\') {excerpts.push(text.slice(start,i));quote='';}
  }
  return excerpts;
}
const decodedExcerpt=(text:string)=>text.replace(/\\+n/g,'\n').replace(/\\+r/g,'\r').replace(/\\+t/g,'\t').replace(/\\+"/g,'"');
export function acceptancePrompt(ctx: UiAcceptanceContext, destination: string, executable = resolveEgo().executable, channel?: {client:string;connection:string}, structuredOutput = false): string {
  if(channel) return [
    'You are a fresh independent functional UI reviewer, not the implementer. The delivered workspace and workflow are read-only. Read request.md and acceptance.md FULLY, derive your own test plan and requirements coverage, discover controls from live snapshots. Do not inspect implementation source or use its tests as business proof. The harness has NO predefined business test sequence, selectors or expectations.',
    `The application is running at ${ctx.origin}. The harness owns a persistent Ego Lite session in TaskSpace ${ctx.session}/p1 and serializes all operations. Use ONLY the browser command below; do not launch Ego directly, create/claim/finish another session, use curl/fetch/eval/CDP, or modify the application.`,
    `Browser command: ${JSON.stringify(process.execPath)} ${JSON.stringify(channel.client)} ${JSON.stringify(channel.connection)} '<JSON object with op, args, optional id>'. Supported ops: goto [url], snapshot [], info [], click [selector, optional options], fill [selector,text], selectOption [selector,valueOrLabel], press [selector,key], waitForSelector [selector,optional options], acceptDialog [text for prompt; empty args only for alert/confirm], dismissDialog [].`,
    'The optional options argument must be a JSON object, never a string containing JSON. Invalid request/argument errors are rejected before browser execution: correct the input and use a new request ID. This does NOT permit replay after an uncertain timeout, lost control or a fenced session.',
    'Snapshots default to full_page so offscreen controls are discoverable. Do not infer a missing control from a viewport-only snapshot. A recoverable precondition-rejected response means native input was refused before dispatch (for example a disabled/covered target or absent single option): reobserve and decide whether the target/value was invalid, the page is not ready, or a required interaction is genuinely obstructed. Read actual option labels/values rather than guessing a sentinel value; empty strings are supported for fill and selection. Correct a refused argument with a new request ID; never force-click, remove overlays, inject state or blindly repeat. This does not permit replay of execution-uncertain errors. Browser action receipts do not prove asynchronous application work has settled; use requirement-derived waitForSelector conditions or bounded re-observation before judging the resulting state.',
    'Use refs such as @123 from the latest snapshot, CSS or locators. Browser commands return JSON with status, result and any real dialog. Errors are not business findings. Snapshot result.snapshot is native observed page content, not command input. Start with goto the exact application origin, then snapshot. Choose all concrete actions and expected outcomes yourself from the requirements and real UI.',
    'If result.dialog is non-null or status is dialog-open, read its actual type/message/defaultPrompt, decide an answer from your intended test, and send acceptDialog with explicit text (or dismissDialog). The next answer returns the NEXT real dialog if any. Repeat only while a real pending dialog is reported; never guess unseen messages. The persistent channel retains events across commands. Do not request DOM snapshots while a dialog is pending. Only JavaScript dialogs are handled; stop for user/browser permission or device prompts.',
    'Wait for each shell process/session to complete and read its output before choosing another action. Requests are serialized and IDs deduplicated; on uncertain native timeout, the channel fences mutations, never replays them. Do not work around lost control or a fenced session.',
    'Check all applicable UI requirements and relevant negative cases. Uncovered behavior must be stated, never fabricated as covered. A test input rejected because you sent an invalid value is NOT a product defect. A reproduced functional defect is failed; inability to complete valid interaction due to tools/control is infrastructure-failed.',
    structuredOutput
      ? 'Return the complete advisory JSON as your FINAL structured response, even on failure. The CLI writes that output for the harness; do not rely on a FileChange report or a separate proposal file. This is NOT the official receipt or proof: admission still requires protected native observations and scope coverage.'
      : `Write an advisory JSON proposal to ${destination} even on failure. This isolated HOME/tmp file is writable and is NOT the official receipt. Only harness-owned native channel logs can admit evidence; writing the proposal is explicitly authorized.`,
    `Proposal: browser "ego-browser", session "${ctx.session}", status passed|failed|infrastructure-failed, findings string[]. For infrastructure-failed include reason with actual diagnostic. For failed, each finding must contain a double-quoted verbatim snapshot excerpt plus your explanation.`,
    structuredOutput
      ? 'For failed, findingEvidence links each finding to its requirementId and successful native observationId. For passed, findings [], and actions cover ALL applicable UI requirements using {operation,coverage,requirementIds,url,target,expected,observationId}. The harness resolves observed text from that native snapshot; expected must occur in it. Missing evidence cannot be a PASS. Interpret functionality using original requirements. You decide the business verdict, not the transport.'
      : 'For failed, also provide findingEvidence [{finding: identical finding string, observed: verbatim native snapshot excerpt}] to separate explanation from facts. Copy decoded snapshot text, not JSON backslash escapes. For passed: findings [], actions covering ALL applicable requirements; each action {operation,coverage: your requirement reference,url,target,expected,observed}. observed must contain expected and be a verbatim substring of a successful native snapshot. Missing evidence cannot be a PASS. Interpret functionality using requirements, not arbitrary displayed text. You decide the business verdict, not the transport.',
    structuredOutput ? 'operation is the low-level kind click|fill|select|dialog|observe, not a business step name. Use coverage to explain the business claim. url,target,expected,coverage are non-empty strings.' : UI_ACTION_GUIDANCE,
    ...(ctx.scenario ? [scopeGuidance(ctx.scenario)] : []),
    'artifact requirements (test/build scripts, documentation, architecture/knowledge and workflow evidence) belong to separate delivery review, NOT browser assertions. cross-boundary means UI/API state consistency only. If the frozen plan misclassifies a non-UI requirement as UI/cross-boundary, report scope-unresolved infrastructure, never a product defect or fabricated coverage.',
    'An API route contract, including eventual/asynchronous API behavior, does NOT by itself require a UI button or display. A product delivered with both REST API and a UI need not expose every API feature in the UI unless the original documents explicitly require it. Review the scope reasons against the original sources before testing; reject unsupported scope rather than finding invented UI omissions.',
    'Successful snapshot responses have an observationId (the request ID). Link actions/findingEvidence to it. The harness resolves the reference against its protected native log, never against command arguments. For missing-control findings, require full_page observation and the relevant state; viewport absence is not proof. Keep failure explanation in findings and evidence in findingEvidence rather than reconstructing escaped quotes.',
    ...(structuredOutput ? ['Follow the output schema: use observationId instead of an observed field; the harness resolves the verbatim snapshot. Give reason as a string (empty when not needed), and empty arrays for unused actions/findingEvidence. findingEvidence.absence is true only for absence claims. The schema constrains representation, not your verdict or tested business expectations.'] : []),
  ].join('\n');
  return [
    'You are a fresh UI acceptance agent, not the implementer. The delivered workspace is read-only. Do not modify source, tests, requirements, or workflow state. Only the harness can write the official receipt.',
    `The application is running at ${ctx.origin}. Read request.md and acceptance.md fully. They define behavior, not selectors or layout.`,
    `Read ${EGO_SKILL}/SKILL.md completely and its documented references as needed. Use only Ego Lite through ${executable} nodejs -e '<JavaScript>'; one literal shell command per invocation, no heredoc/pipes/compound shell. Multiple browser actions in one JS round are allowed.`,
    `Resume ONLY taskSpace(${ctx.session}) and task.page("p1"). This owner-created TaskSpace is shared across serial phases; never create, claim, finish, or replace it. Start with page.goto(${JSON.stringify(ctx.origin)}), print await page.url() and await page.snapshot(). Stop on user control or inactive ownership; no workaround or Chrome fallback.`,
    'Serialize browser commands. If your shell tool returns a running process/session, wait for that exact command to complete and inspect its output before starting another browser command. A yielded shell call is not a completed action; overlapping commands can answer the wrong dialog or race navigation.',
    'Derive the complete test plan from request.md and acceptance.md and the actual live UI. Discover your own selectors and interactions. The harness does NOT specify business operations, API scripts or expected UI text. Assess all applicable requirements including negative cases; report uncovered requirements rather than inventing coverage.',
    'Use documented user interaction APIs, waits and snapshots. Do not use evaluate/fetch/CDP/source inspection as substitutes for user actions or inject expected application state. Take snapshots as needed to decide and verify; print resulting snapshots so observation evidence is retained.',
    'Capture and print high-level action receipts before requesting the next snapshot. Handle receipt.dialog with documented acceptDialog/dismissDialog according to its real message and the intended test. For a prompt, supply the intended text explicitly; acceptDialog() does not guarantee preservation of defaultPrompt. For chained dialogs, use documented page.events() in the SAME invocation to observe follow-on javascriptDialogOpening events and their messages before choosing each answer. Do not guess answers, blindly drain dialogs, or treat your invalid input as an application defect. A synchronous JavaScript dialog can block snapshot/info/Runtime.evaluate and look like a CDP timeout: do not repeatedly request snapshots or repeat the action. Try documented dialog handling in the SAME TaskSpace before declaring page control unavailable, then observe again. Permission/device prompts are user-owned and must not be dismissed or bypassed.',
    'Copy observed text verbatim from actual successful snapshot output; command arguments and action dispatch receipts are not proof of business outcomes.',
    `You MUST write your advisory proposal to ${destination}, an authorized writable file under isolated HOME/tmp, outside the read-only delivered workspace. This is NOT the official receipt or workflow evidence; the harness independently admits or rejects it and owns the official receipt. The read-only rule does not prohibit this proposal. Write it even for failed or infrastructure-failed outcomes; chat alone is not a proposal.`,
    `Proposal JSON: browser "ego-browser", session "${ctx.session}", status passed|failed|infrastructure-failed, findings [] (strings). infrastructure-failed additionally requires reason with the exact diagnostic.`,
    'passed requires findings [] and requirement-linked actions that demonstrate the full applicable acceptance. Choose expected and the business verdict by reasoning over the original requirements, not by copying arbitrary page text.',
    UI_ACTION_GUIDANCE,
    'failed means a usable browser reached the page but expected business behavior failed. Each finding must include a double-quoted verbatim excerpt from successful snapshot output; explanatory prose outside the quotes is your interpretation, not a page quote. infrastructure-failed means browser page control could not operate; reason records the actual error. If tool limitations prevent a valid interaction, report infrastructure-failed rather than assuming a product defect. Never invent a page or a PASS.',
  ].join('\n');
}
function admitLegacyAcceptance(proposal: unknown, ctx: UiAcceptanceContext, trace: readonly BrowserTraceEvent[]): unknown {
  const value = proposal && typeof proposal === 'object' ? proposal as Record<string, unknown> : null;
  if (!value) throw new AcceptanceInfrastructureError('Acceptance agent produced no proposal');
  if (value.status === 'infrastructure-failed') {
    const diagnostics = Array.isArray(value.findings) ? value.findings.map(f => typeof f === 'string' ? f : typeof f?.reason === 'string' ? f.reason : '').filter(Boolean).join('\n') : '';
    throw Object.assign(new AcceptanceInfrastructureError(typeof value.reason === 'string' && value.reason.trim() ? value.reason : diagnostics || 'Ego infrastructure failed'),
      {failureClass:['scope-unresolved','protocol-cost'].includes(String(value.failureClass)) ? value.failureClass : 'infrastructure'});
  }
  if (value.browser !== 'ego-browser' || value.session !== ctx.session) throw new AcceptanceInfrastructureError('Receipt must use the assigned Ego TaskSpace');
  const sessionTrace = trace.filter(event => event.exitCode === 0 && eventCalls(event).space === Number(ctx.session));
  const reached = sessionTrace.findIndex(event => eventCalls(event).urls.some(url=>url===ctx.origin || url.startsWith(ctx.origin+'/')) && event.output.includes(ctx.origin));
  if (reached < 0) throw new AcceptanceInfrastructureError('No successful Ego navigation to the leased origin');
  const subsequent = sessionTrace.slice(reached);
  if (subsequent.some(event => eventCalls(event).urls.some(url => url !== ctx.origin && !url.startsWith(ctx.origin + '/')))) throw new AcceptanceInfrastructureError('Ego left the leased origin');
  // Actual observation outputs only; command inputs cannot masquerade as observations.
  const snapshots = subsequent.filter(event => eventCalls(event).observation).map(event => event.output);
  const hasObservation = (s: string) => snapshots.some(snapshot => snapshot.includes(s));
  const corpus = snapshots.join('\n');
  if (!corpus.trim()) throw new AcceptanceInfrastructureError('Ego produced no page observation output');
  const receipt = { ...value, caseId: ctx.caseId, attempt: ctx.attempt, sourceFingerprint: ctx.sourceFingerprint, dataDirectory: ctx.dataDirectory, leaseId: ctx.leaseId };
  if (value.status === 'failed') {
    if (!Array.isArray(value.findings) || !value.findings.length || !value.findings.every(f => {
      if (typeof f !== 'string' || !f.trim()) return false;
      if (hasObservation(f)) return true;
      const evidence=Array.isArray(value.findingEvidence)?value.findingEvidence.filter(e=>e?.finding===f):[];
      if(evidence.length) return evidence.every(e=>typeof e.observed==='string' && e.observed.trim() && hasObservation(e.observed));
      const excerpts=findingExcerpts(f);
      return excerpts.length > 0 && excerpts.every(excerpt => excerpt.trim() && (hasObservation(excerpt) || hasObservation(decodedExcerpt(excerpt))));
    })) throw new AcceptanceInfrastructureError('Browser findings are not quoted from page observation output');
    return receipt;
  }
  if (value.status !== 'passed') throw new AcceptanceInfrastructureError('Unknown acceptance proposal status');
  const actions = Array.isArray(value.actions) ? value.actions as Record<string, unknown>[] : [];
  for (const action of actions) {
    if (typeof action.url !== 'string' || (action.url !== ctx.origin && !action.url.startsWith(ctx.origin + '/'))) throw new AcceptanceInfrastructureError('Acceptance action did not use the leased origin');
    if (typeof action.observed !== 'string' || !action.observed || (!hasObservation(action.observed) && !hasObservation(decodedExcerpt(action.observed)))) throw new AcceptanceInfrastructureError('Acceptance observation is not in page observation output');
  }
  if (!actions.length || actions.some(action => typeof action.coverage !== 'string' || !action.coverage.trim())) throw new AcceptanceInfrastructureError('Missing requirement-linked browser coverage');
  if (!subsequent.some(event => eventCalls(event).interaction)) throw new AcceptanceInfrastructureError('PASS requires actual Ego user interaction');
  if (!Array.isArray(value.findings) || value.findings.length) throw new AcceptanceInfrastructureError('PASS cannot retain unresolved findings');
  try { validateUiActions(actions); }
  catch (error) { throw new AcceptanceInfrastructureError(`Invalid browser action contract: ${String(error)}`); }
  return receipt;
}
export function nativeObservations(trace: readonly BrowserTraceEvent[], ctx: UiAcceptanceContext) {
  return trace.filter(e => e.exitCode === 0 && e.native?.space === Number(ctx.session) && e.native.request.op === 'snapshot' && e.native.response.result?.url && new URL(e.native.response.result.url).origin === ctx.origin)
    .map(e => ({observationId:e.native!.request.id,url:e.native!.response.result!.url,scope:(e.native!.request.args[0] as {scope?:string}|undefined)?.scope ?? 'only_within_viewport',snapshot:e.output}));
}
/** Canonical metadata projection; never rewrite the frozen tested coverage claim. */
function actionRequirementReferences(action: {requirementId?:unknown;requirementIds?:unknown;coverage?:unknown}, requirements: ScenarioReceipt['plan']['requirements']): unknown[] {
  const coverage=action.coverage;
  let coverageReferences: string[]=[];
  if (requirements.some(r => r.id === coverage)) coverageReferences=[coverage as string];
  else if (typeof coverage === 'string') {
    const prefix=coverage.split(/:\s+|\s+[—–-]\s+/,1)[0]!;
    const references=prefix.split(/[;,]/).map(id=>id.trim());
    if (references.length && references.every(id=>requirements.some(r=>r.id===id))) coverageReferences=references;
  }
  if (action.requirementIds !== undefined && (!Array.isArray(action.requirementIds) || !action.requirementIds.length)) throw new AcceptanceProtocolError('Canonical requirementIds must be a nonempty array');
  const explicit=action.requirementIds as unknown[]|undefined ?? (action.requirementId !== undefined ? [action.requirementId] : undefined);
  if (explicit && action.requirementId !== undefined && !explicit.includes(action.requirementId)) throw new AcceptanceProtocolError('Canonical requirement references conflict','scope-unresolved');
  if (explicit && coverageReferences.length && (explicit.length !== coverageReferences.length || coverageReferences.some(id=>!explicit.includes(id)))) {
    throw new AcceptanceProtocolError('Canonical requirement reference contradicts frozen coverage','scope-unresolved');
  }
  return explicit ?? coverageReferences;
}
export function admitAcceptance(proposal: unknown, ctx: UiAcceptanceContext, trace: readonly BrowserTraceEvent[]): unknown {
  try {
    const value = structuredClone(proposal) as any;
    const observations = nativeObservations(trace,ctx);
    for (const item of [...(value?.actions ?? []),...(value?.findingEvidence ?? [])]) {
      if (!item?.observationId) continue;
      const observation = observations.find(o => o.observationId === item.observationId);
      if (!observation) throw new AcceptanceProtocolError('Unknown, failed, foreign or non-browser observationId');
      if (item.observed !== undefined && (typeof item.observed !== 'string' || !item.observed.trim() || !observation.snapshot.includes(item.observed))) throw new AcceptanceProtocolError('Referenced excerpt is not in that native observation');
      item.observed ??= observation.snapshot;
      if (item.absence === true && observation.scope !== 'full_page') throw new AcceptanceProtocolError('Absence requires full_page evidence');
    }
    if (ctx.scenario && value?.status !== 'infrastructure-failed') {
      const requirements = ctx.scenario.plan.requirements;
      if (requirements.some(r => r.channel === 'unspecified')) throw new AcceptanceProtocolError('Requirement scope remains unspecified; not a business defect', 'scope-unresolved');
      const ui = requirements.filter(r => ['ui','cross-boundary'].includes(r.channel));
      if (value?.status === 'passed') {
        for (const action of value.actions ?? []) {
          const references=actionRequirementReferences(action,requirements);
          if (references.length && references.every(id=>ui.some(r => r.id === id))) { action.requirementIds ??= references; continue; }
          if (action.requirementId !== undefined || action.requirementIds !== undefined || references.length) throw new AcceptanceProtocolError('Browser action claims non-UI or undeclared requirement coverage','scope-unresolved');
          throw new AcceptanceProtocolError('Canonical action.requirementIds missing; preserve coverage prose and link it to the already-tested requirements');
        }
        if (ui.some(r => !value.actions?.some((a: any) => actionRequirementReferences(a,requirements).includes(r.id)))) throw new AcceptanceProtocolError('Missing UI requirement coverage from admitted scope plan; not repairable by receipt formatting','scope-unresolved');
      }
      if (value?.status === 'failed') for (const finding of value.findings ?? []) {
        const evidence = value.findingEvidence?.filter((e: any) => e.finding === finding);
        if (!evidence?.length) throw new AcceptanceProtocolError('Finding is missing its requirement-linked native evidence reference');
        if (evidence.some((e: any) => !ui.some(r => r.id === e.requirementId))) throw new AcceptanceProtocolError('Finding has no explicit UI/cross-boundary requirement; API-only scope cannot require a UI control','scope-unresolved');
      }
    }
    const receipt = admitLegacyAcceptance(value,ctx,trace) as object;
    return {...receipt,...(ctx.scenario ? {scopePlan:ctx.scenario.plan,preparation:{sourceDigests:ctx.scenario.sourceDigests,log:ctx.scenario.log}} : {})};
  } catch(error) {
    if (error instanceof AcceptanceProtocolError) throw error;
    if ((proposal as any)?.status === 'infrastructure-failed') throw error;
    if (error instanceof AcceptanceInfrastructureError && /timeout|control|navigation|leased origin|no page|no proposal|Ego infrastructure/i.test(error.message)) throw error;
    throw new AcceptanceProtocolError(String(error));
  }
}
function scopeGuidance(scenario: ScenarioReceipt): string {
  return `The harness admitted and sealed this AI-derived scope plan: ${JSON.stringify(scenario.plan)}. Preparation wrote only this lease's isolated runtime data; HTTP setup responses are NOT UI acceptance evidence. Each action MUST include requirementIds: [one or more exact UI/cross-boundary IDs from this plan]; coverage describes the unchanged tested business claim, not a list of canonical IDs. One real action may cover multiple source obligations; never duplicate business actions just to attach IDs. findingEvidence.requirementId uses an exact canonical ID. API-only requirements belong to independent API review, not invented UI controls; include them as non-UI scope, never claim UI coverage. Genuine ambiguity is scope-unresolved, not application failure. Do not reclassify scope to pass. Test asynchronous outcomes with bounded requirement-derived conditions, not fixed sleeps or dispatch receipts.`;
}
export function scenarioPrompt(ctx: UiAcceptanceContext, channel: {client:string;connection:string}): string {
  return [
    'This is test-protocol preparation, NOT Codument Track/Mission planning. Do not invoke depa-codument or discover/install Skills. artifact covers test/build scripts, documentation, architecture/knowledge and workflow evidence, checked separately, NOT in a browser. cross-boundary means UI/API state consistency ONLY. Split mixed source requirements into distinct scoped entries.',
    'An API route contract is api even when it promises eventual/asynchronous state changes; cross-boundary needs an explicit UI/API relationship in the original documents. General delivery of a UI and API does not require every API feature to have a UI control. Do not classify architecture, asynchronous transport or internal knowledge as UI/cross-boundary. Generic UI requirements may be ui without inventing a specific control.',
    'Do not mark a broad product summary unspecified merely because it does not allocate every feature to a surface. Cross-reference the explicit contracts in the other source document, then split/classify its relevant API, UI and artifact obligations with that explanation. unspecified means genuinely contradictory or untestable acceptance, not a missing per-feature UI mandate.',
    'Source quotes must be exact contiguous excerpts, preserving Markdown backticks, spacing and punctuation; put interpretation in reason. Prefer short sufficient excerpts. On a rejected plan, fix the named requirement/capability in the existing JSON file, using a new request ID. Do not reconstruct the entire plan or delete the scratch file; admission failure has not frozen the plan.',
    'Produce a compact scope map, not a rewritten specification or test script: group adjacent same-channel obligations into one source-quoted entry when appropriate (e.g. test/typecheck/build), avoiding duplicate entries for the same obligation in both documents. Full original documents remain the business authority. Keep necessary distinct UI expectations and negative cases testable; setup capabilities still need exact declared route/method quotes.',
    'For source quotes containing apostrophes, backticks or semicolons, write request JSON under isolated HOME/tmp using your file-edit tool, then pass @/absolute/path/to/request.json instead of inline JSON. Never interpolate source text into shell quotes.',
    'You are an independent scenario planner/arranger, NOT the implementer or UI grader. Read request.md and acceptance.md FULLY. Delivered source and workflow are OS-enforced read-only; do not inspect source/tests or change requirements. Derive a complete scope plan from these original documents, not the app implementation.',
    `Application lease origin: ${ctx.origin}. Only the following bounded preparation command is allowed: ${JSON.stringify(process.execPath)} ${JSON.stringify(channel.client)} ${JSON.stringify(channel.connection)} '<JSON object>'. Do not use browsers, curl, fetch, eval, arbitrary network calls or filesystem writes as setup. Do not invent business endpoints or requirements.`,
    'First op=plan, id=unique, plan={requirements:[{id,channel:api|ui|cross-boundary|artifact|unspecified,source:request.md|acceptance.md,quote:exact original excerpt,reason}],setup:[{id,requirementId,method:GET|POST|PUT|PATCH|DELETE,pathTemplate:original declared /route/:id,source,quote:exact original contract containing METHOD /route,reason}]}. Consider both source documents, include all applicable requirements and negative cases. Classify API-only guarantees as api; an unspecified individual UI button is NOT a new UI requirement. Use unspecified only for a genuine unresolved contract ambiguity. The plan becomes immutable upon admission.',
    'Prepare only necessary prerequisites (e.g. test accounts/admin fixtures) not supposed acceptance outcomes. If no API setup is declared or needed use setup:[]; browser-capable account/content creation can be done during UI review. No hardcoded harness business test exists; choose data and actions yourself from the original contract.',
    'Then op=prepare,id=unique,setupId=admitted capability,path=literal relative route replacing :id,body=JSON object,headers={authorization:test-user Bearer token} only if needed. Read each real HTTP response; non-2xx is NOT successful preparation and cannot prove a UI defect. No redirects, other origins, source writes, arbitrary headers or auto replay after uncertain effects. At most 30 actual preparation requests. Request IDs deduplicate exact repeats.',
    'When all declared capabilities have succeeded, send op=seal,id=unique. This closes preparation for this lease. With empty setup, still seal. Preparation journal is owner-written; never claim it as UI PASS or fabricate receipts. If valid setup cannot complete, state the precise setup/contract failure; do not patch the app or silently add demo data to its source.',
  ].join('\n');
}
export async function runUiAcceptance(ctx: UiAcceptanceContext): Promise<AcceptanceResult> {
  const destination = proposalPath(ctx.run, ctx.attempt); const name = `ui-acceptance-${ctx.attempt}`;
  const scenario = startScenario(ctx.run,ctx.origin,name);
  try {
    await agentTurn(ctx.run,scenarioPrompt(ctx,scenario),`ui-scenario-${ctx.attempt}`,UI_BUDGETS.scenario,[],'acceptance');
    ctx = {...ctx,scenario:scenario.receipt()};
    writeJson(path.join(ctx.run.root,`ui-scenario-${ctx.attempt}.json`),ctx.scenario);
  } catch(error) {
    if(error instanceof AgentTransportFailure) throw error;
    throw Object.assign(new AcceptanceInfrastructureError(`Scenario preparation failed before UI grading: ${String(error)}`),{failureClass:'setup-failed'});
  } finally {scenario.close();}
  const { startBrowserChannel }=await import('./browser-owner');
  const channel=await startBrowserChannel(ctx.run,ctx.origin,Number(ctx.session),name);
  const structuredOutput = AGENT.id === 'codex';
  const schemaFile = path.join(ctx.run.root, `logs/${name}-schema.json`);
  const schema = uiProposalSchema(ctx.session);
  writeJson(schemaFile, schema);
  const schemaArgs = structuredOutput ? AGENT.schemaArgs(schemaFile, JSON.stringify(schema)).args : [];
  let turnError: unknown;
  let outputFile: string | undefined;
  try { outputFile = (await agentTurn(ctx.run, acceptancePrompt(ctx, destination, undefined, channel, structuredOutput), name, ACCEPTANCE_TIMEOUT_MS, schemaArgs, 'acceptance')).outputFile; }
  catch (error) { turnError = error; }
  finally {await channel.close();}
  const trace = readChannelTrace(channel.log);
  // The suite owner finishes its shared TaskSpace once, not each fresh agent.
  if (turnError instanceof AgentTransportFailure) throw turnError;
  const proposalReader = { readText: (file: string) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined };
  let proposal: unknown;
  if (turnError) proposal = {status: 'infrastructure-failed', failureClass: 'protocol-cost', reason: String(turnError)};
  else {
    try {
      if (structuredOutput && !outputFile) throw new AcceptanceProtocolError('UI reviewer produced no structured output');
      proposal = readUiProposal(proposalReader, {advisoryFile: destination, structuredOutput: structuredOutput ? outputFile : undefined});
      if (structuredOutput) writeJson(destination, proposal); // Scratch projection for protocol repair, not official evidence.
    } catch (error) { proposal = {status: 'infrastructure-failed', failureClass: 'protocol-cost', reason: String(error)}; }
  }
  writeJson(path.join(ctx.run.root, `logs/${name}-proposal-transport.json`), {kind: structuredOutput ? 'structured-output' : 'advisory-file', source: structuredOutput ? outputFile ?? null : destination});
  const catalog = path.join(ctx.run.root,`logs/${name}-observations.json`);
  writeJson(catalog,nativeObservations(trace,ctx));
  // The browser is closed before protocol repair: no new business actions can occur.
  const result = await runAcceptanceProtocol({observe:() => trace,readProposal:() => proposal,admit:(p,t) => admitAcceptance(p,ctx,t),
    record:v => fs.appendFileSync(path.join(ctx.run.root,`logs/${name}-protocol.jsonl`),JSON.stringify(v)+'\n'),
    repair:async ({diagnostic}) => {
      const repaired = await agentTurn(ctx.run,[`Protocol-only correction (one round). Diagnostic: ${diagnostic}`,
        `Read the existing proposal ${destination}, frozen scope plan ${path.join(ctx.run.root,`ui-scenario-${ctx.attempt}.json`)} and protected native observation catalog ${catalog}.`,
        'Browser and preparation capabilities are closed. Do not execute browser/network commands, run tests, modify source, requirements or workflow. Repair ONLY representation: operation enum, observationId/excerpt, missing action.requirementIds, findingEvidence references. Preserve status, findings, action coverage/url/target/expected and existing requirementId/requirementIds exactly. Missing canonical IDs may only link already-tested, unchanged coverage to the frozen UI scope; do not claim an untested requirement. Never invent evidence or change business judgement to gain admission.',
        UI_ACTION_GUIDANCE, structuredOutput ? 'Return the corrected advisory JSON as your final structured response, using observationId instead of observed. Do not claim a new business verdict.' : `Write corrected proposal to ${destination}.`, 'If evidence cannot support the unchanged judgement, leave it rejected; do not fabricate a PASS.'].join('\n'),`ui-protocol-${ctx.attempt}`,UI_BUDGETS.protocol,schemaArgs,'acceptance');
      proposal = readUiProposal(proposalReader, {advisoryFile: destination, structuredOutput: structuredOutput ? repaired.outputFile : undefined});
      if (structuredOutput) writeJson(destination, proposal);
    }});
  return {...result,scenario:ctx.scenario};
}
