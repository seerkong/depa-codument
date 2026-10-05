import type { ScaffoldRequest } from 'depa-codument-domain-contract';
import type { CommandDefinition } from 'halfcode-lite-cli-contract';
import { createArgvSchema } from 'halfcode-lite-cli-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

export function createScaffoldCommand<R extends CodumentDomainCommandRuntime>(kind: 'Track' | 'Mission'): CommandDefinition<R> {
  const usage = `codument ${kind.toLowerCase()} create <id> --stage pending|active`;
  const options = [{ name: 'stage', kind: 'value' as const }, { name: 'json', kind: 'boolean' as const }];
  return { name: 'create', summary: `Create a ${kind} skeleton that requires authoring.`, usage: [usage], examples: [],
    doc: { summary: usage, usage: [usage], examples: [], options: options.map(option => '--' + option.name) },
    schema: createArgvSchema<R>(usage, [usage], options), execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({ runtime, positional, options }) {
      if (positional.length !== 1) throw new Error(`Usage: ${usage}`);
      if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
      if (options.stage !== 'pending' && options.stage !== 'active') throw new Error(`Usage: ${usage}`);
      const input: ScaffoldRequest = { kind, id: positional[0]!, stage: options.stage };
      const result = await runtime.domain.scaffold(input);
      const message = `${kind} '${input.id}' created in ${result.directory}`;
      return { code: 0, domainOutput: result, message: [message, '  specVersion: 1', `  files: ${result.files.join(', ')}`,
        ...result.maintenanceWarnings?.map(warning => `Warning: ${warning}`) ?? []].join('\n') };
    },
  };
}
