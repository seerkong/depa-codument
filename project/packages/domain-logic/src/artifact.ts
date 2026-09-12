import type { ArtifactChange, ArtifactSyncPort, ArtifactSyncRequest, ArtifactSyncResult, ArtifactSyncSnapshot } from 'depa-codument-domain-contract';

export function planArtifactChanges(snapshot: ArtifactSyncSnapshot): readonly ArtifactChange[] {
  return [...snapshot.sources].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, digest]) => ({path,
    status: !snapshot.targets.has(path) ? 'create' : snapshot.targets.get(path) === digest ? 'unchanged' : 'update'}));
}
export async function syncArtifacts(port: ArtifactSyncPort, request: ArtifactSyncRequest): Promise<ArtifactSyncResult> {
  const input = structuredClone(request);
  for (const name of ['source', 'target'] as const) if (typeof input[name] !== 'string' || !input[name].trim()) throw new Error(`--${name} requires a directory path.`);
  for (const name of ['dryRun', 'force'] as const) if (input[name] !== undefined && typeof input[name] !== 'boolean') throw new Error(`Artifact ${name} must be boolean.`);
  const snapshot = await port.observe(input);
  const changes = planArtifactChanges(snapshot);
  const details = {source: snapshot.source, target: snapshot.target, changes};
  if (input.dryRun) return {status: 'dry-run', ...details};
  if (!input.force && changes.some(change => change.status === 'update')) return {status: 'conflict', ...details};
  return {status: 'synced', ...details, ...await port.publish(snapshot)};
}
