import { expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

async function invoke(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, resolve(import.meta.dir, '../../src/cli/index.ts'), '-w', root, ...args], {stdout: 'pipe', stderr: 'pipe'});
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return {code, stdout, stderr};
}
test('five original migration leaves bootstrap old config locally, preserve raw JSON and exit 2 review', async () => {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'codument-migration-cli-')));
  const file = 'codument/config/attractor-profiles.xml';
  const source = '<AttractorProfiles><Profile name="depa" enabled="true"/></AttractorProfiles>';
  try {
    const guidance = await invoke(root, ['migrate', 'guide', '--json']);
    expect(guidance.code).toBe(0); expect(guidance.stderr).toBe('');
    expect(JSON.parse(guidance.stdout)).toMatchObject({topic: 'resource', source: expect.stringContaining('Observe → Reconcile → Act → Verify')});
    expect(await fs.readdir(root)).toEqual([]);
    const decision = await invoke(root, ['migrate', 'guide', 'decision']);
    expect(decision.code).toBe(0); expect(decision.stdout).toContain('options');
    expect((await invoke(root, ['migrate', 'guide', 'unknown'])).code).toBe(1);
    await fs.mkdir(join(root, 'codument/config'), {recursive: true});
    await fs.writeFile(join(root, file), source);
    const inspected = await invoke(root, ['migrate', 'inspect', file, '--json']);
    expect(inspected.code).toBe(0); expect(inspected.stderr).toBe('');
    expect(JSON.parse(inspected.stdout)).toMatchObject({path: join(root, file), format: 'xml', kinds: ['AttractorProfiles']});
    const planned = await invoke(root, ['migrate', 'plan', join(root, file), '--json']);
    expect(planned.code).toBe(0);
    expect(JSON.parse(planned.stdout)).toMatchObject({status: 'planned', targetKind: 'AttractorProfiles'});
    expect(JSON.parse(planned.stdout)).not.toHaveProperty('proposal');
    expect(await fs.readdir(root)).toEqual(['codument']);
    const before = await invoke(root, ['migrate', 'verify', file, '--json']);
    expect(before.code).toBe(1); expect(JSON.parse(before.stdout).valid).toBe(false);
    const applied = await invoke(root, ['migrate', 'apply', file, '--json']);
    expect(applied.code).toBe(0); expect(applied.stderr).toBe('');
    const result = JSON.parse(applied.stdout);
    expect(result.status).toBe('applied');
    expect(await fs.readFile(result.backupPath, 'utf8')).toBe(source);
    expect(result.targetPath).toBe(join(root, 'codument/config/attractor-profiles.xnl'));
    const verified = await invoke(root, ['migrate', 'verify', result.targetPath, '--json']);
    expect(verified.code).toBe(0); expect(JSON.parse(verified.stdout).valid).toBe(true);
    expect((await invoke(root, ['upgrade-resource', result.targetPath])).stdout).toContain('upgrade-resource: noop');
    await fs.writeFile(join(root, 'codument/decision.md'), '# unresolved human decision');
    const review = await invoke(root, ['upgrade-resource', 'codument/decision.md', '--json']);
    expect(review.code).toBe(2); expect(review.stderr).toBe('');
    expect(JSON.parse(review.stdout)).toMatchObject({status: 'review-required', detectedFormat: 'markdown'});
    for (const args of [['migrate', 'plan', '../outside.xnl'], ['migrate', 'apply', file, '--unknown'], ['upgrade-resource']]) expect((await invoke(root, args)).code).toBe(1);
    expect(await fs.stat(join(root, '.codument/serve')).catch(() => undefined)).toBeUndefined();
    expect(await fs.stat(join(root, 'codument/manifest.xnl')).catch(() => undefined)).toBeUndefined();
  } finally {await fs.rm(root, {recursive: true, force: true});}
}, 30_000);

test('upgrade-track resolves old active and bucketed archive inputs, preserving mode intent and exact backup for semantic review without Serve', async () => {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'codument-upgrade-track-cli-')));
  try {
    for (const [id, directory] of [
      ['old', 'codument/tracks/active/old'],
      ['archived', 'codument/tracks/archived/2025-01/2025-01-01-archived'],
    ]) {
      await fs.mkdir(join(root, directory), {recursive: true});
      const source = `<plan><metadata><execution_mode>wave</execution_mode></metadata><phases><phase id="P1"><task id="t"><description>Keep</description><dependencies>external-task</dependencies></task></phase></phases></plan>`;
      await fs.writeFile(join(root, directory, 'plan.xml'), source);
      const result = await invoke(root, ['upgrade-track', id, '--mode', 'sequential', '--backup-dir', '.tmp/upgrade-track', '--json']);
      expect(result.code).toBe(2); expect(result.stderr).toBe('');
      const receipt = JSON.parse(result.stdout);
      expect(receipt).toMatchObject({status: 'review-required', mode: 'sequential', path: join(root, directory, 'plan.xml')});
      expect(receipt.diagnostics.join('\n')).toContain('dependencies');
      expect(await fs.readFile(join(root, directory, 'plan.xml'), 'utf8')).toBe(source);
      expect(await fs.readFile(join(receipt.backupPath, directory.slice(9), 'plan.xml'), 'utf8')).toBe(source);
      expect(receipt.backupPath.startsWith(join(root, '.tmp/upgrade-track/'))).toBe(true);
    }
    for (const args of [
      ['old', '--mode', 'unknown'], ['old', '--no-backup'], ['old', '--backup-dir', 'codument/backups'],
      ['old', '--backup-dir', '../outside'], ['../escape'], ['missing'],
    ]) expect((await invoke(root, ['upgrade-track', ...args])).code).toBe(1);
    await fs.mkdir(join(root, 'codument/tracks/archived/2024-01-01-archived'), {recursive: true});
    await fs.writeFile(join(root, 'codument/tracks/archived/2024-01-01-archived/plan.xml'), '<plan/>');
    expect((await invoke(root, ['upgrade-track', 'archived'])).code).toBe(1);
    expect(await fs.stat(join(root, '.codument/serve')).catch(() => undefined)).toBeUndefined();
    expect(await fs.stat(join(root, 'codument/manifest.xnl')).catch(() => undefined)).toBeUndefined();
  } finally {await fs.rm(root, {recursive: true, force: true});}
}, 30_000);
