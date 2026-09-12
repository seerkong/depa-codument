import type { DecisionFinding } from 'depa-codument-domain-contract';
import type { CommandDefinition } from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

function findingsText(findings: readonly DecisionFinding[], display: string): string {
  if (!findings.length) return `✓ decisions validate: no issues in ${display}`;
  const errors = findings.filter(finding => finding.severity === 'error').length;
  return [`decisions validate: issues in ${display}:`, ...findings.map(finding => {
    const context = finding.layer ? ` [${finding.layer}; ${finding.file}]` : ` [${finding.file}]`;
    return `  [${finding.severity}] ${finding.decision}: ${finding.message}${context}`;
  }), `${errors} error(s), ${findings.length - errors} warning(s)`].join('\n');
}

export function createDecisionCommands<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R> {
  const createUsage = 'codument decisions create <file> <decision-id> [--parent <decision-id>] [--json]';
  const create: CommandDefinition<R> = {
    name: 'create', summary: 'Create a Decision in a source-preserving forest.', usage: [createUsage], examples: [],
    doc: { summary: 'Create a Decision in a source-preserving forest.', usage: [createUsage], examples: [], options: ['--parent <decision-id>', '--json'] },
    schema: createArgvSchema<R>(createUsage, [createUsage], [{ name: 'parent', kind: 'value' }, { name: 'json', kind: 'boolean' }]),
    execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({ runtime, positional, options }) {
      if (positional.length !== 2) throw new Error(`Usage: ${createUsage}`);
      if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
      const [file, id] = positional;
      const parent = typeof options.parent === 'string' ? options.parent : undefined;
      const result = await runtime.domain.createDecision({ file, id, parent });
      const warnings = result.maintenanceWarnings?.map(warning => `Warning: ${warning}`) ?? [];
      return { code: 0, data: { ...result }, message: [
        `Decision '${id}' created in ${file}${parent ? ` under '${parent}'` : ''}`, '  specVersion: 1', ...warnings,
      ].join('\n') };
    },
  };
  return { name: 'decisions', summary: 'Create and query Codument decision sources.', usage: ['codument decisions <command>'], examples: [],
    children: [create, ...(['validate', 'frontier'] as const).map((operation): CommandDefinition<R> => {
      const usage = `codument decisions ${operation} [target] [--json]`;
      const schema = createArgvSchema<R>(usage, [usage], [{ name: 'json', kind: 'boolean' }]);
      return { name: operation, summary: usage, usage: [usage], examples: [],
        doc: { summary: usage, usage: [usage], examples: [], options: ['--json'] },
        schema: { ...schema, validate(context) { if (context.positional.length > 1) throw new Error(`Usage: ${usage}`); } },
        execution: CODUMENT_DOMAIN_EXECUTION.registry,
        async run({ runtime, positional }) {
          if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
          const result = await runtime.domain.decisions({ operation, target: positional[0] });
          const errors = result.findings.some(finding => finding.severity === 'error');
          let domainOutput: unknown = result.findings;
          let message = findingsText(result.findings, result.display);
          if (operation === 'frontier') {
            domainOutput = errors ? { frontier: [], findings: result.findings } : result.frontier;
            if (!errors) message = result.frontier.length
              ? result.frontier.map(entry => `${entry.priority} ${entry.id}${entry.question ? `: ${entry.question}` : ''}`).join('\n')
              : `✓ decisions frontier: no ready pending decisions in ${result.display}`;
          }
          // Public dispatch transports this product extension unchanged. Its shell
          // emits the original array/object, never invents a second JSON envelope.
          return { code: errors ? 1 : 0, domainOutput, message };
        },
      };
    })],
  };
}
