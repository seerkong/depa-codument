import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createGitKnowledgeBaselinePort } from '../src';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-git-baseline-'));
  const env = {...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid'};
  async function git(args: string[]) {
    const child = Bun.spawn(['git', ...args], {cwd: root, env, stdout: 'pipe', stderr: 'pipe'});
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    if (code) throw new Error(stderr); return stdout.trim();
  }
  const write = async (file: string, source: string | Uint8Array) => {await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true}); await fs.writeFile(path.join(root, file), source);};
  await git(['init', '-q']);
  return {root, env, git, write};
}
it('reads exact immutable blobs for a nested workspace without checkout, temporary materialization or dirty-source reads', async () => {
  const {root, env, git, write} = await fixture();
  const familyRoot = 'nested app/codument/modeling';
  try {
    const old = '\uFEFF<object #domain.orders.old {fact_grade="authoritative_fact" single_writer="store"}>\r\n';
    await write(`${familyRoot}/domain/orders/index.xnl`, old);
    await write('codument/modeling/outside.xnl', 'outside nested workspace');
    await write(`${familyRoot}/.history/ignored.xnl`, 'backup not authority');
    await write('nested app/codument/engineering/global/overview/project.xml', '<Legacy>preserve original</Legacy>');
    await git(['add', '.']); await git(['commit', '-qm', 'baseline']);
    const commit = await git(['rev-parse', 'HEAD']);
    await write(`${familyRoot}/domain/orders/index.xnl`, 'CURRENT DIRTY SOURCE');
    await write(`${familyRoot}/new.xnl`, 'UNTRACKED');
    const beforeStatus = await git(['status', '--porcelain']);
    const port = createGitKnowledgeBaselinePort({workspaceRoot: path.join(root, 'nested app'), env});
    const result = await port.read({family: 'modeling', commit});
    expect(result.commit).toBe(commit); expect(result.repositoryPath).toBe(`${familyRoot}`);
    expect([...result.sources]).toEqual([['domain/orders/index.xnl', old]]);
    expect(result.blobIds.get('domain/orders/index.xnl')).toBe(await git(['rev-parse', `${commit}:${familyRoot}/domain/orders/index.xnl`]));
    const engineering = await port.read({family: 'engineering', commit});
    expect(engineering.sources.get('global/overview/project.xml')).toBe('<Legacy>preserve original</Legacy>');
    // The raw historic bytes are retained, not silently converted by a reader.
    expect(await git(['status', '--porcelain'])).toBe(beforeStatus); expect(await git(['rev-parse', 'HEAD'])).toBe(commit);
    expect(await fs.readFile(path.join(root, familyRoot, 'domain/orders/index.xnl'), 'utf8')).toBe('CURRENT DIRTY SOURCE');
    const names = (await fs.readdir(path.join(root, 'nested app'), {recursive: true})).sort();
    expect(names.some(name => /baseline|staging|backup/.test(name))).toBe(false);
    await git(['add', '.']); await git(['commit', '-qm', 'later state']);
    expect((await port.read({family: 'modeling', commit})).sources.get('domain/orders/index.xnl')).toBe(old);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('fails closed for invalid references, symlink trees and undecodable blobs', async () => {
  const {root, env, git, write} = await fixture();
  const port = createGitKnowledgeBaselinePort({workspaceRoot: root, env});
  try {
    await write('codument/modeling/domain/invalid.xnl', new Uint8Array([255]));
    await git(['add', '.']); await git(['commit', '-qm', 'invalid UTF8']);
    const badBytes = await git(['rev-parse', 'HEAD']);
    await expect(port.read({family: 'modeling', commit: badBytes})).rejects.toThrow();
    await fs.unlink(path.join(root, 'codument/modeling/domain/invalid.xnl'));
    await fs.symlink('elsewhere', path.join(root, 'codument/modeling/domain/link.xnl'));
    await git(['add', '.']); await git(['commit', '-qm', 'symlink']);
    await expect(port.read({family: 'modeling', commit: 'HEAD'})).rejects.toThrow('link');
    for (const commit of ['--help', 'bad ref', '', 'missing-reference']) await expect(port.read({family: 'modeling', commit})).rejects.toThrow();
    await expect(port.read({family: 'unknown' as 'modeling', commit: 'HEAD'})).rejects.toThrow('Invalid');
    expect((await port.read({family: 'engineering', commit: 'HEAD'})).sources.size).toBe(0);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
it('binds Git discovery to the explicit workspace instead of inherited repository-routing environment', async () => {
  const first = await fixture(), second = await fixture();
  try {
    await first.write('codument/modeling/domain/own.xnl', 'FIRST REPOSITORY');
    await first.git(['add', '.']); await first.git(['commit', '-qm', 'first']);
    await second.write('codument/modeling/domain/foreign.xnl', 'SECOND REPOSITORY');
    await second.git(['add', '.']); await second.git(['commit', '-qm', 'second']);
    const port = createGitKnowledgeBaselinePort({workspaceRoot: first.root, env: {...first.env,
      GIT_DIR: path.join(second.root, '.git'), GIT_WORK_TREE: second.root, GIT_OBJECT_DIRECTORY: path.join(second.root, '.git/objects')}});
    const result = await port.read({family: 'modeling', commit: 'HEAD'});
    expect([...result.sources]).toEqual([['domain/own.xnl', 'FIRST REPOSITORY']]);
    expect(result.commit).toBe(await first.git(['rev-parse', 'HEAD']));
  } finally {await fs.rm(first.root, {recursive: true, force: true}); await fs.rm(second.root, {recursive: true, force: true});}
});
it('does not lazy-fetch absent promised blobs while observing a partial clone', async () => {
  const {root, env, git, write} = await fixture();
  try {
    await write('codument/modeling/domain/value.xnl', 'HISTORICAL BLOB');
    await git(['add', '.']); await git(['commit', '-qm', 'partial clone source']);
    await git(['config', 'uploadpack.allowFilter', 'true']);
    const blob = await git(['rev-parse', 'HEAD:codument/modeling/domain/value.xnl']);
    const clone = path.join(root, 'partial-clone');
    await git(['-c', 'protocol.file.allow=always', 'clone', '--filter=blob:none', '--no-checkout', pathToFileURL(root).href, clone]);
    async function existsWithoutFetching() {
      const child = Bun.spawn(['git', '--no-lazy-fetch', '-C', clone, 'cat-file', '-e', blob], {env, stdout: 'pipe', stderr: 'pipe'});
      const [code] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      return code === 0;
    }
    expect(await existsWithoutFetching()).toBe(false);
    await expect(createGitKnowledgeBaselinePort({workspaceRoot: clone, env}).read({family: 'modeling', commit: 'HEAD'})).rejects.toThrow();
    expect(await existsWithoutFetching()).toBe(false);
    expect(await fs.exists(path.join(clone, 'codument'))).toBe(false);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
