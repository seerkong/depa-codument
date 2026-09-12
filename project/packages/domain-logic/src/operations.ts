import type { DomainOperation, DomainOperationReceipt, DomainOperationRuntime } from 'depa-codument-domain-contract/operations';
import type { LifecycleUpdate, TrackLinkTarget, VerificationReceipt } from 'depa-codument-domain-contract/lifecycle';
import {
  archiveMissionState, assertTrackTaskCompletable, bindMissionTrack, completeVerifiedTrackTask,
  missionTrackBindingRequest, setLifecycleGapRound, transitionLifecycleResource, transitionLifecycleTask,
} from './lifecycle';
import { runTrackVerification } from './verification';

/** Shared by legacy command adapters and Kind commands; effects stay behind ports. */
export async function applyDomainOperation(runtime: DomainOperationRuntime, request: DomainOperation): Promise<DomainOperationReceipt> {
  const input = structuredClone(request);
  const includeArchived = input.type === 'resource-transition'
    && (input.status === 'active' || (input.kind === 'track' && input.status === 'in_progress'));
  const source = await runtime.repository.load({ kind: input.kind, id: input.id }, { includeArchived });
  if (source.kind !== input.kind || source.id !== input.id) throw new Error('Repository returned a mismatched resource authority.');
  let update: LifecycleUpdate;
  let verification: VerificationReceipt | undefined;
  let binding: TrackLinkTarget | undefined;
  switch (input.type) {
    case 'resource-transition':
      update = transitionLifecycleResource(source, input.status, runtime.clock.nowIso());
      break;
    case 'task-transition':
      update = transitionLifecycleTask(source, input.taskId, input.status, runtime.clock.nowIso());
      break;
    case 'task-complete':
      assertTrackTaskCompletable(source, input.taskId);
      verification = await runTrackVerification(runtime.verification, { ...input, track: input.id });
      update = completeVerifiedTrackTask(source, input.taskId, verification, runtime.clock.nowIso());
      break;
    case 'gap-round':
      update = setLifecycleGapRound(source, input.round, runtime.clock.nowIso());
      break;
    case 'bind-track': {
      const target = missionTrackBindingRequest(source, input.taskId);
      binding = await runtime.repository.resolveTrack(input.trackId, target);
      if (binding.trackId !== input.trackId) throw new Error('Repository resolved a mismatched Track authority.');
      update = bindMissionTrack(source, input.taskId, binding, runtime.clock.nowIso());
      break;
    }
    case 'mission-archive':
      update = archiveMissionState(source, runtime.clock.nowIso());
      break;
    default:
      throw new Error('Unknown domain operation.');
  }
  // A verifier may have changed the authored plan. The repository must compare
  // sourceRevision here and reject stale proposals, never overwrite that edit.
  const result = await runtime.repository.commit(source, update, binding);
  return {
    kind: source.kind, id: update.subject, from: update.from, to: update.to, directory: result.directory,
    ...(verification ? { verification } : {}),
    ...(result.maintenanceWarnings?.length ? { maintenanceWarnings: result.maintenanceWarnings } : {}),
  };
}
