import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { verifyCliArchitecture } from '../../../../scripts/verification/architecture';
import { inspectDomainCapabilityCoverage, LEGACY_CODUMENT_LEAVES } from '../../../../scripts/verification/domain-capabilities';
import { measureContextEconomy, measureGlobalContextEconomy } from '../../../../scripts/verification/context-economy';
import { CODUMENT_WORKSPACE_ASSETS } from '../../../product-capsule/src/workspace-assets';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS } from '../../../product-capsule/src/global-guidance';

const repository = path.resolve(import.meta.dir, '../../../..');
describe('mission evidence gates', () => {
  test('current global measurement counts aggregate guidance and reports regressions without hiding them', () => {
    const result = measureGlobalContextEconomy();
    expect(result.scenarios).toHaveLength(6);
    expect(result.actualTokenOrCostSavings).toBe('NOT_MEASURED');
    for (const scenario of result.scenarios) {
      expect(scenario.after.some(read => read.path === 'SKILL.md')).toBe(true);
      expect(scenario.afterBytes).toBe(scenario.after.reduce((sum, read) => sum + read.bytes, 0));
    }
    expect(result.scenarios.find(row => row.id === 'migration')!.after.some(read => read.path === 'references/migration/decision-migration.md')).toBe(true);
    expect(() => measureGlobalContextEconomy(CODUMENT_GLOBAL_GUIDANCE_ASSETS.filter(asset => asset.path !== 'SKILL.md'))).toThrow('Missing installed global guidance');
    const inflated = measureGlobalContextEconomy(CODUMENT_GLOBAL_GUIDANCE_ASSETS.map(asset => asset.path === 'SKILL.md'
      ? { ...asset, source: asset.source + 'x'.repeat(100_000) } : asset));
    expect(inflated.medianReduction).toBeLessThan(0);
    expect(inflated.scenarios.every(row => row.reduction < 0)).toBe(true);
  });
  test('context measurement includes the whole declared input and rejects missing sources', () => {
    const result = measureContextEconomy();
    expect(result.scenarios).toHaveLength(6);
    expect(result.medianReduction).toBeGreaterThanOrEqual(0.25);
    expect(result.actualTokenOrCostSavings).toBe('NOT_MEASURED');
    expect(() => measureContextEconomy(CODUMENT_WORKSPACE_ASSETS.filter(asset => !asset.path.endsWith('/methods/tdd.md')))).toThrow('Missing context source');
    const inflated = measureContextEconomy(CODUMENT_WORKSPACE_ASSETS.map(asset => asset.path.endsWith('/operations/impl-track.md')
      ? { ...asset, source: asset.source + 'x'.repeat(50_000) } : asset));
    expect(inflated.medianReduction).toBeLessThan(0.25);
    const migration = result.scenarios.find(row => row.id === 'migration')!;
    expect(migration.after.some(read => read.path.endsWith('/references/decision-migration.md'))).toBe(true);
  });
  test('unfinished and unknown acceptance gates never return a successful exit', async () => {
    for (const suite of ['all', 'migration', 'capabilities', 'workspace-app', 'serve-placement', 'not-a-suite']) {
      const child = Bun.spawn([process.execPath, 'scripts/verify-mission.ts', suite], {
        cwd: repository, env: { ...process.env, CODUMENT_VERIFY_RELEASE_SET: undefined }, stdout: 'pipe', stderr: 'pipe',
      });
      const [code, stdout, stderr] = await Promise.all([
        child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
      ]);
      expect(code).not.toBe(0);
      expect(stdout).not.toContain('"status":"PASS"');
      expect(stderr).toMatch(/UNVERIFIED|Unknown suite/);
    }
  });
  test('domain coverage enumerates all old leaves and refuses missing, remote or silently merged commands', () => {
    const commands = LEGACY_CODUMENT_LEAVES.filter(name => !name.startsWith('migrate ') && !['upgrade-resource', 'upgrade-track'].includes(name)).map(name => ({name, run() {}, execution: {placement: 'local', runtimeProfile: name === 'init' ? 'basic' : 'domain'}}));
    const coverage = inspectDomainCapabilityCoverage(commands);
    expect(coverage).toHaveLength(41);
    expect(coverage.filter(row => row.state === 'COVERED')).toHaveLength(35);
    expect(coverage.filter(row => row.state === 'DEFERRED')).toHaveLength(6);
    expect(() => inspectDomainCapabilityCoverage(commands.filter(item => item.name !== 'archive'))).toThrow('Missing');
    expect(() => inspectDomainCapabilityCoverage([...commands, commands[0]])).toThrow('Duplicate');
    expect(() => inspectDomainCapabilityCoverage(commands.map(item => item.name === 'archive' ? {...item, execution: {placement: 'required', runtimeProfile: 'domain'}} : item))).toThrow('local owner');
    expect(() => inspectDomainCapabilityCoverage(commands.map(item => item.name === 'init' ? {...item, execution: {placement: 'required', runtimeProfile: 'basic'}} : item))).toThrow('local owner');
  });
  test('package boundary verification rejects concrete IO in a logic package', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'architecture-negative-'));
    try {
      for (const role of ['contract', 'logic', 'support', 'capsule']) {
        const directory = path.join(root, 'packages', 'domain-' + role);
        await fs.mkdir(path.join(directory, 'src'), { recursive: true });
        await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({
          name: 'depa-codument-domain-' + role,
          exports: { '.': './src/index.ts' }, dependencies: {},
        }));
        await fs.writeFile(path.join(directory, 'src/index.ts'),
          role === 'logic' ? "import * as fs from 'node:fs';\nexport const value = fs.readFileSync('/source');\n" : 'export {};\n');
      }
      await expect(verifyCliArchitecture(root)).rejects.toThrow('concrete IO in logic');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
