/** A single owner for an acceptance Page. No application-specific test logic. */
export interface Dialog { type: string; message: string; defaultPrompt?: string; url?: string }
export interface BrowserRequest { id: string; op: string; args: unknown[] }
export interface BrowserResponse {
  id: string; sequence: number; status: 'ok' | 'dialog-open' | 'error';
  result?: { value?: unknown; snapshot?: string; observationId?: string; url?: string; dialog?: Dialog | null };
  error?: string;
  failure?: {kind: 'invalid-request' | 'precondition-rejected' | 'predicate-unmet' | 'execution-uncertain' | 'control-lost' | 'provider-error'; recoverable: boolean; mayHaveLateEffects: boolean};
}
export interface BrowserPort {
  invoke(method: string, args: unknown[]): Promise<unknown>;
  events(): Promise<unknown[]>;
  control(): Promise<boolean>;
  url(): Promise<string>;
}
export interface ChannelRuntime {
  page: BrowserPort; origin: string; timeoutMs: number;
  pause(ms: number): Promise<void>;
  armDeadline(ms: number, callback: () => void): () => void;
}
export interface ChannelState {
  sequence: number; dialog: Dialog | null; stopped: string | null;
  queue: Promise<void>; requests: Map<string, { digest: string; response: Promise<BrowserResponse> }>;
}
export const channelState = (): ChannelState => ({ sequence: 0, dialog: null, stopped: null, queue: Promise.resolve(), requests: new Map() });
const arities: Record<string, [number, number]> = {
  goto: [1,1], snapshot: [0,1], click: [1,2], fill: [2,2], selectOption: [2,2], press: [2,2],
  acceptDialog: [0,1], dismissDialog: [0,0], info: [0,0], waitForSelector: [1,2],
};
function validSelection(value: unknown): boolean {
  if (typeof value === 'string') return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const option = value as Record<string, unknown>;
  const keys = Object.keys(option);
  return keys.length > 0 && keys.every(key =>
    key === 'index' ? Number.isSafeInteger(option[key]) && Number(option[key]) >= 0
      : ['value', 'label'].includes(key) && typeof option[key] === 'string');
}
const quotedOption = String.raw`"(?:\\.|[^"\\\n])*"`;
const availableOption = String.raw`\d+: value=${quotedOption}, label=${quotedOption}`;
const missingSingleOption = new RegExp(String.raw`^ElementResolutionError: page\.selectOption timed out after \d+ms: page\.selectOption failed: option ${quotedOption} was not found; available options: ${availableOption}(?:; ${availableOption})*$`);
export function validateRequest(value: unknown, origin: string): BrowserRequest {
  const v = value as BrowserRequest;
  if (!v || typeof v.id !== 'string' || !/^[\w-]{1,100}$/.test(v.id) || !Object.hasOwn(arities,v.op) || !Array.isArray(v.args)) throw Error('Invalid browser command');
  const [min,max] = arities[v.op]!;
  if(v.args.length < min || v.args.length > max) throw Error('Invalid browser arguments');
  if (['goto','click','fill','selectOption','press','waitForSelector'].includes(v.op) && typeof v.args[0] !== 'string') throw Error('Selector/URL must be a string');
  if (['fill','press'].includes(v.op) && typeof v.args[1] !== 'string') throw Error('Text must be a string');
  if (v.op === 'selectOption') {
    const selection = v.args[1];
    if (selection !== null && !(Array.isArray(selection) ? selection.every(validSelection) : validSelection(selection))) throw new TypeError('Selection must be a value/label string, option descriptor, array or null');
  }
  if(v.op === 'acceptDialog' && v.args.length && typeof v.args[0] !== 'string') throw Error('Prompt text must be a string');
  let optionsIndex: number | null = null;
  if (v.op === 'snapshot') optionsIndex = 0;
  if (v.op === 'click' || v.op === 'waitForSelector') optionsIndex = 1;
  if (optionsIndex !== null && v.args.length > optionsIndex) {
    const options = v.args[optionsIndex];
    if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError(`${v.op} options must be an object`);
  }
  if(v.op === 'goto' && new URL(v.args[0] as string).origin !== origin) throw Error('Navigation outside leased origin');
  if(v.op === 'snapshot') v.args = [{ scope: 'full_page', ...(v.args[0] as object ?? {}) }];
  if(v.op === 'waitForSelector') {
    const options = {...(v.args[1] as {timeout?:number} ?? {})};
    if(options.timeout !== undefined && (!Number.isFinite(options.timeout) || options.timeout < 50 || options.timeout > 8000)) throw new TypeError('waitForSelector timeout must be 50..8000ms');
    v.args[1] = {...options,timeout:options.timeout ?? 8000};
  }
  return v;
}
function applyEvents(state: ChannelState, events: unknown[]) {
  for(const e of events as {method?:string;params?:Dialog}[]) {
    if(e.method === 'Page.javascriptDialogClosed') state.dialog = null;
    if(e.method === 'Page.javascriptDialogOpening' && e.params) state.dialog = e.params;
  }
}
export function classifyBrowserFailure(error: unknown, op: string, stage = 'invoke', args?: readonly unknown[]): NonNullable<BrowserResponse['failure']> {
  const failure = error as {name?: string; timedOut?: boolean; mayHaveLateEffects?: boolean; dispatchPhase?: string; kind?: string} | null;
  const result = (kind: NonNullable<BrowserResponse['failure']>['kind'], recoverable: boolean, mayHaveLateEffects = false) => ({kind,recoverable,mayHaveLateEffects});
  if (stage === 'control') return result('control-lost',false);
  if (failure?.mayHaveLateEffects === true) return result('execution-uncertain',false,true);
  if (stage === 'validation') return result('invalid-request',true);
  if (stage === 'after-dispatch') return result('execution-uncertain',false,true);
  if (failure?.dispatchPhase === 'pre-dispatch') return result('precondition-rejected',true);
  if (op === 'waitForSelector' && failure?.kind === 'predicate-unmet') return result('predicate-unmet',true);
  const diagnostic = String(error);
  // Only the provider's exact read-only predicate diagnostic is recoverable.
  if (op === 'waitForSelector' && /^Error: page\.waitForSelector timed out after \d+ms(?:$|:)/.test(diagnostic)) return result('predicate-unmet',true);
  if (failure?.timedOut === true || /timeout/i.test(failure?.name ?? '')) return result('execution-uncertain',false,true);
  // Exception class alone is not a dispatch fact. Only the known, complete SDK
  // options rejection is safe; its usage word `timeout?` is not a deadline.
  if (op === 'click' && diagnostic === 'TypeError: page.click options must be an object. Expected: await page.click(selector, { timeout?, label? })') return result('invalid-request',true);
  // Ego's click timeout also bounds waiting for an element to become usable.
  // This exact disabled-element rejection precedes native input dispatch.
  if (/^ElementResolutionError: page\.click timed out after \d+ms: (?:page\.click failed:|Selector .+ matched \d+ elements, but none can receive input;) element is disabled$/.test(diagnostic)) return result('precondition-rejected',true);
  // An exact native hit-test refusal precedes input dispatch. Do not generalize
  // this to provider deadlines, appended diagnostics or late-effect reports.
  const intercepted = /^ElementResolutionError: page\.(click|fill) timed out after \d+ms: (?:page\.\1 failed:|Selector [^\n]+ matched \d+ elements, but none can receive input;) <[^>\n]+> intercepts pointer events$/.exec(diagnostic);
  if (intercepted?.[1] === op) return result('precondition-rejected',true);
  // Calibrated only for one string selection. Array/descriptor failures may
  // involve partial effects and are not generalized from this native refusal.
  if (op === 'selectOption' && typeof args?.[1] === 'string' && missingSingleOption.test(diagnostic)) return result('precondition-rejected',true);
  if (/^ElementResolutionError: Stale ref: @\d+; take a new snapshot$/.test(diagnostic)) return result('precondition-rejected',true);
  // Confirmed by live calibration: a non-editable target is rejected before
  // input dispatch. Keep this diagnostic exact; unrelated fill failures fence.
  if (op === 'fill' && /^Error: page\.fill failed: element is not an input, textarea, or contenteditable element$/.test(diagnostic)) return result('precondition-rejected',true);
  if (/\btimeout\b|\btimed out\b/i.test(diagnostic)) return result('execution-uncertain',false,true);
  // Unknown mutation errors cannot establish that input was never dispatched.
  if (['click','fill','selectOption','press','acceptDialog','dismissDialog','goto'].includes(op)) return result('execution-uncertain',false,true);
  return result('provider-error',true);
}
async function perform(runtime: ChannelRuntime, state: ChannelState, request: BrowserRequest): Promise<BrowserResponse> {
  const response: BrowserResponse = { id: request.id, sequence: ++state.sequence, status: 'ok' };
  if(state.stopped) return {...response,status:'error',error:state.stopped,failure:{kind:'execution-uncertain',recoverable:false,mayHaveLateEffects:true}};
  let stage = 'invoke';
  try {
    if(!await runtime.page.control()) { stage='control';state.stopped='User or inactive browser control'; throw Error(state.stopped); }
    applyEvents(state,await runtime.page.events());
    const dialogAction = ['acceptDialog','dismissDialog'].includes(request.op);
    if(state.dialog && !dialogAction) return {...response,status:'dialog-open',result:{dialog:state.dialog}};
    stage = 'validation';
    if(dialogAction && state.dialog?.type === 'prompt' && request.op === 'acceptDialog' && request.args.length === 0) throw Error('Prompt requires explicit text; default is not automatically preserved');
    if(dialogAction && !state.dialog) throw Error('No observed dialog to answer');
    stage = 'invoke';
    const value = await runtime.page.invoke(request.op, request.args);
    stage = 'after-dispatch';
    if(dialogAction) state.dialog=null;
    const receipt = value as {dialog?:Dialog} | null;
    if(receipt?.dialog) state.dialog=receipt.dialog;
    applyEvents(state,await runtime.page.events());
    // The same live SDK listener captures follow-on prompt events before replying.
    // No default answers or generated-application operations are supplied here.
    if(dialogAction) {
      for(let i=0;i<4 && !state.dialog;i++) { await runtime.pause(50); applyEvents(state,await runtime.page.events()); }
    }
    response.result = request.op === 'snapshot' ? {snapshot:String(value),observationId:request.id,dialog:state.dialog} : {value,dialog:state.dialog};
    if(!state.dialog) {
      response.result.url=await runtime.page.url();
      if(new URL(response.result.url).origin !== runtime.origin) {state.stopped='Page left leased origin';throw Error(state.stopped);}
    }
    if(state.dialog?.url && new URL(state.dialog.url).origin !== runtime.origin) { state.stopped='Dialog outside leased origin'; throw Error(state.stopped); }
    return response;
  } catch(error) {
    const diagnostic=String(error);
    const failure = classifyBrowserFailure(error,request.op,stage,request.args);
    if(!failure.recoverable) state.stopped ??= `Native browser timeout; outcome uncertain, session fenced: ${diagnostic}`;
    return {...response,status:'error',error:state.stopped??diagnostic,failure};
  }
}
/** Requests serialize even when agents yield shell commands and call concurrently. */
export function dispatchBrowser(runtime: ChannelRuntime, state: ChannelState, raw: unknown): Promise<BrowserResponse> {
  let request: BrowserRequest;
  try { request=validateRequest(raw,runtime.origin); } catch(error) { return Promise.resolve({id:'invalid',sequence:state.sequence,status:'error',error:String(error),failure:classifyBrowserFailure(error,'unknown','validation')}); }
  const digest=JSON.stringify(request); const previous=state.requests.get(request.id);
  if(previous) return previous.digest===digest ? previous.response : Promise.resolve({id:request.id,sequence:state.sequence,status:'error',error:'Request ID reused with different command'});
  const response=state.queue.then(async()=> {
    let cancelDeadline:()=>void;
    const timeout=new Promise<BrowserResponse>(resolve=> {cancelDeadline=runtime.armDeadline(runtime.timeoutMs,()=> {
      state.stopped='Native browser timeout; outcome uncertain, session fenced, no action replay';
      resolve({id:request.id,sequence:state.sequence,status:'error',error:state.stopped,failure:{kind:'execution-uncertain',recoverable:false,mayHaveLateEffects:true}});
    });});
    const result=await Promise.race([perform(runtime,state,request),timeout]); cancelDeadline!(); return result;
  });
  state.requests.set(request.id,{digest,response}); state.queue=response.then(()=>{}); return response;
}
