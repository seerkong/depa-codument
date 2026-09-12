import type { MigrationGuideTopic } from 'depa-codument-domain-contract';
import { CODUMENT_GLOBAL_GUIDANCE_ASSETS } from './global-guidance';

/** Same complete App assets used by the CLI and installation, independent of workspace state. */
export function readCodumentMigrationGuidance(topic: MigrationGuideTopic): string {
  const paths = {
    resource: ['references/migration/bootstrap.md'],
    workspace: ['references/migration/bootstrap.md'],
    decision: ['references/migration/decision-migration.md', 'references/std/spec/decision-registry.md', 'references/std/spec/xnl-format.md'],
    track: ['references/migration/bootstrap.md', 'references/std/spec/track-xnl-spec.md'],
  };
  if (!Object.hasOwn(paths, topic)) throw new Error('Unknown migration guide topic.');
  return paths[topic].map(path => {
    const asset = CODUMENT_GLOBAL_GUIDANCE_ASSETS.find(asset => asset.path === path);
    if (!asset) throw new Error('Missing migration guidance: ' + path);
    return asset.source;
  }).join('\n\n');
}
