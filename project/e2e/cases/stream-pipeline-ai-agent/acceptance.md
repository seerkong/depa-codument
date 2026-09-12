# Independent stream acceptance boundary

Implement every requirement in request.md. Use real OpenAI SDK types/adapter and RxPY pipeline; application integration tests may use scripted model chunks (no live provider/API key is required for business tests).

Provide `e2e_bridge.py` as a thin adapter importing your real modules. It reads one JSON value from stdin, exercises the real runtime, and prints one JSON result. It must not implement a second pipeline, hardcode fixtures or compute expected events on the side.

Input `{mode:"pipeline", chunks:[...]}`: chunks use SDK-like Chat Completions shape: `{choices:[{index:0,delta:{content?:string,tool_calls?:[{index:0,id?:string,function:{name?:string,arguments?:string}}]},finish_reason:null|"stop"|"tool_calls"}]}`. Convert to SDK chunk types and pass through the actual OpenAI adapter and RxPY chain. Preserve missing field behavior from request.md.

Output `{events:[{layer:"lexical"|"syntactic"|"semantic",type:string,text?:string,tool_call_id?:string,tool_name?:string,arguments_text?:string}],projection:string}`. Types follow original lexical_/syntactic_/semantic_ names; `syntactic_tool_call` and `semantic_tool_call_requested` expose the three tool fields. Pure text produces content start/deltas/end and assistant started/deltas/completed.

Input `{mode:"lexical",fragments:[{type:"lexical_reasoning_start"},{type:"lexical_reasoning_delta",text:"..."},{type:"lexical_reasoning_end"},...]}` injects the declared provider-neutral lexical dataclasses into the same real RxPY pipeline. Support reasoning and content start/delta/end, returning the same layered events. This makes optional provider reasoning independently testable without pretending an SDK has a reasoning field it does not support. Keep start/delta/end through syntactic and semantic layers (the original thinking/reasoning equivalent names are accepted).

Input `{mode:"loop",userText:string}` uses a scripted provider: first turn requests `get_current_time`, second returns `Done`. Run the real agent loop and real tool executor; output the same events and projection. Preserve user→turn→tool requested→tool started→tool result→turn completed sequence. `modelCalls` must be 2 and `toolExecutions` 1, measured by observing the actual injected provider/tool calls.

Provide `requirements-dev.txt` with reproducible installable dependencies including pytest, plus pyproject.toml packaging. A fresh venv can install `pip install -e . pytest` and execute pytest and the bridge. Do not require external service credentials. The bridge is solely an observability seam; complete README, readline UI, error cases and original tests remain mandatory and independently reviewed.
