import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resourceIdentity } from './resource-oracle';
import type { ProductProfileId } from './product-profile';
import { files, sha } from './runtime';

export interface PlannedIdentity {
  repository: string;
  kind: 'track' | 'mission';
  id: string;
  stage: string;
  file: string;
  sourceSha256: string;
}

/** Parent observation, not a second lifecycle owner or a cached completion claim. */
export function observePlannedIdentities(workspace: string, repositories: readonly string[], product: ProductProfileId = 'current'): PlannedIdentity[] {
  const result: PlannedIdentity[] = [];
  const keys = new Set<string>();
  for (const repository of repositories) {
    const relative = path.relative(workspace, repository) || '.';
    assert.ok(relative === '.' || !relative.startsWith('..') && !path.isAbsolute(relative), 'Handoff repository escapes workspace');
    for (const kind of ['track', 'mission'] as const) {
      for (const stage of ['pending', 'active', 'archived']) {
        const root = path.join(repository, 'codument', kind + 's', stage);
        for (const file of files(root).filter(file => path.basename(file) === kind + '.xnl')) {
          const source = fs.readFileSync(file, 'utf8');
          const id = resourceIdentity(source, kind, product).id;
          const key = JSON.stringify([relative, kind, id]);
          assert.ok(!keys.has(key), `Ambiguous handoff authority: ${relative}/${kind}/${id}`);
          keys.add(key);
          result.push({ repository: relative, kind, id, stage, file: path.relative(workspace, file), sourceSha256: sha(file) });
        }
      }
    }
  }
  assert.ok(result.some(item => item.kind === 'track'), 'Planning handoff has no Track');
  return result.sort((a, b) => JSON.stringify([a.repository, a.kind, a.id]).localeCompare(JSON.stringify([b.repository, b.kind, b.id])));
}

/** Movement/status changes are legal; loss, replacement or an extra Track is not
 * silently accepted as continuation of this fixed fresh-case delivery plan. */
export function reconcilePlannedIdentities(planned: readonly PlannedIdentity[], current: readonly PlannedIdentity[]): void {
  const keys = (items: readonly PlannedIdentity[]) => items.map(item => JSON.stringify([item.repository, item.kind, item.id])).sort();
  assert.deepEqual(keys(current), keys(planned), 'Planning handoff identity drift: continue the approved resources; do not create replacements');
}

export function implementationHandoff(current: readonly PlannedIdentity[], command = 'depa-codument'): string {
  const context = command==='codument'
    ? 'For each Track read the exact recorded track.xnl and its referenced proposal/spec/reports with your file tools; the pre-refactor CLI has no track context command. '
    : 'For each Track run depa-codument track context <id> --json in its repository before acting, ';
  return 'Validated planning handoff (identity, not a completion verdict):\n' + JSON.stringify(current, null, 2) + '\n' +
    `Continue these exact resources in their indicated repositories; an empty default list does not mean no plan. Never create a duplicate replacement Track. ${context}Use ${command} transition receipts for moved directories. Reobserve current source and applicable configuration/evidence; the handoff hash records observation only. For completed resources with external findings, reopen the same identity through the lifecycle command and preserve all hook rounds. Mission selected-tasks/backlog policy still governs which linked work runs.\n`;
}
