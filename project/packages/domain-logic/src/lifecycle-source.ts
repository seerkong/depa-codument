import { parseXnl, wordToString } from 'xnl-core';
import type { LifecycleSourceCodec } from 'depa-codument-domain-contract/operations';
import { LIFECYCLE_ROOT_STATES, type LifecycleValidationContext } from 'depa-codument-domain-contract';
import { isDataElement } from './registry';
import { patchLifecycleSource } from './source-patch';
import { validateLifecycleTree } from './lifecycle-validation';
import { explainXnlParseError } from './xnl-diagnostics';

/** Recovery discovery admits identity/envelope only, never task/state validity. */
export function inspectLifecycleIdentity(source: string, kind: 'track' | 'mission') {
  let parsed;
  try {
    parsed = parseXnl(source, { textBlockStyle: true });
  } catch (cause) {
    throw new Error(explainXnlParseError(source, cause));
  }
  const root = parsed.nodes[0];
  const tag = kind === 'track' ? 'Track' : 'Mission';
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(root) || root.tag !== tag) {
    throw new Error(`Lifecycle authority requires exactly one unambiguous <${tag}> root.`);
  }
  const id = wordToString(root.id);
  if (!id) throw new Error('Lifecycle authority requires a stable root ID.');
  if (root.metadata.envelopeVersion !== 'halfcode.resource-envelope/v1' || root.metadata.specVersion !== 1
    || 'apiVersion' in root.metadata || 'version' in root.metadata) {
    throw new Error('Lifecycle envelope/spec requires migration or review before normal writes.');
  }
  return { id, root };
}

/** Current authoring envelope only. This is structural admission, not the full
 * semantic validator; historical inputs must use the migration boundary. */
export const lifecycleSourceCodec = Object.freeze<LifecycleSourceCodec>({
  inspect(source, kind) {
    const { id, root } = inspectLifecycleIdentity(source, kind);
    if (!LIFECYCLE_ROOT_STATES[kind].includes(String(root.attributes?.status))) throw new Error(`Invalid ${kind} root status.`);
    for (const field of ['gap_round', 'revision']) {
      const value = root.attributes?.[field];
      if (value !== undefined && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) {
        throw new Error(`Lifecycle ${field} must be a non-negative integer.`);
      }
    }
    return { id, root };
  },
  patch: patchLifecycleSource,
});

/** Composition for callers that have observed the required profile context.
 * The unvalidated codec remains useful for migration inspection/repair tooling;
 * product admission should use this semantic gate plus companion/graph checks. */
export function createValidatedLifecycleSourceCodec(context: LifecycleValidationContext): LifecycleSourceCodec {
  const observed = structuredClone(context);
  return Object.freeze<LifecycleSourceCodec>({
    identify(source, kind) {return lifecycleSourceCodec.inspect(source, kind).id;},
    inspect(source, kind) {
      const value = lifecycleSourceCodec.inspect(source, kind);
      const errors = validateLifecycleTree(value.root, observed).filter((finding) => finding.severity === 'error');
      if (errors.length) throw new Error(errors.map((finding) => `${finding.rule}: ${finding.message}`).join('\n'));
      return value;
    },
    patch: lifecycleSourceCodec.patch,
  });
}
