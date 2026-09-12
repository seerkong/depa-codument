import type { OwnedLifecycleSnapshot, TrackExecutionContext } from 'depa-codument-domain-contract/operations';
import { readyTrackTasks } from './lifecycle';
import { isDataElement, orderedElementChildren } from './registry';
import { readAttractorProfileReferences } from './config';
import type { DataElementNode } from 'xnl-core';

/** Projection only: the repository owns identity admission and all transitions. */
export function projectTrackExecutionContext(source: OwnedLifecycleSnapshot, profilesSource?: string): TrackExecutionContext {
  if (source.kind !== 'track') throw new Error('Track execution context requires a Track authority.');
  const observed = readyTrackTasks(source);
  const status = String(source.root.attributes?.status ?? 'new');
  const { id, stage, directory, file, sourceRevision } = source;
  const profiles: string[] = [];
  function children(node: DataElementNode, tag: string): DataElementNode[] {
    return orderedElementChildren(node).filter((child): child is DataElementNode => isDataElement(child) && child.tag === tag);
  }
  function hooks(owner: DataElementNode): void {
    for (const collection of children(owner, 'Hooks')) {
      for (const hook of children(collection, 'Hook')) {
        for (const check of children(hook, 'AttractorCheck')) {
          if (typeof check.attributes?.use === 'string') profiles.push(check.attributes.use);
        }
      }
    }
  }
  function tasks(container: DataElementNode): void {
    for (const subNodes of children(container, 'SubNodes')) {
      for (const task of orderedElementChildren(subNodes)) {
        if (!isDataElement(task) || !['Task', 'TaskGroup'].includes(task.tag)) continue;
        hooks(task);
        tasks(task);
      }
    }
  }
  hooks(source.root);
  for (const taskSpace of children(source.root, 'TaskSpace')) tasks(taskSpace);
  const attractors = { profilesObserved: profilesSource !== undefined, references: readAttractorProfileReferences(profilesSource, profiles) };
  return {
    version: 1,
    identity: { kind: 'track', id, stage, directory, file, sourceRevision },
    status,
    ready: stage === 'archived' || ['completed', 'cancelled'].includes(status) ? [] : observed.ready,
    contract: structuredClone(source.root),
    attractors,
    requiredSources: [
      `${directory}/proposal.md`, `${directory}/design.md`,
      `${directory}/behavior_deltas/`, `${directory}/modeling_deltas/`, `${directory}/engineering_deltas/`,
      'codument/config/', 'codument/attractors/',
      ...attractors.references.filter(profile => profile.enabled).flatMap(profile => profile.refs),
    ],
    limitations: [
      'Read applicable source files, input references, decisions and current evidence using impl-track; paths are not an assertion that optional deltas exist.',
      'This observation is not approval, semantic acceptance or hook completion. DONE does not prove task:after or phase:after ran.',
      'Reobserve after any source, configuration or evidence change. sourceRevision is an instance-scoped CAS token, not a cross-invocation cache key.',
      'Before designing or writing code, read the bodies of enabled attractor references. Reading profile configuration alone does not load those rules; this does not replace fresh AttractorCheck.',
    ],
  };
}
