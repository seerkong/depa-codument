import { parseXnl, XnlParseError, type DataElementNode, type TextElementNode, type XnlNode } from 'xnl-core';
import { RESOLVED_DECISION_STATUS as RESOLVED_STATUS_VALUES, type DecisionFinding, type DecisionFrontierEntry, type XnlDecisionOption, type XnlDecisionRecord } from 'depa-codument-domain-contract';
import { readStableNodeId } from './registry';
import { explainXnlParseError } from './xnl-diagnostics';

const RESOLVED_DECISION_STATUS = new Set(RESOLVED_STATUS_VALUES);

type Element = DataElementNode | TextElementNode;

function isDataElement(node: XnlNode | undefined): node is DataElementNode {
  return Boolean(node && typeof node === 'object' && (node as DataElementNode).kind === 'DataElement');
}

function isTextElement(node: XnlNode | undefined): node is TextElementNode {
  return Boolean(node && typeof node === 'object' && (node as TextElementNode).kind === 'TextElement');
}

function isElement(node: XnlNode | undefined): node is Element {
  return isDataElement(node) || isTextElement(node);
}

function readNodeId(node: DataElementNode): string | undefined {
  return readStableNodeId(node);
}

function prop(node: DataElementNode, key: string): unknown {
  return node.attributes?.[key] ?? node.metadata?.[key];
}

function propText(node: DataElementNode, key: string): string | undefined {
  const value = prop(node, key);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const child = node.extend?.children?.[key];
  if (isTextElement(child)) return (child.text ?? '').trim();
  return undefined;
}

function readXnlAnswerFeedback(node: DataElementNode): Pick<XnlDecisionRecord, 'rawAnswer' | 'decisionText' | 'rationale' | 'evidence' | 'answerWrapperPresent' | 'answerInDecisionBody' | 'invalidAnswerChildren'> {
  const answer = node.extend?.children?.answer;
  const answerInDecisionBody = (node.body ?? []).some((child) => isElement(child) && child.tag === 'answer');
  if (!answer || !isDataElement(answer)) {
    return {
      rawAnswer: propText(node, 'answer'),
      decisionText: propText(node, 'decision-text'),
      rationale: propText(node, 'rationale'),
      evidence: propText(node, 'evidence'),
      answerWrapperPresent: false,
      answerInDecisionBody,
      invalidAnswerChildren: 0,
    };
  }

  const allowed = new Set(['raw-answer', 'decision-text', 'rationale', 'evidence']);
  const nestedChildren = answer.extend?.children ?? {};
  const invalidAnswerChildren = Object.keys(nestedChildren).filter((key) => !allowed.has(key)).length
    + (answer.body?.length ?? 0);
  return {
    rawAnswer: propText(answer, 'raw-answer'),
    decisionText: propText(answer, 'decision-text'),
    rationale: propText(answer, 'rationale'),
    evidence: propText(answer, 'evidence'),
    answerWrapperPresent: true,
    answerInDecisionBody,
    invalidAnswerChildren,
  };
}

function propBool(node: DataElementNode, key: string): boolean {
  const value = prop(node, key);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes';
  }
  return false;
}

function hasBlockingBlocks(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== 'string') return Boolean(value);
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && normalized !== '-' && normalized !== 'none' && normalized !== '[]';
}

function collectDecisionNodes(node: XnlNode, out: DataElementNode[]): void {
  if (!isDataElement(node)) return;
  if (node.tag === 'decision') {
    out.push(node);
  }
  for (const child of (node.body ?? []).filter(isElement)) {
    collectDecisionNodes(child, out);
  }
}

