import type {ArchiveReceipt} from 'depa-codument-domain-contract';
import type {CommandDefinition} from 'halfcode-cli-lite-cli-host-contract';
import {createArgvSchema} from 'halfcode-cli-lite-cli-host-logic';
import type {CodumentDomainCommandRuntime} from './index';
import {CODUMENT_DOMAIN_EXECUTION} from './execution';

export function createArchiveCommand<R extends CodumentDomainCommandRuntime>(kind: 'track' | 'mission'): CommandDefinition<R> {
  const usage = kind === 'track' ? 'codument archive <track-id> [--skip-specs] [--yes|-y] [--json]' : 'codument mission archive <id> [--yes|-y] [--json]';
  return {name: 'archive', summary: `Archive a ${kind} with guarded promotions.`, usage: [usage], examples: [],
    doc: {summary: `Archive a ${kind} with guarded promotions.`, usage: [usage], examples: [], options: ['--yes, -y', '--json', ...(kind === 'track' ? ['--skip-specs'] : [])]},
    schema: createArgvSchema<R>(usage, [usage], [{name: 'yes', kind: 'boolean'}, {name: 'y', kind: 'boolean'}, {name: 'json', kind: 'boolean'}, ...(kind === 'track' ? [{name: 'skip-specs', kind: 'boolean' as const}] : [])]),
    execution: CODUMENT_DOMAIN_EXECUTION.lifecycle,
    async run({runtime, positional, options}) {
      if (positional.length !== 1) throw new Error(`Usage: ${usage}`);
      if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
      const skipSpecs = options['skip-specs'] === true;
      const result = await runtime.domain.archive({kind, id: positional[0], yes: options.yes === true || options.y === true, ...(kind === 'track' ? {skipSpecs} : {})});
      return {code: 0, domainOutput: result, message: archiveMessage(result, skipSpecs)};
    },
  };
}
function archiveMessage(result: ArchiveReceipt, skipSpecs: boolean): string {
  const lines = result.warnings.map(warning => 'Warning: ' + warning);
  if (result.kind === 'mission') {
    lines.push(`✓ Mission '${result.id}' archived to ${result.directory}`);
    if (result.promotedMemory?.length) lines.push(`  promoted memory: ${result.promotedMemory.join(', ')}`);
  } else {
    lines.push(`\nArchiving track: ${result.id}`, `Destination: ${result.directory}`, '✓ Track moved to tracks/archived', `✓ Archive ID: ${result.directory.split('/').at(-1)}`);
    if (skipSpecs) lines.push('  Skipped behavior/spec updates (--skip-specs)');
    else if (result.behaviorCapabilities?.length) lines.push(`✓ Updated behavior/spec registry: ${result.behaviorCapabilities.join(', ')}`);
    else lines.push('  No behavior/spec updates needed');
    for (const name of ['engineering', 'modeling'] as const) lines.push(result.updated[name]?.length ? `✓ Updated ${name} registry: ${result.updated[name]!.join(', ')}` : `  No ${name} updates needed`);
    if (result.updated.decisions?.length) lines.push(`✓ Updated decision registry: ${result.updated.decisions.join(', ')}`);
    if (result.summary) lines.push(`✓ Generated archive summary: ${result.summary}`);
    if (result.promotedMemory?.length) lines.push(`✓ Promoted memory records: ${result.promotedMemory.join(', ')}`);
    lines.push(`\n✓ Track "${result.id}" archived successfully!\n`);
  }
  for (const warning of result.maintenanceWarnings ?? []) lines.push('Warning: ' + warning);
  return lines.join('\n');
}
