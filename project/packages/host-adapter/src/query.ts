import type { DomainQueryResult, TrackQueryView } from 'depa-codument-domain-contract';
import type { CommandDefinition } from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

function status(value: string): string {
  return ({ new: '[ ]', in_progress: '[~]', completed: '[x]', cancelled: '[-]', TODO: '[ ]', IN_PROGRESS: '[~]', DONE: '[x]', BLOCKED: '[!]' } as Record<string, string>)[value] ?? `[${value}]`;
}
function progress(summary: NonNullable<TrackQueryView['taskSummary']>): string {
  return `${summary.completed}/${summary.total_tasks} (${summary.total_tasks > 0 ? Math.round(summary.completed / summary.total_tasks * 100) : 0}%)`;
}
function heading(kind: string, id: string): string[] { return ['', '='.repeat(60), `${kind}: ${id}`, '='.repeat(60)]; }

/** Legacy presentation remains a product concern, separate from query projections. */
export function formatDomainQuery(result: DomainQueryResult): string {
  if (result.kind === 'tracks') {
    if (!result.value.length) return 'No active tracks found.';
    return ['\nActive Tracks:\n', '  Status  ID                              Type      Progress', '  ' + '-'.repeat(68),
      ...result.value.map(track => `  ${status(track.metadata.status)}   ${track.id.padEnd(32)}${track.metadata.type.padEnd(10)}${track.taskSummary ? progress(track.taskSummary) : '-'}`),
      `\nTotal: ${result.value.length} track(s)\n`].join('\n');
  }
  if (result.kind === 'specs') {
    if (!result.value.length) return 'No specifications found.';
    return ['\nSpecifications:\n', '  ID                          Format      Requirements  Scenarios', '  ' + '-'.repeat(72),
      ...result.value.map(spec => `  ${spec.id.padEnd(28)}${spec.format.padEnd(12)}${String(spec.requirements).padStart(8)}${String(spec.scenarios).padStart(10)}`),
      `\nTotal: ${result.value.length} spec(s)\n`].join('\n');
  }
  if (result.kind === 'track') {
    const track = result.value, metadata = track.metadata;
    const lines = [...heading('Track', track.id), `\nStatus:      ${status(metadata.status)} ${metadata.status}`, `Type:        ${metadata.type}`,
      `Description: ${metadata.description}`, `Created:     ${metadata.created_at}`, `Updated:     ${metadata.updated_at}`];
    const summary = track.taskSummary;
    if (metadata.historicalCompletion) lines.push('Completion:  historical declaration; NOT reverified under current rules');
    if (summary) lines.push(`\nProgress:    ${progress(summary)}`, `  Phases:    ${summary.total_phases}`, `  Completed: ${summary.completed}`,
      `  In Progress: ${summary.in_progress}`, `  Todo:      ${summary.todo}`, `  Blocked:   ${summary.blocked}`);
    lines.push('\nFiles:');
    const standard = ['proposal.md', 'track.xnl', 'track.xml', 'design.md', 'decisions.xnl', 'decisions.md'];
    for (const file of standard) lines.push(`  ${track.files?.includes(file) ? '✓' : '✗'} ${file}`);
    const deltas = track.files?.filter(file => !standard.includes(file)) ?? [];
    lines.push(...(deltas.length ? deltas.map(file => `  ✓ ${file}`) : ['  ✗ behavior_deltas/**/*.xnl']), '');
    return lines.join('\n');
  }
  if (result.kind === 'spec') {
    const spec = result.value;
    return [...heading('Spec', spec.id), '\nFormat: XNL', `Requirements: ${spec.requirements}`, `Scenarios: ${spec.scenarios}`,
      '\nFiles:', `  ✓ ${spec.id}.xnl`, ''].join('\n');
  }
  if (result.kind !== 'decision') throw new Error('Status requires the product status presentation.');
  const value = result.value;
  const lines = [...heading('Decision', String(value.id)), `\nURI:         ${value.uri}`, `Owner:       ${value.owner_file}`];
  for (const [field, label] of [['status', 'Status:     '], ['source', 'Source:     '], ['provenance', 'Provenance:  ']]) {
    if (value[field]) lines.push(`${label} ${value[field]}`);
  }
  const ancestors = value.ancestors as readonly { tag: string; id?: string }[];
  if (ancestors.length) lines.push('Hierarchy:', ...ancestors.map(ancestor => `  - ${ancestor.tag}${ancestor.id ? ` #${ancestor.id}` : ''}`));
  return [...lines, ''].join('\n');
}

export function createQueryCommands<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R>[] {
  return (['list', 'show'] as const).map((operation): CommandDefinition<R> => {
    const usage = operation === 'list' ? 'codument list [--behaviors|--specs] [--json]' : 'codument show <id|decision://id> [--type track|spec|decision] [--json] [--include-content]';
    const options = operation === 'list'
      ? [{ name: 'behaviors', kind: 'boolean' as const }, { name: 'specs', kind: 'boolean' as const }]
      : [{ name: 'type', kind: 'value' as const }, { name: 'include-content', kind: 'boolean' as const }];
    return { name: operation, summary: `Query Codument ${operation === 'list' ? 'resources' : 'resource details'}.`, usage: [usage], examples: [],
      doc: { summary: usage, usage: [usage], examples: [], options: [...options.map(option => `--${option.name}`), '--json'] },
      schema: createArgvSchema<R>(usage, [usage], [...options, { name: 'json', kind: 'boolean' }]), execution: CODUMENT_DOMAIN_EXECUTION.registry,
      async run({ runtime, positional, options }) {
        if (positional.length !== (operation === 'list' ? 0 : 1)) throw new Error(`Usage: ${usage}`);
        if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
        const type = options.type;
        if (type !== undefined && type !== 'track' && type !== 'spec' && type !== 'decision') throw new Error('Unknown item type; expected track, spec or decision.');
        const result = operation === 'list'
          ? await runtime.domain.query({ operation, behaviors: options.behaviors === true || options.specs === true })
          : await runtime.domain.query({ operation, id: positional[0], type, includeContent: options['include-content'] === true });
        return { code: 0, domainOutput: result.value, message: formatDomainQuery(result) };
      },
    };
  });
}
