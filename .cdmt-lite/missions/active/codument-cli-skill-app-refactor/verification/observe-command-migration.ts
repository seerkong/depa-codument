import assert from 'node:assert/strict';
import { COMMANDS as upstream } from '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/packages/cli/src/cli/command-registry';
import { COMMANDS as frozen } from '/Users/kongweixian/infra-dev/depa-codument/project/packages/cli/src/cli/command-registry';

interface Node { name: string; run?: unknown; children?: readonly Node[]; execution?: { placement: string; runtimeProfile: string }; }
function leaves(nodes: readonly Node[], prefix: string[] = []): { path: string; policy?: Node['execution'] }[] {
  return nodes.flatMap(node => {
    const path = [...prefix, node.name];
    return [...(node.run ? [{ path: path.join(' '), policy: node.execution }] : []), ...leaves(node.children ?? [], path)];
  });
}
const H = leaves(upstream), C = leaves(frozen);
assert.equal(new Set(H.map(node => node.path)).size, H.length);
assert.equal(new Set(C.map(node => node.path)).size, C.length);
assert.deepEqual(H.map(node => node.path).sort(), C.map(node => node.path).sort());
assert.ok(C.every(node => node.policy));
console.log(JSON.stringify({
  scope: 'observed product command inventory, not handler migration acceptance',
  executableCount: H.length,
  source: 'H current product registry; C frozen CLI-first policy input',
  paths: H.map(node => ({ path: node.path, upstreamPolicy: node.policy ?? null, approvedPolicy: C.find(candidate => candidate.path === node.path)!.policy })),
  frozenCodumentMerge: ['init', 'status', 'upgrade-workspace'],
}, null, 2));
