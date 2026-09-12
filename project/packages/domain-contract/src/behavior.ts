import type { DataElementNode, XnlMutation } from 'xnl-core';

/** A proposal for the owned complete Behavior tree, not a serialized file. */
export interface BehaviorMutationProposal {
  readonly root: DataElementNode;
  readonly mutations: readonly XnlMutation[];
}
