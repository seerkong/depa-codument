import { test, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { assertTemporary, readEvents, execute, MODEL } from './runtime';

test('unsafe or unowned root is rejected without mutation', () => {
  expect(() => assertTemporary('/tmp')).toThrow();
  expect(() => assertTemporary(process.cwd())).toThrow();
});
test('event failures are not hidden by a successful process or final text; missing usage is unknown', () => {
  const dir = fs.mkdtempSync('/tmp/depa-codument-e2e-unit-');
  const log = path.join(dir, 'events.jsonl');
  fs.writeFileSync(log, JSON.stringify({ type: 'turn.failed' }) + '\n');
  expect(readEvents(log).failed).toBe(true);
  expect(readEvents(log).usage).toBeNull();
  fs.writeFileSync(log, [
    { type: 'thread.started', thread_id: 'test' },
    { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 3 } },
    { type: 'turn.completed', usage: { input_tokens: 20, cached_input_tokens: 5, output_tokens: 6 } },
  ].map(e => JSON.stringify(e)).join('\n'));
  expect(readEvents(log).usage).toEqual({ input: 30, cached: 9, output: 9 });
  expect(MODEL).toBe('gpt-5.6-terra');
});
test('exit codes and timeout survive logging', async () => {
  const dir = fs.mkdtempSync('/tmp/depa-codument-e2e-unit-');
  const fail = await execute({ argv: [process.execPath, '-e', 'console.log("evidence"); process.exit(7)'], cwd: dir, env: process.env, log: path.join(dir, 'failure.log') });
  expect(fail.code).toBe(7);
  expect(fs.readFileSync(path.join(dir, 'failure.log'), 'utf8')).toContain('evidence');
  const timed = await execute({ argv: [process.execPath, '-e', 'setInterval(()=>{},1000)'], cwd: dir, env: process.env, log: path.join(dir, 'timeout.log'), timeoutMs: 100 });
  expect(timed.code).toBe(124);
  expect(timed.timedOut).toBe(true);
});

test('reconnect diagnostics require a real completion and cannot mask terminal or unknown failures', () => {
  const dir = fs.mkdtempSync('/tmp/depa-codument-e2e-unit-');
  const log = path.join(dir, 'reconnects.jsonl');
  const reconnect = { type: 'error', message: 'Reconnecting... 2/5 (request timed out)' };
  const completed = { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 3 } };
  const read = (events: unknown[]) => {
    fs.writeFileSync(log, events.map(e => JSON.stringify(e)).join('\n'));
    return readEvents(log);
  };
  const recovered = read([reconnect, completed]);
  expect(recovered.failed).toBe(false);
  expect(recovered.completed).toBe(true);
  expect(recovered.reconnects).toEqual([reconnect.message]);
  expect(recovered.usage).toEqual({ input: 10, cached: 4, output: 3 });
  expect(read([reconnect]).failed).toBe(true);
  expect(read([completed, { type: 'turn.started' }, reconnect]).failed).toBe(true);
  expect(read([{ type: 'item.completed', item: { type: 'agent_message', text: 'Done' } }]).failed).toBe(true);
  expect(read([reconnect, { type: 'turn.failed' }, completed]).failed).toBe(true);
  expect(read([{ type: 'error', message: 'Authentication failed' }, completed]).failed).toBe(true);
  expect(read([{ type: 'error' }, completed]).failed).toBe(true);
});
