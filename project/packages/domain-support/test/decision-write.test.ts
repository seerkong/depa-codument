import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createFileDecisionWritePort } from '../src';

it('preserves UTF-8 BOM and CRLF bytes across a source observation and bounded insertion', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-source-bom-'));
  try {
    const source = '\uFEFF<decision #original>\r\n', file = path.join(root, 'source.xnl');
    await fs.writeFile(file, source);
    const port = createFileDecisionWritePort(root), observed = await port.read('source.xnl');
    expect(observed.source).toBe(source);
    await port.commit(observed, observed.source + '<decision #second>\r\n');
    expect(await fs.readFile(file, 'utf8')).toBe(source + '<decision #second>\r\n');
  } finally {await fs.rm(root, {recursive: true, force: true});}
});

it('rejects special filesystem sources before attempting a blocking read', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-source-special-'));
  try {
    const made = Bun.spawn(['mkfifo', path.join(root, 'pipe.xnl')], {stdout: 'pipe', stderr: 'pipe'});
    const [madeCode, madeError] = await Promise.all([made.exited, new Response(made.stderr).text()]);
    expect(madeError).toBe(''); expect(madeCode).toBe(0);
    const script = `const {createFileDecisionWritePort}=await import(${JSON.stringify(path.resolve(import.meta.dir, '../src/index.ts'))}); try {await createFileDecisionWritePort(${JSON.stringify(root)}).read('pipe.xnl'); process.exitCode=2;} catch(error) {console.log(String(error));}`;
    const child = Bun.spawn([process.execPath, '-e', script], {stdout: 'pipe', stderr: 'pipe'});
    const timer = setTimeout(() => child.kill('SIGKILL'), 1500);
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]).finally(() => clearTimeout(timer));
    expect(code).toBe(0); expect(stderr).toBe(''); expect(stdout).toContain('regular file');
    expect((await fs.lstat(path.join(root, 'pipe.xnl'))).isFIFO()).toBe(true);
    expect(await fs.readdir(root)).toEqual(['pipe.xnl']);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});

it('new source files respect the creating process umask while replacements retain their observed mode', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-source-umask-'));
  try {
    const script = `process.umask(0o077); const {createFileDecisionWritePort}=await import(${JSON.stringify(path.resolve(import.meta.dir, '../src/index.ts'))}); const port=createFileDecisionWritePort(${JSON.stringify(root)}); const source=await port.read('private.xnl'); await port.commit(source, '<decision #private>');`;
    const child = Bun.spawn([process.execPath, '-e', script], { stdout: 'pipe', stderr: 'pipe' });
    const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(stderr).toBe(''); expect(code).toBe(0);
    expect((await fs.stat(path.join(root, 'private.xnl'))).mode & 0o777).toBe(0o600);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('publishes one exact file, preserves mode and refuses stale/foreign handles without overwriting edits', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-decision-write-'));
  try {
    const port = createFileDecisionWritePort(root);
    const first = await port.read('decisions.xnl');
    expect(first.source).toBeUndefined();
    expect(await port.commit(first, '<decision #root>')).toEqual({ file: path.join(root, 'decisions.xnl') });
    await expect(port.commit(first, 'bad')).rejects.toThrow('Unknown');
    await fs.chmod(first.file, 0o600);
    const second = await port.read('decisions.xnl');
    await expect(port.commit({ ...second }, 'bad')).rejects.toThrow('Unknown');
    await expect(createFileDecisionWritePort(root).commit(second, 'bad')).rejects.toThrow('Unknown');
    await port.commit(second, '<decision #root>\n<decision #second>');
    expect((await fs.stat(first.file)).mode & 0o777).toBe(0o600);
    const stale = await port.read('decisions.xnl');
    await fs.writeFile(first.file, 'user edited bytes');
    await expect(port.commit(stale, 'bad')).rejects.toThrow('source changed');
    expect(await fs.readFile(first.file, 'utf8')).toBe('user edited bytes');
    expect(await fs.readdir(root)).toEqual(['decisions.xnl']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('competing writers cannot clobber a new file; unsafe paths and invalid UTF-8 fail closed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-decision-write-'));
  try {
    const one = createFileDecisionWritePort(root), two = createFileDecisionWritePort(root);
    const a = await one.read('decisions.xnl'), b = await two.read('decisions.xnl');
    const results = await Promise.allSettled([one.commit(a, 'one'), two.commit(b, 'two')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(['one', 'two']).toContain(await fs.readFile(a.file, 'utf8'));
    expect(await fs.readdir(root)).toEqual(['decisions.xnl']);
    await fs.symlink(a.file, path.join(root, 'link.xnl'));
    await expect(one.read('link.xnl')).rejects.toThrow('symlink');
    await fs.mkdir(path.join(root, 'real'));
    await fs.symlink(path.join(root, 'real'), path.join(root, 'alias'));
    await expect(one.read('alias/new.xnl')).rejects.toThrow('symlink');
    const invalid = new Uint8Array([0xff, 0xfe]);
    await fs.writeFile(path.join(root, 'invalid.xnl'), invalid);
    await expect(one.read('invalid.xnl')).rejects.toThrow();
    expect(new Uint8Array(await fs.readFile(path.join(root, 'invalid.xnl')))).toEqual(invalid);
    await expect(one.read('decisions.md')).rejects.toThrow('.xnl');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
