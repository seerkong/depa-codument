import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { sandbox, type Run } from './runtime';
import { verifyBlog, verifyEcommerce } from './extended-http';
import { applicationEnvironment } from './application-state';

/** Test authority stays outside the agent-writable repository. */
export async function verifyHttp(run: Run, caseId: string, attempt: number): Promise<string[]> {
  const config = JSON.parse(fs.readFileSync(path.join(run.workspace, 'e2e-server.json'), 'utf8'));
  assert.ok(Array.isArray(config.command) && config.command.length && config.command.every((s: unknown) => typeof s === 'string'), 'e2e-server.json command must be argv');
  const listener = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('port allocation') });
  const port = listener.port!; listener.stop(true);
  const fd = fs.openSync(path.join(run.root, `logs/server-${attempt}.log`), 'wx', 0o600);
  const argv = sandbox(run, config.command);
  const proc = spawn(argv[0]!, argv.slice(1), { cwd: run.workspace, env: { ...applicationEnvironment(run,`http-${attempt}`), PORT: String(port), NODE_ENV: 'test' }, detached: true, stdio: ['ignore', fd, fd] });
  let launchError: Error | undefined;
  proc.on('error', e => { launchError = e; });
  const origin = `http://127.0.0.1:${port}`;
  const evidence: string[] = [];
  const request = async (method: string, url: string, body?: unknown, token?: string) => {
    const response = await fetch(origin + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { data = raw; }
    return { status: response.status, data };
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (launchError) throw launchError;
      if (proc.exitCode !== null) throw new Error(`Application exited early: ${proc.exitCode}`);
      try { ready = (await request('GET', '/health')).status === 200; } catch { /* starting */ }
      if (ready) break;
      await Bun.sleep(200);
    }
    assert.ok(ready, 'application health did not become ready');
    const ui = await request('GET', '/');
    assert.equal(ui.status, 200); assert.match(String(ui.data), /<html|<!doctype/i);
    evidence.push('real server health and HTML');
    if (caseId === 'blog') return [...evidence, ...await verifyBlog(request)];
    if (caseId === 'ecommerce') return [...evidence, ...await verifyEcommerce(request)];
    if (caseId !== 'todo') throw new Error(`Independent HTTP oracle not implemented: ${caseId}`);
    const email = `e2e-${randomUUID()}@example.test`, password = 'Valid-E2e-Pass-482!';
    const alice = await request('POST', '/api/register', { email, password });
    assert.equal(alice.status, 201); assert.ok(alice.data.token); assert.ok(alice.data.id);
    assert.ok(!JSON.stringify(alice.data).includes(password));
    assert.equal((await request('POST', '/api/register', { email, password })).status, 409);
    assert.equal((await request('POST', '/api/login', { email, password: 'wrong' })).status, 401);
    const login = await request('POST', '/api/login', { email, password });
    assert.equal(login.status, 200); assert.ok(login.data.token);
    const token = login.data.token;
    const bob = await request('POST', '/api/register', { email: `e2e-${randomUUID()}@example.test`, password });
    assert.equal(bob.status, 201);
    assert.equal((await request('GET', '/api/tasks')).status, 401);
    const title = `task-${randomUUID()}`;
    const created = await request('POST', '/api/tasks', { title, dueDate: '2030-01-15', tags: ['work','urgent'] }, token);
    assert.equal(created.status, 201); assert.equal(created.data.title, title); assert.equal(created.data.status, 'todo');
    assert.equal(created.data.dueDate, '2030-01-15'); assert.deepEqual(created.data.tags, ['work','urgent']);
    const id = encodeURIComponent(created.data.id);
    assert.equal((await request('GET', `/api/tasks/${id}`, undefined, token)).data.title, title);
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const foreign = await request(method, `/api/tasks/${id}`, method === 'PATCH' ? { title: 'stolen' } : undefined, bob.data.token);
      assert.ok([403,404].includes(foreign.status), `${method} must reject foreign user`);
    }
    assert.deepEqual((await request('GET', '/api/tasks', undefined, bob.data.token)).data, []);
    for (const status of ['doing', 'done']) {
      const changed = await request('PATCH', `/api/tasks/${id}`, { status }, token);
      assert.equal(changed.status, 200); assert.equal(changed.data.status, status);
    }
    assert.equal((await request('PATCH', `/api/tasks/${id}`, { status: 'invalid' }, token)).status, 400);
    const second = await request('POST', '/api/tasks', { title: 'future', dueDate: '2031-01-01', tags: ['personal'] }, token);
    assert.equal(second.status, 201);
    for (const filter of ['status=done', 'tag=urgent', 'dueBefore=2030-01-15', 'status=done&tag=work&dueBefore=2030-12-31']) {
      const items = await request('GET', '/api/tasks?' + filter, undefined, token);
      assert.equal(items.status, 200); assert.equal(items.data.length, 1); assert.equal(items.data[0].id, created.data.id);
    }
    assert.ok([200,204].includes((await request('DELETE', `/api/tasks/${id}`, undefined, token)).status));
    assert.equal((await request('GET', `/api/tasks/${id}`, undefined, token)).status, 404);
    evidence.push('registration/login/errors', 'task CRUD/status/due date/tags/combined filters', 'cross-user read/write/delete isolation', 'randomized IDs and titles');
    return evidence;
  } finally {
    try { process.kill(-proc.pid!, 'SIGKILL'); } catch { /* already exited */ }
    fs.closeSync(fd);
  }
}
