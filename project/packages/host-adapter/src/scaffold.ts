import type { ScaffoldRequest } from 'depa-codument-domain-contract';
import type { CommandDefinition } from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

export function createScaffoldCommand<R extends CodumentDomainCommandRuntime>(kind: 'Track' | 'Mission' | 'BehaviorPatch'): CommandDefinition<R> {
  const patch = kind === 'BehaviorPatch';
  const usage = patch ? 'codument behavior-patch create <track-id> <capability>' : `codument ${kind.toLowerCase()} create <id> --stage pending|active`;
  const options = [...(patch ? [] : [{ name: 'stage', kind: 'value' as const }]), { name: 'json', kind: 'boolean' as const }];
  return { name: 'create', summary: `Create a ${kind} skeleton that requires authoring.`, usage: [usage], examples: [],
    doc: { summary: usage, usage: [usage], examples: [], options: options.map(option => '--' + option.name) },
    schema: createArgvSchema<R>(usage, [usage], options), execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({ runtime, positional, options }) {
      if (positional.length !== (patch ? 2 : 1)) throw new Error(`Usage: ${usage}`);
      if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
      const [id, capability] = positional;
      let input: ScaffoldRequest;
      if (kind === 'BehaviorPatch') input = { kind, id, capability };
      else {
        if (options.stage !== 'pending' && options.stage !== 'active') throw new Error(`Usage: ${usage}`);
        input = { kind, id, stage: options.stage };
      }
      const result = await runtime.domain.scaffold(input);
      const message = patch ? `BehaviorPatch '${capability}' created for Track '${id}' in ${result.directory}` : `${kind} '${id}' created in ${result.directory}`;
      return { code: 0, domainOutput: result, message: [message, '  specVersion: 1', `  files: ${result.files.join(', ')}`,
        ...result.maintenanceWarnings?.map(warning => `Warning: ${warning}`) ?? []].join('\n') };
    },
  };
}
