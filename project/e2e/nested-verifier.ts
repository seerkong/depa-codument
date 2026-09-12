import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { execute, files, sandbox, type Run } from './runtime';
import { assertNestedSelection } from './resource-oracle';
import { applicationEnvironment } from './application-state';

export async function verifyNested(run: Run, attempt: number): Promise<string[]> {
  const repositories = ['main-repo','inventory-repo'].map(name => path.join(run.workspace, name));
  for (const [index, repo] of repositories.entries()) {
    const valid = await execute({ argv: sandbox(run,[run.bin, 'validate', 'all', '--strict']), cwd: repo, env: run.env, log: path.join(run.root, `logs/nested-${attempt}-${index}-strict.log`) });
    assert.equal(valid.code, 0, 'Cross-project resource validation failed');
    const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
    for (const script of ['test','typecheck','build']) {
      assert.ok(pkg.scripts?.[script]);
      const result = await execute({ argv: sandbox(run, [process.execPath, 'run', script]), cwd: repo, env: applicationEnvironment(run,`nested-${attempt}-${index}-${script}`), log: path.join(run.root, `logs/nested-${attempt}-${index}-${script}.log`) });
      assert.equal(result.code, 0, `Repository ${index} ${script} failed`);
    }
  }
  const main = repositories[0]!, inventory = repositories[1]!;
  const rootMissions = files(path.join(main, 'codument/missions')).filter(f => f.endsWith('/mission.xnl')).map(f => fs.readFileSync(f, 'utf8'));
  const childMissions = files(path.join(inventory, 'codument/missions')).filter(f => f.endsWith('/mission.xnl')).map(f => fs.readFileSync(f, 'utf8'));
  assertNestedSelection(rootMissions,childMissions);
  for (const text of [...rootMissions,...childMissions]) assert.ok(!text.includes(run.root), 'Absolute path leaked into Mission authority');
  const binding = 'codument/.local/workspace-bindings.xnl';
  assert.ok(fs.existsSync(path.join(main, binding)));
  assert.equal((await execute({ argv: ['git','check-ignore','-q',binding], cwd: main, env: run.env, log: path.join(run.root, `logs/nested-${attempt}-ignored.log`) })).code, 0);
  const processes: { pid?: number; fd: number }[] = [];
  const start = async (cwd: string, label: string, extraEnv: NodeJS.ProcessEnv = {}) => {
    const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('') });
    const port = probe.port!; probe.stop(true);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, 'e2e-server.json'), 'utf8'));
    assert.ok(Array.isArray(config.command) && config.command.every((s: unknown) => typeof s === 'string'));
    const fd = fs.openSync(path.join(run.root, `logs/nested-${attempt}-${label}-server.log`), 'wx', 0o600);
    const argv = sandbox(run, config.command);
    const proc = spawn(argv[0]!, argv.slice(1), { cwd, env: { ...applicationEnvironment(run,`nested-${attempt}-${label}`), ...extraEnv, PORT: String(port) }, detached: true, stdio: ['ignore',fd,fd] });
    processes.push({ pid: proc.pid, fd });
    let launchError: Error | undefined; proc.on('error', e => { launchError = e; });
    const request = async (method: string, url: string, body?: unknown) => {
      const response = await fetch(`http://127.0.0.1:${port}${url}`, { method, headers: { 'content-type':'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(3000) });
      const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
      return { status: response.status, data };
    };
    let ready = false;
    for (let i=0; i<100; i++) {
      if (launchError) throw launchError;
      if (proc.exitCode !== null) throw new Error('Server exited before ready');
      try { ready = (await request('GET','/health')).status === 200; } catch { /* startup */ }
      if (ready) break; await Bun.sleep(100);
    }
    assert.ok(ready, `${label} server unavailable`);
    return { request, url: `http://127.0.0.1:${port}` };
  };
  try {
    const stock = await start(inventory,'inventory');
    const orders = await start(main,'main',{ INVENTORY_URL: stock.url });
    const sku = randomUUID(), id = randomUUID(), price = 100 + Math.floor(Math.random()*9999);
    assert.equal((await stock.request('POST','/stock',{sku,quantity:5})).status,201);
    const created = await orders.request('POST','/orders',{id,items:[{sku,quantity:2,priceCents:price}]});
    assert.equal(created.status,201); assert.equal(created.data.totalCents,price*2);
    assert.equal((await stock.request('GET',`/stock/${sku}`)).data.reserved,2);
    assert.equal((await orders.request('POST','/orders',{id:randomUUID(),items:[{sku,quantity:4,priceCents:price}]})).status,409);
    for(let i=0;i<2;i++) assert.equal((await orders.request('POST',`/orders/${id}/pay`,{})).status,200);
    const paid=(await stock.request('GET',`/stock/${sku}`)).data;
    assert.equal(paid.quantity,3); assert.equal(paid.reserved,0);
    assert.equal((await orders.request('POST',`/orders/${id}/cancel`,{})).status,409);
    const cancelId=randomUUID();
    assert.equal((await orders.request('POST','/orders',{id:cancelId,items:[{sku,quantity:1,priceCents:price}]})).status,201);
    assert.equal((await orders.request('POST',`/orders/${cancelId}/cancel`,{})).status,200);
    const final=(await stock.request('GET',`/stock/${sku}`)).data;
    assert.equal(final.quantity,3); assert.equal(final.reserved,0);
    return ['both repository test/typecheck/build and strict validation','reciprocal mission links and ignored local binding','cross-repository live reservation/payment/cancellation','insufficient stock and duplicate payment'];
  } finally {
    for(const proc of processes){ if(proc.pid) try { process.kill(-proc.pid,'SIGKILL'); } catch { /* exited */ } fs.closeSync(proc.fd); }
  }
}
