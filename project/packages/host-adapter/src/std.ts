import type { CommandDefinition } from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

export function createStdCommands<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R> {
  const usage = 'codument std lint [dir] [--json]';
  return { name: 'std', summary: 'Codument standard documentation checks.', usage: ['codument std lint'], examples: [], children: [{
    name: 'lint', summary: 'Check current documentation authoring and authority rules.', usage: [usage], examples: [],
    doc: { summary: usage, usage: [usage], examples: [], options: ['--json'] },
    schema: createArgvSchema<R>(usage, [usage], [{ name: 'json', kind: 'boolean' }]),
    execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({ runtime, positional }) {
      if (positional.length > 1) throw new Error(`Usage: ${usage}`);
      if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
      const result = await runtime.domain.lintStd(positional[0]);
      return { code: result.findings.length ? 1 : 0, domainOutput: result.findings,
        message: result.findings.length
          ? result.findings.map(finding => `${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`).join('\n')
          : `✓ std lint: no issues in ${result.root}` };
    },
  }] };
}