function readXnlDecisionOptions(node: DataElementNode): Pick<XnlDecisionRecord, 'options' | 'optionsWrapperPresent' | 'optionsInDecisionBody' | 'directOptionChildren' | 'invalidOptionChildren'> {
  const wrapper = node.extend?.children?.options;
  const optionsInDecisionBody = (node.body ?? []).some((child) => isElement(child) && child.tag === 'options');
  const directOptionChildren = (node.body ?? []).filter((child) => isElement(child) && child.tag === 'option').length
    + (node.extend?.children?.option ? 1 : 0);
  if (!wrapper || !isDataElement(wrapper)) {
    return {
      options: [],
      optionsWrapperPresent: false,
      optionsInDecisionBody,
      directOptionChildren,
      invalidOptionChildren: 0,
    };
  }

  const options: XnlDecisionOption[] = [];
  let invalidOptionChildren = 0;
  for (const child of wrapper.body ?? []) {
    if (!isDataElement(child) || child.tag !== 'option') {
      invalidOptionChildren += 1;
      continue;
    }
    options.push({
      key: propText(child, 'key'),
      title: propText(child, 'title'),
      description: propText(child, 'description'),
      tradeoff: propText(child, 'tradeoff'),
      recommended: propBool(child, 'recommended'),
    });
  }

  return {
    options,
    optionsWrapperPresent: true,
    optionsInDecisionBody,
    directOptionChildren,
    invalidOptionChildren,
  };
}

function readXnlDecisionRecord(node: DataElementNode): XnlDecisionRecord {
  return {
    id: readNodeId(node) ?? `<${node.tag}>`,
    status: propText(node, 'status')?.toLowerCase(),
    blocks: prop(node, 'blocks'),
    durableCandidate: propBool(node, 'durable_candidate') || propBool(node, 'durable-candidate'),
    confidence: propText(node, 'confidence'),
    reversibility: propText(node, 'reversibility'),
    ...readXnlAnswerFeedback(node),
    ...readXnlDecisionOptions(node),
  };
}


/** Read model only; complete tree/source authority remains with its owner. */
export function readDecisionRecords(nodes: readonly XnlNode[]): XnlDecisionRecord[] {
  const decisions: DataElementNode[] = [];
  for (const node of nodes) collectDecisionNodes(node, decisions);
  return decisions.map(readXnlDecisionRecord);
}

