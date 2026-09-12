import { expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

test('MCP CLI remains alive after connect and releases its runtime on stdin EOF', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'notes-mcp-cli-'));
  const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../../src/cli/index.ts'), '--workspace-dir', root, 'mcp-app', 'serve'], {
    stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
  });
  const errorOutput = new Response(child.stderr).text();
  const reader = child.stdout.getReader();
  const deadline = setTimeout(() => child.kill('SIGKILL'), 4000);
  try {
    child.stdin.write(JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name:'notes-test',version:'1'}}}) + '\n');
    await child.stdin.flush();
    let output = '';
    while (!output.includes('\n')) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('MCP exited before initialize response: ' + await errorOutput);
      output += new TextDecoder().decode(chunk.value);
    }
    expect(JSON.parse(output.trim())).toMatchObject({id: 1, result: {serverInfo: {name:'depa-codument'}}});
    expect(child.exitCode).toBeNull();
    child.stdin.end();
    expect(await child.exited).toBe(0);
    expect(await errorOutput).toContain('MCP App server connected');
    expect(await fs.readdir(root)).toEqual([]);
  } finally {
    clearTimeout(deadline);
    reader.releaseLock();
    if (child.exitCode === null) { child.kill('SIGKILL'); await child.exited; }
    await fs.rm(root, {recursive: true, force: true});
  }
});
