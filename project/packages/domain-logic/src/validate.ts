import { parseXnl, wordToString, type DataElementNode } from 'xnl-core';
import type { DomainValidationFinding, DomainValidationRequest, DomainValidationResult, DomainValidationSnapshot } from 'depa-codument-domain-contract';
import { isDataElement } from './registry';
import { lifecycleSourceCodec } from './lifecycle-source';
import { validateLifecycleTree } from './lifecycle-validation';
import { validateBehaviorTree } from './behavior';
import { validateDecisionSources } from './decisions';
import { readAttractorProfileNames } from './config';
import { historicalCompletion } from './historical-completion';

function currentRoot(source: string, tag: 'Behavior' | 'BehaviorPatch'): DataElementNode {
  const parsed = parseXnl(source, { textBlockStyle: true });
  const node = parsed.nodes[0];
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(node) || node.tag !== tag) throw new Error(`Expected one unambiguous <${tag}> root.`);
  if (node.metadata.envelopeVersion !== 'halfcode.resource-envelope/v1' || node.metadata.specVersion !== 1
    || 'apiVersion' in node.metadata || 'version' in node.metadata) throw new Error(`${tag} envelope requires migration or review.`);
  return node;
}

/** Full validation of explicitly observed sources. Does not execute hooks,
 * mutate resources, merge working forests, or cache a fresh semantic verdict. */
export function inspectDomainValidation(snapshot: DomainValidationSnapshot, request: DomainValidationRequest): DomainValidationResult {
  const global: DomainValidationFinding[] = [...snapshot.findings];
  let profileNames: readonly string[] | undefined;
  if (snapshot.units.some(unit => unit.kind !== 'Behavior')) {
    try { profileNames = readAttractorProfileNames(snapshot.profiles); }
    catch (error) { global.push({ file: 'codument/config/attractor-profiles.xnl', severity: 'error', rule: 'attractor.config', message: String(error) }); }
  }
  const promote = (finding: DomainValidationFinding): DomainValidationFinding => request.strict && finding.severity === 'warning' ? { ...finding, severity: 'error' } : finding;
  const identities = new Map<string, string>();
  const units = snapshot.units.map(unit => {
    let historical: ReturnType<typeof historicalCompletion>;
    const findings: DomainValidationFinding[] = [...unit.findings];
    const prefix = unit.kind.toLowerCase();
    function error(file: string, rule: string, message: string): void { findings.push({ file, severity: 'error', rule, message }); }
    if (unit.source !== undefined) {
      try {
        let root: DataElementNode;
        if (unit.kind === 'Behavior') {
          root = currentRoot(unit.source, 'Behavior');
          findings.push(...validateBehaviorTree(root, unit.file));
        }
        else {
          const parsed = lifecycleSourceCodec.inspect(unit.source, unit.kind === 'Track' ? 'track' : 'mission');
          root = parsed.root;
          findings.push(...validateLifecycleTree(root, { file: unit.file, profileNames }));
          historical = historicalCompletion(root, unit.file);
        }
        const id = wordToString(root.id);
        if (id) {
          const key = unit.kind + ':' + id;
          const previous = identities.get(key);
          if (previous) error(unit.file, prefix + '.duplicate-authority', `Duplicate resource identity '${id}': ${previous}, ${unit.file}`);
          else identities.set(key, unit.file);
        }
      } catch (cause) { error(unit.file, prefix + '.kind', String(cause)); }
    } else if (!findings.length) error(unit.file, prefix + '.missing', `${unit.kind} authority file is missing.`);
    for (const file of unit.missingFiles) error(file, prefix + '.required-file', `${unit.kind} Kind required file is missing: ${file.split('/').at(-1)}`);
    if (unit.kind === 'Track' && unit.patches.size === 0) error(unit.directory + '/behavior_deltas', 'track.behavior-delta.missing', '当前 Track 至少需要一个由 CLI scaffold 的 BehaviorPatch XNL');
    for (const [file, source] of unit.patches) {
      try { findings.push(...validateBehaviorTree(currentRoot(source, 'BehaviorPatch'), file)); }
      catch (cause) { error(file, 'behavior.patch.kind', String(cause)); }
    }
    for (const forest of unit.decisionForests) {
      for (const finding of validateDecisionSources(forest)) findings.push({ file: finding.file, severity: finding.severity,
        rule: finding.layer ? `decision.${finding.layer}` : 'decision.validation', message: finding.message });
    }
    return { kind: unit.kind, id: unit.id, file: unit.file, directory: unit.directory, patchCount: unit.patches.size,
      ...(historical ? { historicalCompletion: historical } : {}), findings: findings.map(promote) };
  });
  return { units, findings: [...global.map(promote), ...units.flatMap(unit => unit.findings)] };
}
