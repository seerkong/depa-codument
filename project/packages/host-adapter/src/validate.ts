import type { DomainValidationFinding, DomainValidationResult } from 'depa-codument-domain-contract';
import type { CommandDefinition } from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

function relative(base: string, file: string): string { return file.startsWith(base + '/') ? file.slice(base.length + 1) : file; }
function findingLine(finding: DomainValidationFinding, base: string): string {
  return `    ${finding.severity === 'error' ? '✗' : '⚠'} [${relative(base, finding.file)}]${finding.rule ? ` (${finding.rule})` : ''} ${finding.message}`;
}
export function formatDomainValidation(result: DomainValidationResult): string {
  if (!result.units.length && !result.findings.length) return 'No tracks or missions to validate.';
  const lines: string[] = [];
  const owned = new Set(result.units.flatMap(unit => unit.findings));
  for (const finding of result.findings) if (!owned.has(finding)) lines.push(findingLine(finding, 'codument'));
  for (const unit of result.units) {
    const errors = unit.findings.filter(finding => finding.severity === 'error').length;
    const warnings = unit.findings.length - errors;
    const label = unit.kind === 'Track' ? unit.id : `${unit.kind.toLowerCase()} ${unit.id}`;
    const fileName = unit.file.split('/').at(-1);
    if (errors) lines.push(`✗ ${label}: ${errors} error(s)`);
    else if (unit.historicalCompletion) lines.push(`⚠ ${label}: historical completion declaration; NOT reverified under current rules`);
    else lines.push(`✓ ${label}: ${fileName} OK${unit.patchCount ? ` + ${unit.patchCount} behavior delta(s)` : ''}${warnings ? ` (${warnings} warning)` : ''}`);
    for (const finding of unit.findings) lines.push(findingLine(finding, unit.directory));
  }
  return lines.join('\n');
}

export function createValidationCommand<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R> {
  const usage = 'codument validate [item|all] [--strict] [--json]';
  return { name: 'validate', summary: 'Validate current Codument process and behavior sources.', usage: [usage], examples: [],
    doc: { summary: usage, usage: [usage], examples: [], options: ['--strict', '--json'] },
    schema: createArgvSchema<R>(usage, [usage], [{ name: 'strict', kind: 'boolean' }, { name: 'json', kind: 'boolean' }]),
    execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({ runtime, positional, options }) {
      if (positional.length > 1) throw new Error(`Usage: ${usage}`);
      if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
      const result = await runtime.domain.validate({ target: positional[0], strict: options.strict === true });
      const message = formatDomainValidation(result);
      // Compatibility notices are not fresh validation verdicts or warnings
      // whose severity --strict can convert into missing historical evidence.
      const output = [...result.findings, ...result.units.flatMap(unit => unit.historicalCompletion ? [{
        file: unit.file, severity: 'notice', rule: 'track.history.not-reverified',
        message: 'Historical completion declaration; not reverified under current rules.',
        historicalCompletion: unit.historicalCompletion,
      }] : [])];
      // Historical validate --json prints diagnostics before the findings array.
      // Preserve that exceptional stdout protocol; the domain API is structured.
      const domainJsonText = message + '\n' + (result.units.length || result.findings.length ? JSON.stringify(output, null, 2) + '\n' : '');
      return { code: result.findings.some(finding => finding.severity === 'error') ? 1 : 0, domainOutput: output, domainJsonText, message };
    },
  };
}