function validateXnlDecisionRecords(
  file: string,
  records: XnlDecisionRecord[],
): DecisionFinding[] {
  const findings: DecisionFinding[] = [];
  for (const record of records) {
    const status = record.status;
    if (status === 'pending') {
      // pending 是规划期作者态（decision-tree 协议）：validate 只给 warning，不阻断。
      findings.push({
        file,
        severity: 'warning',
        decision: record.id,
        message: 'decision is still pending (authoring state; resolve to accepted/resolved/deferred before archive/promotion)',
      });
    }

    // durable 决策在提升/归档前必须 resolve：未决保持 error（归档 gate 语义）。
    if (record.durableCandidate && status && !RESOLVED_DECISION_STATUS.has(status)) {
      findings.push({
        file,
        severity: 'error',
        decision: record.id,
        message: `durable candidate decision has unresolved status '${status}' (must be accepted/resolved/deferred before promotion)`,
      });
    }

    if (hasBlockingBlocks(record.blocks) && status && !RESOLVED_DECISION_STATUS.has(status)) {
      findings.push({
        file,
        severity: 'warning',
        decision: record.id,
        message: `blocking decision has unresolved status '${status}'`,
      });
    }

    if (record.durableCandidate) {
      for (const [required, value] of [
        ['Evidence', record.evidence],
        ['Confidence', record.confidence],
        ['Reversibility', record.reversibility],
      ] as const) {
        if (!value || value === '-') {
          findings.push({
            file,
            severity: 'warning',
            decision: record.id,
            message: `durable candidate is missing ${required}`,
          });
        }
      }
    }

    if (record.optionsInDecisionBody) {
      findings.push({
        file,
        severity: 'error',
        decision: record.id,
        message: 'options must be inside the decision extend block (), not the decision body []',
      });
    }

    if (record.directOptionChildren > 0) {
      findings.push({
        file,
        severity: 'error',
        decision: record.id,
        message: 'option must be inside an options wrapper, not directly under decision',
      });
    }

    if (record.answerInDecisionBody) {
      findings.push({
        file,
        severity: 'error',
        decision: record.id,
        message: 'answer must be inside the decision extend block (), not the decision body []',
      });
    }

    if (record.answerWrapperPresent) {
      if (record.invalidAnswerChildren > 0) {
        findings.push({
          file,
          severity: 'error',
          decision: record.id,
          message: 'answer may contain only raw-answer, decision-text, rationale and evidence child nodes',
        });
      }
      for (const [label, value] of [
        ['Raw answer', record.rawAnswer],
        ['Decision text', record.decisionText],
        ['Rationale', record.rationale],
        ['Evidence', record.evidence],
      ] as const) {
        if (!value || value === '-') {
          findings.push({
            file,
            severity: 'error',
            decision: record.id,
            message: `answer is missing ${label}`,
          });
        }
      }
    }

    if (record.optionsWrapperPresent) {
      if (record.options.length === 0) {
        findings.push({
          file,
          severity: 'error',
          decision: record.id,
          message: 'options must contain at least one option',
        });
      }
      if (record.invalidOptionChildren > 0) {
        findings.push({
          file,
          severity: 'error',
          decision: record.id,
          message: 'options may contain only option child nodes',
        });
      }

      const keys = new Set<string>();
      for (const option of record.options) {
        if (!option.key) {
          findings.push({
            file,
            severity: 'error',
            decision: record.id,
            message: 'option is missing key',
          });
        } else if (keys.has(option.key)) {
          findings.push({
            file,
            severity: 'error',
            decision: record.id,
            message: `option key is duplicated: ${option.key}`,
          });
        } else {
          keys.add(option.key);
        }

        if (!option.title) {
          findings.push({
            file,
            severity: 'error',
            decision: record.id,
            message: `option ${option.key ?? '(unknown)'} is missing title`,
          });
        }
        if (!option.description) {
          findings.push({
            file,
            severity: 'error',
            decision: record.id,
            message: `option ${option.key ?? '(unknown)'} is missing description`,
          });
        }
      }

      const recommendedCount = record.options.filter((option) => option.recommended).length;
      if (recommendedCount !== 1) {
        findings.push({
          file,
          severity: 'error',
          decision: record.id,
          message: `options must mark exactly one recommended option (found ${recommendedCount})`,
        });
      }
    }
  }

  return findings.map((finding) => ({ ...finding, layer: 'schema' }));
}

interface DecisionNodeRef {
  file: string;
  id?: string;
  node: DataElementNode;
  parentId?: string;
}

function hierarchyFinding(
  file: string,
  decision: string,
  message: string,
): DecisionFinding {
  return { file, decision, message, severity: 'error', layer: 'hierarchy' };
}

