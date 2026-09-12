import { diffNodes, dryRunMutations, wordToString, type DataElementNode } from 'xnl-core';
import type { BehaviorMutationProposal, DomainValidationFinding } from 'depa-codument-domain-contract';
import { isDataElement } from './registry';
import { attr, children, descendants, first, id } from './validation-tree';

/** Semantic inspection on already admitted current resource trees. Never
 * projects through the legacy XML DTO, which cannot retain opaque properties. */
export function validateBehaviorTree(root: DataElementNode, file: string): DomainValidationFinding[] {
  const findings: DomainValidationFinding[] = [];
  function report(rule: string, message: string): void { findings.push({ file, severity: 'error', rule, message }); }
  if (root.tag !== 'Behavior' && root.tag !== 'BehaviorPatch') {
    report('behavior.root', 'Behavior resource root must be <Behavior> or <BehaviorPatch>.');
    return findings;
  }
  if (!wordToString(root.id)) report('behavior.root.id', `<${root.tag}> requires a stable root ID.`);
  if (root.tag === 'Behavior') {
    const collection = first(root, 'Requirements');
    const requirements = collection ? children(collection).filter((node) => node.tag === 'Requirement') : [];
    if (!requirements.length) report('behavior.requirement.missing', 'Behavior registry 至少需要一个 Requirement');
    const identities = new Set<string>();
    for (const requirement of requirements) {
      const identity = id(requirement);
      if (!identity) report('behavior.requirement.id', '<Requirement> 缺少 id');
      else if (identities.has(identity)) report('behavior.requirement.duplicate-id', `Requirement id 重复：${identity}`);
      else identities.add(identity);
      const statement = first(requirement, 'Statement');
      if (statement?.kind !== 'TextElement' || !statement.text?.trim()) report('behavior.requirement.statement', `<Requirement #${identity}> 缺少非空 Statement`);
    }
  } else {
    if (!attr(root, 'capability')) report('behavior.patch.capability', 'BehaviorPatch requires capability identity.');
    const collection = first(root, 'Mutations');
    const mutations = collection ? children(collection) : [];
    if (!mutations.length) report('behavior.patch.mutations', 'BehaviorPatch 至少需要一个变更（Upsert|Delete|Move）');
    for (const mutation of mutations) {
      if (!['Upsert', 'Delete', 'Move'].includes(mutation.tag)) report('behavior.patch.operation', `Unsupported BehaviorPatch mutation: <${mutation.tag}>`);
      if (!attr(mutation, 'selector')?.startsWith('behavior://')) report('behavior.patch.selector', `<${mutation.tag}> selector 必须是 behavior://`);
      if (mutation.tag === 'Upsert') {
        const targets = mutation.kind === 'DataElement'
          ? (mutation.extend?.order ?? []).map((key) => mutation.extend!.children[key])
          : [];
        if (targets.length !== 1) report('behavior.patch.upsert-target', 'BehaviorPatch Upsert requires exactly one target node in its extend block.');
      }
    }
  }
  for (const hint of descendants(root).filter((node) => node.tag === 'KnowledgeHint')) {
    if (attr(hint, 'target') !== 'docs-profile') report('behavior.knowledge-hint.target', '<KnowledgeHint> target 必须是 docs-profile');
    if (!attr(hint, 'href')?.startsWith('vfs://')) report('behavior.knowledge-hint.href', '<KnowledgeHint> href 必须使用 vfs://');
    if (hint.attributes?.strength !== undefined && attr(hint, 'strength') !== 'hint') report('behavior.knowledge-hint.strength', '<KnowledgeHint> strength 只允许 hint');
  }
  return findings;
}

/** Native mutation plan for complete trees. A later source writer must preserve
 * comments/opaque source regions or require review before publication. */
export function proposeBehaviorMutation(base: DataElementNode, expected: DataElementNode): BehaviorMutationProposal {
  if (base.tag !== 'Behavior' || expected.tag !== 'Behavior' || !wordToString(base.id) || wordToString(base.id) !== wordToString(expected.id)) {
    throw new Error('Behavior mutation requires matching stable Behavior root identities.');
  }
  const errors = validateBehaviorTree(expected, 'behavior.xnl');
  if (errors.length) throw new Error(errors.map((finding) => `${finding.rule}: ${finding.message}`).join('\n'));
  const source = structuredClone(base);
  const target = structuredClone(expected);
  const mutations = diffNodes(source, target);
  const result = dryRunMutations(source, mutations, { verifyValueBefore: true, identityPolicy: 'allow-missing' });
  if (result.status === 'rejected') {
    throw new Error(`Native Behavior mutation batch rejected: ${result.diagnostics.map((finding) => `${finding.code}: ${finding.message}`).join('; ')}`);
  }
  if (!isDataElement(result.value) || diffNodes(result.value, target).length) throw new Error('Native Behavior mutation result diverged from the expected complete tree.');
  return { root: structuredClone(result.value), mutations: structuredClone(mutations) };
}
