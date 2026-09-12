import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execute, sandbox, type Run } from './runtime';

function streamPython(run: Run): string { return path.join(run.home,'tmp','stream-venv/bin/python'); }

export async function prepareStreamDependencies(run: Run, attempt: number): Promise<void> {
  const uv = Bun.which('uv', { PATH: run.env.PATH });
  assert.ok(uv && run.env.UV_PYTHON,'Pinned Python preflight required');
  const python = streamPython(run);
  for (const [name,argv] of [
    ['venv',[uv,'venv','--python',run.env.UV_PYTHON,path.dirname(path.dirname(python))]],
    ['install',[uv,'pip','install','--python',python,'-e','.','pytest']],
  ] as const) {
    const result = await execute({argv:sandbox(run,[...argv]),cwd:run.workspace,env:run.env,log:path.join(run.root,`logs/stream-${attempt}-${name}.log`),timeoutMs:180_000});
    assert.equal(result.code,0,`Stream ${name} failed`);
  }
}

export async function verifyStream(run: Run, attempt: number): Promise<string[]> {
  const python = streamPython(run);
  const check = async (name: string, argv: string[], input?: unknown) => {
    const log = path.join(run.root, `logs/stream-${attempt}-${name}.log`);
    const result = await execute({ argv: sandbox(run, argv), cwd: run.workspace, env: run.env, log, timeoutMs: 180_000, ...(input === undefined ? {} : { input: JSON.stringify(input) }) });
    assert.equal(result.code, 0, `${name} failed: ${log}`);
    return fs.readFileSync(log, 'utf8');
  };
  await check('pytest', [python, '-m', 'pytest', '-q']);
  const collected = await check('collection',[python,'-m','pytest','--collect-only','-q']);
  for (const name of ['test_thinking_stream_keeps_start_delta_end','test_toolcall_delta_transcript_pipeline','test_default_mixed_pipeline','test_toolcall_stream_tolerates_missing_id','test_toolcall_stream_tolerates_missing_name','test_toolcall_stream_tolerates_missing_arguments','test_toolcall_stream_preserves_delta_order']) assert.ok(collected.includes(name),`Required original test missing: ${name}`);
  await check('compile', [python, '-m', 'compileall', '-q', 'src']);
  let sequence = 0;
  const bridge = async (data: unknown) => JSON.parse(await check(`bridge-${sequence++}`, [python, 'e2e_bridge.py'], data));
  const chunk = (delta: unknown, finish_reason: string | null = null) => ({ choices: [{ index: 0, delta, finish_reason }] });
  const fragment = randomUUID();
  const text = await bridge({ mode: 'pipeline', chunks: [chunk({ content: 'Hello ' }), chunk({ content: fragment }), chunk({ content: '!' }), chunk({}, 'stop')] });
  const semantic = text.events.filter((e: any) => e.layer === 'semantic');
  assert.equal(semantic.filter((e: any) => e.type === 'semantic_assistant_message_started').length, 1);
  assert.equal(semantic.filter((e: any) => e.type === 'semantic_assistant_message_completed').length, 1);
  assert.equal(semantic.filter((e: any) => e.type === 'semantic_assistant_message_delta').map((e: any) => e.text).join(''), 'Hello ' + fragment + '!');
  for (const [type,count] of [['lexical_content_start',1],['lexical_content_delta',3],['lexical_content_end',1]] as const) assert.equal(text.events.filter((e:any)=>e.type===type).length,count);
  const thinking = await bridge({mode:'lexical',fragments:[{type:'lexical_reasoning_start'},{type:'lexical_reasoning_delta',text:fragment},{type:'lexical_reasoning_end'},{type:'lexical_content_start'},{type:'lexical_content_delta',text:'answer'},{type:'lexical_content_end'}]});
  for (const layer of ['syntactic','semantic']) {
    const events = thinking.events.filter((e:any)=>e.layer===layer && /reasoning|thinking/.test(e.type));
    assert.equal(events.length,3);
    assert.match(events[0].type,/start/); assert.match(events[1].type,/delta/); assert.match(events[2].type,/end|complet/);
    assert.equal(events[1].text,fragment);
  }
  for (const missing of ['none','id','name','arguments']) {
    const id = 'call-' + randomUUID();
    const name = 'get_current_time';
    const args = JSON.stringify({ marker: randomUUID() });
    const delta = (part: string, first: boolean) => ({ tool_calls: [{ index: 0, ...(missing === 'id' || !first ? {} : { id }), function: { ...(missing === 'name' || !first ? {} : { name }), ...(missing === 'arguments' ? {} : { arguments: part }) } }] });
    const result = await bridge({ mode: 'pipeline', chunks: [chunk(delta(args.slice(0, 9), true)), chunk(delta(args.slice(9), false)), chunk({}, 'tool_calls')] });
    for (const type of ['syntactic_tool_call', 'semantic_tool_call_requested']) {
      const events = result.events.filter((e: any) => e.type === type);
      assert.equal(events.length, 1);
      assert.equal(events[0].tool_call_id, missing === 'id' ? '' : id);
      assert.equal(events[0].tool_name, missing === 'name' ? '' : name);
      assert.equal(events[0].arguments_text, missing === 'arguments' ? '' : args);
    }
  }
  const split = await bridge({mode:'pipeline',chunks:[chunk({tool_calls:[{index:0,id:'split',function:{name:'get_',arguments:'{'}}]}),chunk({tool_calls:[{index:0,function:{name:'current_time',arguments:'}'}}]}),chunk({},'tool_calls')]});
  const assembled = split.events.filter((e:any)=>e.type==='syntactic_tool_call');
  assert.equal(assembled.length,1); assert.equal(assembled[0].tool_name,'get_current_time'); assert.equal(assembled[0].arguments_text,'{}');
  const loop = await bridge({ mode: 'loop', userText: fragment });
  assert.equal(loop.modelCalls, 2); assert.equal(loop.toolExecutions, 1);
  let previous = -1;
  for (const type of ['semantic_user_message_received', 'semantic_turn_started', 'semantic_tool_call_requested', 'semantic_tool_call_started', 'semantic_tool_result_received', 'semantic_turn_completed']) {
    const index = loop.events.findIndex((e: any) => e.type === type);
    assert.ok(index > previous, `Order violation: ${type}`); previous = index;
  }
  assert.ok(loop.projection.includes(fragment)); assert.ok(loop.projection.includes('[TOOL RESULT]'));
  return ['isolated Python installation and mandatory named pytest cases', 'randomized adapter-to-pipeline text', 'real RxPY reasoning start/delta/end', 'fragmented names/arguments and missing id/name/arguments', 'real loop two provider calls and one tool execution', 'user/tool-result semantic ordering and projection'];
}