function collectDecisionNodeRefs(
  value: unknown,
  file: string,
  refs: DecisionNodeRef[],
  findings: DecisionFinding[],
  parentDecision?: DataElementNode,
  directParent?: DataElementNode,
  relation?: 'body' | 'extend' | 'attributes' | 'metadata',
): void {
  if (isDataElement(value as XnlNode)) {
    const node = value as DataElementNode;
    const isDecision = node.tag === 'decision';
    const id = isDecision ? readNodeId(node) : undefined;

    if (isDecision) {
      if (parentDecision && (directParent !== parentDecision || relation !== 'body')) {
        findings.push(hierarchyFinding(
          file,
          id ?? '<decision>',
          'nested decision must be a direct child in its parent decision body',
        ));
      }

      for (const child of node.body ?? []) {
        if (!isDataElement(child) || child.tag !== 'decision') {
          findings.push(hierarchyFinding(
            file,
            id ?? '<decision>',
            'decision body may contain only nested decision nodes',
          ));
        }
      }

      refs.push({
        file,
        id,
        node,
        parentId: parentDecision ? readNodeId(parentDecision) : undefined,
      });
    }

    const decisionForChildren = isDecision ? node : parentDecision;
    for (const child of node.body ?? []) {
      collectDecisionNodeRefs(
        child,
        file,
        refs,
        findings,
        decisionForChildren,
        node,
        'body',
      );
    }
    for (const child of Object.values(node.extend?.children ?? {})) {
      collectDecisionNodeRefs(
        child,
        file,
        refs,
        findings,
        decisionForChildren,
        node,
        'extend',
      );
    }
    for (const child of Object.values(node.attributes ?? {})) {
      collectDecisionNodeRefs(
        child,
        file,
        refs,
        findings,
        decisionForChildren,
        node,
        'attributes',
      );
    }
    for (const child of Object.values(node.metadata ?? {})) {
      collectDecisionNodeRefs(
        child,
        file,
        refs,
        findings,
        decisionForChildren,
        node,
        'metadata',
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectDecisionNodeRefs(item, file, refs, findings, parentDecision, directParent, relation);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectDecisionNodeRefs(item, file, refs, findings, parentDecision, directParent, relation);
    }
  }
}

function normalizeDecisionReference(raw: string): string {
  return raw.startsWith('decision://') ? raw.slice('decision://'.length) : raw;
}

function referenceTarget(raw: string, expression: boolean): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const target = expression ? trimmed.slice(0, trimmed.indexOf('=')).trim() : trimmed;
  if (expression && !trimmed.includes('=')) return undefined;
  return normalizeDecisionReference(target) || undefined;
}

function stringList(
  value: unknown,
  field: string,
  ref: DecisionNodeRef,
  findings: DecisionFinding[],
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    findings.push({
      file: ref.file,
      decision: ref.id ?? '<decision>',
      severity: 'error',
      layer: 'schema',
      message: `${field} must be an array of strings`,
    });
    return [];
  }

  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      findings.push({
        file: ref.file,
        decision: ref.id ?? '<decision>',
        severity: 'error',
        layer: 'schema',
        message: `${field} must contain only non-empty strings`,
      });
      continue;
    }
    strings.push(item);
  }
  return strings;
}

function referenceFinding(
  ref: DecisionNodeRef,
  field: string,
  raw: string,
  knownIds: Set<string>,
  expression: boolean,
): DecisionFinding | undefined {
  const target = referenceTarget(raw, expression);
  if (!target) {
    return {
      file: ref.file,
      decision: ref.id ?? '<decision>',
      severity: 'error',
      layer: 'schema',
      message: `malformed ${field} reference '${raw}'`,
    };
  }
  if (knownIds.has(target)) return undefined;
  return hierarchyFinding(
    ref.file,
    ref.id ?? '<decision>',
    `unresolved ${field} reference '${target}'`,
  );
}

function validateDecisionReferences(
  refs: DecisionNodeRef[],
  knownIds: Set<string>,
): { findings: DecisionFinding[]; dependencies: Map<string, Set<string>> } {
  const findings: DecisionFinding[] = [];
  const dependencies = new Map<string, Set<string>>();

  for (const ref of refs) {
    if (!ref.id) continue;
    const deps = dependencies.get(ref.id) ?? new Set<string>();
    dependencies.set(ref.id, deps);
    if (ref.parentId) deps.add(ref.parentId);

    for (const raw of stringList(prop(ref.node, 'depends_on'), 'depends_on', ref, findings)) {
      const finding = referenceFinding(ref, 'depends_on', raw, knownIds, false);
      if (finding) {
        findings.push(finding);
      } else {
        deps.add(normalizeDecisionReference(raw.trim()));
      }
    }

    const activation = prop(ref.node, 'activation');
    if (activation !== undefined) {
      if (!activation || typeof activation !== 'object' || Array.isArray(activation)) {
        findings.push({
          file: ref.file,
          decision: ref.id,
          severity: 'error',
          layer: 'schema',
          message: 'activation must be an object containing all and/or any string arrays',
        });
      } else {
        const rules = activation as Record<string, unknown>;
        for (const key of ['all', 'any']) {
          for (const raw of stringList(rules[key], `activation.${key}`, ref, findings)) {
            const finding = referenceFinding(ref, 'activation', raw, knownIds, true);
            if (finding) findings.push(finding);
          }
        }
      }
    }

    for (const raw of stringList(prop(ref.node, 'derived_from'), 'derived_from', ref, findings)) {
      const finding = referenceFinding(ref, 'derived_from', raw, knownIds, true);
      if (finding) findings.push(finding);
    }
  }

  return { findings, dependencies };
}

