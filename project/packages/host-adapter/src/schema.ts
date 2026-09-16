import type { CommandDefinition } from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import { KIND_SCHEMA_KINDS, parseKindSchemaKind, renderKindSchema } from 'depa-codument-domain-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

export function createSchemaCommand<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R> {
  const usage = `codument schema <${KIND_SCHEMA_KINDS.join('|')}> [--json]`;
  return {
    name: 'schema', summary: 'Print XNL root shape and slot fragments for one Kind.',
    usage: [usage], examples: KIND_SCHEMA_KINDS.map(kind => `codument schema ${kind}`),
    doc: { summary: usage, usage: [usage], examples: KIND_SCHEMA_KINDS.map(kind => `codument schema ${kind}`), options: ['--json'] },
    schema: createArgvSchema<R>(usage, [usage], [{ name: 'json', kind: 'boolean' }]),
    execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({ positional }) {
      if (positional.length !== 1) throw new Error(`Usage: ${usage}`);
      const kind = parseKindSchemaKind(positional[0]!);
      const schema = renderKindSchema(kind);
      return { code: 0, domainOutput: { kind, schema }, message: schema.replace(/\n$/, '') };
    },
  };
}
