import { parseArgs } from 'node:util';
import { smoke } from './smoke';
import { probe, runCase } from './workload';
import { defaultAuth } from './runtime';
import { summarize } from './report';
import { serveUi } from './ui-gate';
import { reviewProbe } from './review-probe';

const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: { bin: { type: 'string' }, codex: { type: 'string' }, auth: { type: 'string' }, resume: {type:'string'}, help: {type:'boolean',short:'h'} } });
if(values.help){ console.log('E2E: smoke | probe | review-probe | run <case> --bin=<candidate> [--codex=<path>] [--auth=<path>] [--resume=<run-root>]\nE2E: ui-server <run-root> --bin=<candidate>\nE2E: report <run-root> ...'); process.exit(0); }
if(positionals[0]==='report'){ console.log(JSON.stringify(summarize(positionals.slice(1)),null,2)); process.exit(0); }
if (!values.bin) throw new Error('--bin=<absolute candidate> is required; no legacy/global fallback');
if (positionals[0] === 'smoke') console.log(JSON.stringify(await smoke(values.bin), null, 2));
else if (positionals[0] === 'probe') console.log(await probe(values.bin, values.codex ?? 'codex', values.auth ?? defaultAuth()));
else if (positionals[0] === 'review-probe') console.log(await reviewProbe(values.bin, values.codex ?? 'codex', values.auth ?? defaultAuth()));
else if (positionals[0] === 'ui-server') { const result = await serveUi(positionals[1]!,values.bin); console.log(JSON.stringify(result)); process.exitCode=result.code; }
else if (positionals[0] === 'run') {
  const result = await runCase(values.bin, values.codex ?? 'codex', values.auth ?? defaultAuth(), positionals[1] ?? 'todo', values.resume);
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'passed' ? 0 : 1;
} else throw new Error('Supported commands: smoke | probe | review-probe | run <case> --bin=<candidate>');