function validateDependencyCycles(
  refs: DecisionNodeRef[],
  dependencies: Map<string, Set<string>>,
): DecisionFinding[] {
  const findings: DecisionFinding[] = [];
  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];
  const refsById = new Map(refs.filter((ref) => ref.id).map((ref) => [ref.id!, ref]));
  const reported = new Set<string>();

  const visit = (id: string): void => {
    state.set(id, 'visiting');
    stack.push(id);
    for (const dependency of dependencies.get(id) ?? []) {
      if (!dependencies.has(dependency)) continue;
      if (state.get(dependency) === 'visiting') {
        const start = stack.indexOf(dependency);
        const cycle = [...stack.slice(start), dependency];
        const key = [...new Set(cycle)].sort().join('|');
        if (!reported.has(key)) {
          reported.add(key);
          const ref = refsById.get(id)!;
          findings.push(hierarchyFinding(
            ref.file,
            id,
            `decision dependency graph contains a cycle: ${cycle.join(' -> ')}`,
          ));
        }
      } else if (!state.has(dependency)) {
        visit(dependency);
      }
    }
    stack.pop();
    state.set(id, 'visited');
  };

  for (const id of [...dependencies.keys()].sort()) {
    if (!state.has(id)) visit(id);
  }
  return findings;
}


/** Validate explicitly observed source bytes, including cross-file dependency
 * edges and nested ownership. Legacy envelopes stay in the migration boundary. */
function inspectDecisionSources(sources: ReadonlyMap<string, string>): { findings: DecisionFinding[]; refs: DecisionNodeRef[] } {
  const findings: DecisionFinding[] = [];
  const refs: DecisionNodeRef[] = [];

  for (const [file, content] of [...sources].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    let nodes: XnlNode[];
    try {
      const parsed = parseXnl(content, { textBlockStyle: true });
      if (parsed.warnings?.length) throw new Error(parsed.warnings.map((warning) => warning.message).join('; '));
      nodes = parsed.nodes;
    } catch (err) {
      findings.push({
        file: file,
        severity: 'error',
        decision: '(file)',
        layer: 'syntax',
        message: `invalid XNL: ${explainXnlParseError(content, err instanceof XnlParseError ? err : err)}`,
      });
      continue;
    }
    for (const node of nodes) {
      if (!isDataElement(node) || node.tag !== 'decision') {
        findings.push({file, severity: 'error', decision: '(file)', layer: 'schema', message: 'decision forest top-level roots must use <decision>'});
        continue;
      }
      if (node.metadata.envelopeVersion !== 'halfcode.resource-envelope/v1' || node.metadata.specVersion !== 1
        || 'apiVersion' in node.metadata || 'version' in node.metadata) {
        findings.push({file, severity: 'error', decision: readNodeId(node) ?? '<decision>', layer: 'schema',
          message: 'top-level decision envelope/spec requires migration or review before normal admission'});
      }
    }

    const fileRefs: DecisionNodeRef[] = [];
    for (const node of nodes) {
      collectDecisionNodeRefs(node, file, fileRefs, findings);
    }
    refs.push(...fileRefs);
    findings.push(...validateXnlDecisionRecords(
      file,
      fileRefs.map((ref) => readXnlDecisionRecord(ref.node)),
    ));
  }

  const knownIds = new Set<string>();
  const owners = new Map<string, DecisionNodeRef>();
  for (const ref of refs) {
    if (!ref.id) {
      findings.push({
        file: ref.file,
        severity: 'error',
        decision: '<decision>',
        layer: 'schema',
        message: 'decision node is missing a stable id',
      });
      continue;
    }
    const existing = owners.get(ref.id);
    if (existing) {
      findings.push(hierarchyFinding(
        ref.file,
        ref.id,
        `Duplicate decision node id '${ref.id}' in '${ref.file}' and '${existing.file}'`,
      ));
    } else {
      owners.set(ref.id, ref);
      knownIds.add(ref.id);
    }
  }

  const referenceResult = validateDecisionReferences(refs, knownIds);
  findings.push(...referenceResult.findings);
  findings.push(...validateDependencyCycles(refs, referenceResult.dependencies));
  return { findings, refs };
}

