import type { CommandDefinition } from 'halfcode-lite-cli-contract';
import { createArgvSchema } from 'halfcode-lite-cli-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

export function createArtifactCommands<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R> {
  const usage = 'codument artifact sync --source <dir> --target <dir> [--dry-run] [--force] [--json]';
  return {name: 'artifact', summary: 'Explicit artifact delivery.', usage: ['codument artifact sync'], examples: [], children: [{
    name: 'sync', summary: usage, usage: [usage], examples: [],
    doc: {summary: usage, usage: [usage], examples: [], options: ['--source', '--target', '--dry-run', '--force', '--json']},
    schema: createArgvSchema<R>(usage, [usage], [{name: 'source', kind: 'value'}, {name: 'target', kind: 'value'},
      {name: 'dry-run', kind: 'boolean'}, {name: 'force', kind: 'boolean'}, {name: 'json', kind: 'boolean'}]),
    execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({runtime, positional, options}) {
      if (positional.length || typeof options.source !== 'string' || typeof options.target !== 'string') throw new Error(`Usage: ${usage}`);
      if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
      const result = await runtime.domain.syncArtifacts({source: options.source, target: options.target, dryRun: options['dry-run'] === true, force: options.force === true});
      return {code: result.status === 'conflict' ? 2 : 0, domainOutput: result, message: `artifact sync: ${JSON.stringify(result)}`};
    },
  }]};
}
