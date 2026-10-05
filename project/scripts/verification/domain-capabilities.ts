import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type {CommandDefinition} from 'halfcode-lite-cli-contract';
import {COMMANDS} from '../../packages/cli/src/cli/command-registry';

/** Leaf inventory transcribed from the frozen 0.5.4 observation, excluding only
 * non-executable groups. Its original options/usage remain in the mission input.
 * baseline.json SHA256: cea86d404bc8049496d190f22e5ee875f0f3b613c98a1531c45b7ebbf728492d */
export const LEGACY_CODUMENT_LEAVES = [
  'init', 'upgrade-workspace', 'upgrade-resource', 'upgrade-track', 'list', 'show', 'validate', 'archive', 'status',
  'project bind', 'project bindings', 'project unbind', 'modeling lint', 'modeling validate', 'modeling scaffold',
  'engineering lint', 'engineering validate', 'engineering scaffold', 'decisions create', 'decisions validate', 'decisions frontier',
  'track create', 'track transition', 'track gap-round', 'track ready', 'track verify', 'track task transition', 'track task complete',
  'mission create', 'mission transition', 'mission gap-round', 'mission bind-track', 'mission archive', 'mission task transition',
  'artifact sync', 'std lint', 'behavior-patch create', 'migrate inspect', 'migrate plan', 'migrate apply', 'migrate verify',
] as const;
const migration = new Set(['upgrade-resource', 'upgrade-track', 'migrate inspect', 'migrate plan', 'migrate apply', 'migrate verify']);
const cases = [
  {commands: ['init', 'status', 'upgrade-workspace'], file: 'workspace-product-commands.test.ts'},
  {commands: ['track transition', 'track gap-round', 'track ready', 'track verify', 'track task transition', 'track task complete', 'mission transition', 'mission gap-round', 'mission bind-track', 'mission task transition', 'project bind', 'project bindings', 'project unbind', 'decisions create', 'decisions validate', 'decisions frontier'], file: 'domain-commands.test.ts'},
  {commands: ['track create', 'mission create', 'behavior-patch create'], file: 'domain-scaffold.test.ts'},
  {commands: ['list', 'show'], file: 'domain-query.test.ts'},
  {commands: ['validate'], file: 'domain-validate.test.ts'},
  {commands: ['std lint'], file: 'domain-std.test.ts'},
  {commands: ['modeling lint', 'modeling validate', 'modeling scaffold', 'engineering lint', 'engineering validate', 'engineering scaffold'], file: 'domain-knowledge.test.ts'},
  {commands: ['artifact sync'], file: 'domain-artifact.test.ts'},
  {commands: ['archive', 'mission archive'], file: 'domain-archive.test.ts'},
];
interface Surface {name: string; run?: unknown; children?: readonly Surface[]; execution?: {placement: string; runtimeProfile: string}}
export function inspectDomainCapabilityCoverage(commands: readonly Surface[]) {
  const leaves = new Map<string, Surface>();
  function visit(nodes: readonly Surface[], prefix: string[]) {
    for (const node of nodes) {
      const parts = [...prefix, node.name], name = parts.join(' ');
      if (node.run) {if (leaves.has(name)) throw new Error('Duplicate executable command: ' + name); leaves.set(name, node);}
      visit(node.children ?? [], parts);
    }
  }
  visit(commands, []);
  return LEGACY_CODUMENT_LEAVES.map(name => {
    const definition = leaves.get(name);
    if (migration.has(name)) return {command: name, state: 'DEFERRED' as const, reason: 'Historical migration successor node; not part of domain scope'};
    const tests = cases.filter(item => item.commands.includes(name));
    if (tests.length !== 1 || !definition?.run) throw new Error('Missing domain command or unique behavior proof: ' + name);
    const profiles = name === 'init' ? ['basic'] : ['domain', 'domain-registry'];
    if (definition.execution?.placement !== 'local' || !profiles.includes(definition.execution.runtimeProfile)) throw new Error('Domain command requires an explicit local owner: ' + name);
    return {command: name, state: 'COVERED' as const, test: 'packages/cli/test/cli/' + tests[0].file};
  });
}
export async function verifyDomainCapabilities(root: string): Promise<void> {
  const coverage = inspectDomainCapabilityCoverage(COMMANDS as readonly CommandDefinition[]);
  const tests = ['packages/domain-logic/test', 'packages/domain-support/test', 'packages/domain-capsule/test',
    ...new Set(coverage.flatMap(row => row.state === 'COVERED' ? [row.test!] : []))];
  for (const file of tests) await fs.stat(path.join(root, file));
  const child = Bun.spawn([process.execPath, 'test', ...tests], {cwd: root, stdout: 'inherit', stderr: 'inherit'});
  if (await child.exited !== 0) throw new Error('Domain capability behavior verification failed.');
  console.log(JSON.stringify({status: 'PASS', suite: 'capabilities', scope: 'domain', legacyLeaves: coverage.length,
    covered: coverage.filter(row => row.state === 'COVERED').length, coverage, workspaceApp: 'UNVERIFIED', historicalMigration: 'DEFERRED', fullMission: 'UNVERIFIED'}));
}
