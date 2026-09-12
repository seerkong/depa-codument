import { createHash } from 'node:crypto';
import { CODUMENT_WORKSPACE_ASSETS } from '../../packages/product-capsule/src/workspace-assets';
import baseline from './fixtures/context-baseline.json';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS } from '../../packages/product-capsule/src/global-guidance';

const PREFIX = 'src/templates/';
const context = 'codument/std/protocols/context-loading.md';
export const CONTEXT_TEST_PATHS = [
  'packages/domain-logic/test/verification.test.ts', 'packages/domain-support/test/verification.test.ts',
  'packages/domain-logic/test/lifecycle-validation.test.ts', 'packages/domain-logic/test/migration.test.ts',
  'packages/domain-logic/test/migration-xml.test.ts', 'packages/product-capsule/test/migration-semantic.test.ts',
  'packages/product-capsule/test/workspace-assets.test.ts', 'packages/cli/test/cli/domain-commands.test.ts',
] as const;

/** Frozen entry-reading proxy, not model token usage or a semantic reviewer.
 * Read occurrences are counted individually, never silently deduplicated. */
export function measureContextEconomy(assets = CODUMENT_WORKSPACE_ASSETS) {
  const sources = new Map<string, string>(assets.map(asset => [asset.path, asset.source]));
  const load = (path: string) => {
    const source = sources.get(path);
    if (source === undefined) throw new Error('Missing context source: ' + path);
    return { path, bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex') };
  };
  const scenarios = baseline.scenarios.map(scenario => {
    const before = scenario.reads;
    const afterPaths = before.map(read => read.path.slice(PREFIX.length));
    afterPaths.push(context); // New required protocol counts even when reduction gets worse.
    if (scenario.id === 'migration') afterPaths.push(
      'skills/codument-migrate/references/bootstrap.md',
      'skills/codument-migrate/references/decision-migration.md', 'codument/std/spec/xnl-format.md',
    );
    const after = afterPaths.map(load);
    const beforeBytes = before.reduce((sum, read) => sum + read.bytes, 0);
    const afterBytes = after.reduce((sum, read) => sum + read.bytes, 0);
    return { id: scenario.id, before, after, beforeBytes, afterBytes, reduction: 1 - afterBytes / beforeBytes };
  });
  const medianReduction = scenarios.slice(0, 3).map(row => row.reduction).sort((a, b) => a - b)[1];
  return { metric: 'UTF-8 bytes proxy', method: baseline.method, actualTokenOrCostSavings: 'NOT_MEASURED',
    runtimeSelectedBusinessSources: 'excluded equally; must still be read', medianReduction, scenarios };
}

/** Measure the installed guidance projection, including the aggregate Skill
 * entry; retain the historical measurement separately, not as current savings. */
export function measureGlobalContextEconomy(assets = CODUMENT_GLOBAL_GUIDANCE_ASSETS) {
  const sources = new Map(assets.map(asset => [asset.path, asset.source]));
  const scenarios = baseline.scenarios.map(scenario => {
    const paths = scenario.reads.map(read => {
      const local = read.path.slice(PREFIX.length);
      if (local.startsWith('skills/')) return 'SKILL.md';
      const global = local.replace(/^codument\//, '');
      const operation = global.replace(/^std\/operations\//, 'operations/');
      return sources.has(operation) ? operation : 'references/' + global;
    });
    if (!paths.includes('SKILL.md')) paths.unshift('SKILL.md');
    paths.push('references/std/protocols/context-loading.md', 'references/std/compat/operation-alias.md');
    if (scenario.id === 'migration') paths.push('references/migration/bootstrap.md', 'references/migration/decision-migration.md', 'references/std/spec/xnl-format.md');
    const after = paths.map(path => {
      const source = sources.get(path);
      if (source === undefined) throw new Error('Missing installed global guidance: ' + path);
      return { path, bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex') };
    });
    const beforeBytes = scenario.reads.reduce((sum, read) => sum + read.bytes, 0);
    const afterBytes = after.reduce((sum, read) => sum + read.bytes, 0);
    return { id: scenario.id, before: scenario.reads, after, beforeBytes, afterBytes, reduction: 1 - afterBytes / beforeBytes };
  });
  return { metric: 'installed global guidance UTF-8 bytes proxy', actualTokenOrCostSavings: 'NOT_MEASURED',
    runtimeSelectedBusinessSources: 'excluded equally; still required', scenarios,
    medianReduction: scenarios.slice(0, 3).map(row => row.reduction).sort((a, b) => a - b)[1] };
}

export async function verifyContextEconomy(root: string): Promise<void> {
  const report = measureGlobalContextEconomy();
  const preservedProtocols = ['methods/tdd.md', 'methods/dag-execution.md', 'operations/gap-loop.md', 'protocols/attractor-check.md', 'protocols/cybernetic-loop.md'];
  for (const file of preservedProtocols) {
    const path = 'codument/std/' + file;
    const previous = baseline.scenarios.flatMap(scenario => scenario.reads).find(read => read.path === PREFIX + path)!;
    const current = CODUMENT_WORKSPACE_ASSETS.find(asset => asset.path === path);
    if (!current || createHash('sha256').update(current.source).digest('hex') !== previous.sha256) throw new Error('Preserved checking protocol changed; independent re-baseline required: ' + file);
  }
  if (report.medianReduction < 0.25) throw new Error('Context entry-reading median reduction is below 25%.');
  const tests = Bun.spawn([process.execPath, 'test', ...CONTEXT_TEST_PATHS], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
  if (await tests.exited) throw new Error('Context accuracy mechanism regression failed.');
  console.log(JSON.stringify({ status: 'PASS', suite: 'context-economy', scope: 'entry-proxy-and-deterministic-mechanisms', report, preservedProtocols,
    semanticProtocolReview: 'separate independent evidence required for this source snapshot',
    proofLimits: 'No automated claim of universal semantic completeness or live model cost; full task sources and configured fresh checks remain required.',
    fullMission: 'UNVERIFIED' }));
}
