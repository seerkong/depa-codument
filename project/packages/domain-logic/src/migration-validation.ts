import { parseXnl, wordToString } from 'xnl-core';
import type { MigrationValidationSnapshot, ResourceMigrationPlan } from 'depa-codument-domain-contract';
import { isDataElement, orderedElementChildren } from './registry';
import { inspectDomainValidation } from './validate';
import { validateDecisionSources } from './decisions';
import { indexKnowledgeSources, validateKnowledgeIndex } from './knowledge';
import { readKnowledgeSettings } from './knowledge-read';
import { readAttractorProfileNames } from './config';

/** Complete existing domain validators, not a second permissive migration
 * schema. A workspace upgrade later also checks whole-App membership. */
export function validateResourceMigration(snapshot: MigrationValidationSnapshot, plan: ResourceMigrationPlan): readonly {severity: 'error' | 'warning'; message: string}[] {
  try {
    if (!plan.targetKind || !plan.targetPath) throw new Error('Migration target contract is unresolved.');
    if (plan.proposal?.source !== null) {
      if (snapshot.source === undefined) throw new Error('Migration candidate source is missing.');
      const parsed = parseXnl(snapshot.source, {textBlockStyle: true});
      if (parsed.warnings?.length || !parsed.nodes.length) throw new Error('Migration candidate is not an unambiguous current resource.');
      for (const root of parsed.nodes) if (!isDataElement(root) || root.tag !== plan.targetKind || !wordToString(root.id)
        || root.metadata.envelopeVersion !== plan.targetEnvelopeVersion || root.metadata.specVersion !== plan.targetSpecVersion
        || 'apiVersion' in root.metadata || 'version' in root.metadata) throw new Error('Migration candidate kind, identity or envelope differs from the selected contract.');
      if (plan.targetKind !== 'decision' && parsed.nodes.length !== 1) throw new Error('Migration candidate cardinality mismatch.');
    } else if (snapshot.source !== undefined) throw new Error('Retired source still exists in the validation view.');
    if (snapshot.domain) {
      if (!snapshot.domain.units.length) throw new Error('Migration target has no canonical lifecycle/Behavior owner.');
      return inspectDomainValidation(snapshot.domain, {strict: true}).findings;
    }
    if (snapshot.decisions) return validateDecisionSources(snapshot.decisions);
    if (snapshot.knowledge) return validateKnowledgeIndex(indexKnowledgeSources(snapshot.knowledge.sources, snapshot.knowledge.family, snapshot.knowledge.mode));
    if (plan.targetKind === 'ModelingConfig' || plan.targetKind === 'EngineeringConfig') readKnowledgeSettings(snapshot.source, plan.targetKind === 'ModelingConfig' ? 'modeling' : 'engineering');
    else if (plan.targetKind === 'AttractorProfiles') readAttractorProfileNames(snapshot.source);
    else if (plan.targetKind === 'OperationHooks') {
      const root = parseXnl(snapshot.source!, {textBlockStyle: true}).nodes[0];
      if (!isDataElement(root)) throw new Error('OperationHooks requires a data root.');
      const containers = orderedElementChildren(root).filter(node => node.tag === 'Operations');
      if (containers.length !== 1 || !isDataElement(containers[0])) throw new Error('OperationHooks requires one Operations collection.');
      const ids = new Set<string>();
      for (const operation of orderedElementChildren(containers[0])) {
        const id = wordToString(operation.id);
        if (!isDataElement(operation) || operation.tag !== 'Operation' || !id || ids.has(id)) throw new Error('Operation name is missing or duplicated.');
        ids.add(id);
      }
    } else throw new Error('Complete migration validation scope is unavailable; retain original source.');
    return [];
  } catch (cause) { return [{severity: 'error', message: String(cause)}]; }
}
