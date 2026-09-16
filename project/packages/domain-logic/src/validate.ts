import { parseXnl, wordToString, type DataElementNode } from 'xnl-core';
import type { DomainValidationFinding, DomainValidationRequest, DomainValidationResult, DomainValidationSnapshot } from 'depa-codument-domain-contract';
import { isDataElement } from './registry';
import { lifecycleSourceCodec } from './lifecycle-source';
import { validateLifecycleTree } from './lifecycle-validation';
import { validateDecisionSources } from './decisions';
import { readAttractorProfileNames } from './config';
import { historicalCompletion } from './historical-completion';

/** Full validation of explicitly observed sources. Does not execute hooks,
 * mutate resources, merge working forests, or cache a fresh semantic verdict. */
export function inspectDomainValidation(snapshot: DomainValidationSnapshot, request: DomainValidationRequest): DomainValidationResult {
  const global: DomainValidationFinding[] = [...snapshot.findings];
  let profileNames: readonly string[] | undefined;
  try { profileNames = readAttractorProfileNames(snapshot.profiles); }
  catch (error) { global.push({ file: 'codument/config/attractor-profiles.xnl', severity: 'error', rule: 'attractor.config', message: String(error) }); }
  const promote = (finding: DomainValidationFinding): DomainValidationFinding => request.strict && finding.severity === 'warning' ? { ...finding, severity: 'error' } : finding;
  const identities = new Map<string, string>();
  const units = snapshot.units.map(unit => {
    let historical: ReturnType<typeof historicalCompletion>;
    const findings: DomainValidationFinding[] = [...unit.findings];
    const prefix = unit.kind.toLowerCase();
    function error(file: string, rule: string, message: string): void { findings.push({ file, severity: 'error', rule, message }); }
    if (unit.source !== undefined) {
      try {
        const parsed = lifecycleSourceCodec.inspect(unit.source, unit.kind === 'Track' ? 'track' : 'mission');
        const root = parsed.root;
        findings.push(...validateLifecycleTree(root, { file: unit.file, profileNames }));
        historical = historicalCompletion(root, unit.file);
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
    for (const forest of unit.decisionForests) {
      for (const finding of validateDecisionSources(forest)) findings.push({ file: finding.file, severity: finding.severity,
        rule: finding.layer ? `decision.${finding.layer}` : 'decision.validation', message: finding.message });
    }
    return { kind: unit.kind, id: unit.id, file: unit.file, directory: unit.directory,
      ...(historical ? { historicalCompletion: historical } : {}), findings: findings.map(promote) };
  });
  return { units, findings: [...global.map(promote), ...units.flatMap(unit => unit.findings)] };
}
