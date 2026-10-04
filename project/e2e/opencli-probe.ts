import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execute, sandbox, sha, writeJson, type Run } from './runtime';
import { openCliEnvironment, resolveOpenCli } from './opencli-tools';

/** Real browser operations inside the exact acceptance boundary, without a model. */
export async function probeOpenCli(run: Run): Promise<void> {
  const tool = resolveOpenCli();
  const probeId = randomUUID();
  const session = `e2e-probe-${path.basename(run.root)}-${probeId.slice(0, 8)}`;
  const marker = `probe-${path.basename(run.root)}`;
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: request => {
    const submitted = new URL(request.url).searchParams.get('value');
    const result = submitted === marker ? `Observed:${marker}` : '';
    return new Response(`<!doctype html><title>OpenCLI harness probe</title><form><label>Probe text<input id="input" name="value"></label><button type="submit">Show result</button></form><main id="result">${result}</main>`, { headers: { 'content-type': 'text/html' } });
  } });
  const origin = `http://127.0.0.1:${server.port}`;
  const results: unknown[] = [];
  const call = async (name: string, args: string[]) => {
    const log = path.join(run.root, `logs/opencli-probe-${probeId}-${name}.log`);
    const argv = [tool.executable, 'browser', session, ...args];
    const result = await execute({ argv: sandbox(run, argv, 'acceptance'), cwd: run.workspace, env: { ...run.env, ...openCliEnvironment(run.home) }, log, timeoutMs: 30_000 });
    const output = fs.readFileSync(log, 'utf8');
    results.push({ name, args, ...result, log });
    if (result.code !== 0) throw new Error(`OpenCLI browser preflight ${name} failed before model use: ${output.slice(-3000)}`);
    return output;
  };
  let failure: unknown;
  try {
    const opened = await call('open', ['open', origin]);
    if (!opened.includes(origin)) throw new Error('OpenCLI navigation did not identify the probe origin');
    await call('state', ['state']);
    await call('fill', ['fill', '#input', marker]);
    await call('click', ['click', 'button']);
    const extracted = await call('extract', ['extract', '--selector', '#result']);
    if (!extracted.includes(`Observed:${marker}`)) throw new Error('OpenCLI did not observe the actual probe click result');
  } catch (error) {
    failure = error;
  } finally {
    try { await call('close', ['close']); } catch (error) { failure ??= error; }
    server.stop(true);
  }
  const receipt = {
    status: failure ? 'infrastructure-failed' : 'passed', probeId,
    executable: tool.executable, installRoot: tool.installRoot,
    executableDigest: sha(fs.realpathSync(tool.executable)), session, origin, results,
    ...(failure ? { error: String(failure) } : {}),
  };
  writeJson(path.join(run.root, `opencli-preflight-${probeId}.json`), receipt);
  writeJson(path.join(run.root, 'opencli-preflight.json'), receipt);
  if (failure) throw failure;
}