export function validateDecisionSources(sources: ReadonlyMap<string, string>, options: { strict?: boolean } = {}): DecisionFinding[] {
  const { findings } = inspectDecisionSources(sources);
  return options.strict ? findings.map((finding) => ({ ...finding, severity: 'error' as const })) : findings;
}

/** Compatible pending frontier. Validate first and reuse the same parsed refs;
 * source filenames remain provenance, not decision identities. */
export function projectDecisionFrontier(sources: ReadonlyMap<string, string>): DecisionFrontierEntry[] {
  const { findings, refs } = inspectDecisionSources(sources);
  const errors = findings.filter((finding) => finding.severity === 'error');
  if (errors.length) throw new Error(errors.map((finding) => `${finding.file}: ${finding.decision}: ${finding.message}`).join('\n'));
  return frontierFromRefs(refs);
}

/** One source parse per query; no cached semantic verdict or source discovery. */
export function inspectDecisionQuery(sources: ReadonlyMap<string, string>): { findings: DecisionFinding[]; frontier: DecisionFrontierEntry[] } {
  const { findings, refs } = inspectDecisionSources(sources);
  return { findings, frontier: findings.some(finding => finding.severity === 'error') ? [] : frontierFromRefs(refs) };
}

function frontierFromRefs(refs: readonly DecisionNodeRef[]): DecisionFrontierEntry[] {
  const statuses = new Map(refs.map((ref) => [ref.id!, propText(ref.node, 'status')?.toLowerCase()]));
  const resolved = (id: string): boolean => RESOLVED_DECISION_STATUS.has(statuses.get(normalizeDecisionReference(id.trim())) ?? '');
  const rank = new Map([['P0', 0], ['P1', 1], ['P2', 2]]);
  const entries: DecisionFrontierEntry[] = [];
  for (const ref of refs) {
    if (statuses.get(ref.id!) !== 'pending' || (ref.parentId && !resolved(ref.parentId))) continue;
    const value = prop(ref.node, 'depends_on') ?? prop(ref.node, 'depends-on');
    let dependencies: string[] = [];
    if (Array.isArray(value)) dependencies = value.filter((item): item is string => typeof item === 'string');
    else if (typeof value === 'string' && value.trim()) dependencies = [value.trim()];
    if (!dependencies.every(resolved)) continue;
    entries.push({
      id: ref.id!, priority: propText(ref.node, 'priority') ?? 'P2',
      question: propText(ref.node, 'question'), recommendation: propText(ref.node, 'recommendation'),
      depends_on: dependencies, parent: ref.parentId, source: ref.file,
    });
  }
  return entries.sort((a, b) => (rank.get(a.priority) ?? 3) - (rank.get(b.priority) ?? 3) || a.id.localeCompare(b.id));
}
