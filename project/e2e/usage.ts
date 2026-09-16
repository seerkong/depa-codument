import * as fs from 'node:fs';
import * as path from 'node:path';
import { files, type Usage } from './runtime';

/** Sum per-response deltas, never cumulative turn/thread counters or duplicate stdout. */
export function sessionUsage(root: string) {
  const responses = new Map<string,Usage>();
  const sessions = files(path.join(root,'home/.codex/sessions')).filter(f => f.endsWith('.jsonl'));
  let sessionsWithUsage = 0;
  for (const file of sessions) {
    let observed = false;
    for (const line of fs.readFileSync(file,'utf8').split('\n')) {
      let event; try { event = JSON.parse(line); } catch { continue; }
      const p = event.payload;
      if (event.type !== 'token_usage_record' || !p?.response_id || !p.usage) continue;
      const u = p.usage;
      if (![u.input_tokens,u.cached_input_tokens,u.output_tokens].every(n => Number.isFinite(n) && n >= 0)) continue;
      // Estimated provider counters are not measured usage and are never
      // aggregated into the shared usage projection.
      if (u.is_estimated === true) continue;
      responses.set(p.response_id,{input:u.input_tokens,cached:u.cached_input_tokens,output:u.output_tokens});
      observed = true;
    }
    if (observed) sessionsWithUsage++;
  }
  const usage = responses.size ? [...responses.values()].reduce((a,b) => ({input:a.input+b.input,cached:a.cached+b.cached,output:a.output+b.output}),{input:0,cached:0,output:0}) : null;
  return {usage,responseCount:responses.size,sessionCount:sessions.length,sessionsWithUsage,scope:'observed per-response deltas across parent and child session logs, including interrupted turns; estimated provider counters excluded; not an account bill'};
}
