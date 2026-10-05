import type { CommandDefinition } from 'halfcode-lite-cli-contract';
import { createArgvSchema } from 'halfcode-lite-cli-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

/** The six non-conflicting bootstrap leaves use the local registry profile:
 * loading old config/App must not be a prerequisite to migrating that config. */
export function createMigrationCommands<R extends CodumentDomainCommandRuntime>(): readonly CommandDefinition<R>[] {
  function command(operation: 'inspect' | 'plan' | 'apply' | 'verify' | 'upgrade-resource'): CommandDefinition<R> {
    const upgrade = operation === 'upgrade-resource', label = upgrade ? operation : 'migrate ' + operation;
    const usage = `codument ${label} <path> [--json]`;
    return {name: operation, summary: usage, usage: [usage], examples: [],
      doc: {summary: usage, usage: [usage], examples: [], options: ['--json']},
      schema: createArgvSchema<R>(usage, [usage], [{name: 'json', kind: 'boolean'}]),
      execution: CODUMENT_DOMAIN_EXECUTION.registry,
      async run({runtime, positional}) {
        if (positional.length !== 1) throw new Error(`Usage: ${usage}`);
        const migration = runtime.migration;
        if (!migration) throw new Error('Codument migration runtime is not configured.');
        const input = positional[0];
        async function execute() {
          switch (operation) {
            case 'inspect': return migration!.inspect(input);
            case 'plan': return migration!.plan(input);
            case 'verify': return migration!.verify(input);
            default: return migration!.upgrade(input);
          }
        }
        const result = await execute();
        // Raw historical JSON projection: no host envelope and no whole source
        // proposal in default output. Plans still bind that material by digest.
        const {proposal: _proposal, ...output} = result as typeof result & {proposal?: unknown};
        void _proposal;
        const value: Record<string, unknown> = {...output, path: migration.displayPath(result.path)};
        if ('targetPath' in result && result.targetPath) value.targetPath = migration.displayPath(result.targetPath);
        if ('targetEnvelopeVersion' in result) value.targetApiVersion = result.targetEnvelopeVersion;
        if (upgrade && 'status' in result && (result.status === 'applied' || result.status === 'removed')) {
          value.status = 'upgraded'; value.semanticReviewRecommended = true;
        }
        const status = typeof value.status === 'string' ? value.status : value.valid === true ? 'valid' : value.valid === false ? 'invalid' : 'inspected';
        const lines = [`${label}: ${status} ${String(value.path)}`];
        if (value.fingerprint) lines.push('  fingerprint: ' + String(value.fingerprint));
        if (value.targetApiVersion) lines.push('  target: ' + String(value.targetApiVersion));
        if (value.backupPath) lines.push('  backup: ' + String(value.backupPath));
        lines.push(...result.diagnostics.map(message => '  - ' + message));
        return {code: value.status === 'review-required' ? 2 : value.valid === false ? 1 : 0, domainOutput: value, message: lines.join('\n')};
      },
    };
  }
  return [{name: 'migrate', summary: 'Inspect, plan, apply and verify historical resources locally.', usage: ['codument migrate <command>'], examples: [],
    children: [...(['inspect', 'plan', 'apply', 'verify'] as const).map(command), createMigrationGuideCommand<R>()]}, command('upgrade-resource'), createTrackMigrationCommand<R>()];
}

function createMigrationGuideCommand<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R> {
  const usage = 'codument migrate guide [resource|workspace|decision|track] [--json]';
  return {name: 'guide', summary: 'Read bundled migration guidance without loading workspace sources.', usage: [usage], examples: [],
    doc: {summary: usage, usage: [usage], examples: [], options: ['--json']},
    schema: createArgvSchema<R>(usage, [usage], [{name: 'json', kind: 'boolean'}]), execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({runtime, positional}) {
      const topic = positional[0] ?? 'resource';
      if (positional.length > 1 || !['resource', 'workspace', 'decision', 'track'].includes(topic)) throw new Error('Usage: ' + usage);
      if (!runtime.migrationGuidance) throw new Error('Migration guidance is unavailable.');
      const source = await runtime.migrationGuidance(topic as 'resource' | 'workspace' | 'decision' | 'track');
      return {code: 0, domainOutput: {topic, source}, message: source};
    },
  };
}

function createTrackMigrationCommand<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R> {
  const usage = 'codument upgrade-track <track-id|archive-id> [--mode wave|sequential] [--backup-dir <workspace-local-path>] [--json]';
  return {name: 'upgrade-track', summary: 'Upgrade a historical Track locally with mandatory backup and semantic review.', usage: [usage], examples: [],
    doc: {summary: usage, usage: [usage], examples: [], options: ['--mode', '--backup-dir', '--json', '--no-backup (rejected: backup is mandatory)']},
    schema: createArgvSchema<R>(usage, [usage], [{name: 'mode', kind: 'value'}, {name: 'backup-dir', kind: 'value'}, {name: 'no-backup', kind: 'boolean'}, {name: 'json', kind: 'boolean'}]),
    execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({runtime, positional, options}) {
      if (positional.length !== 1) throw new Error('Usage: ' + usage);
      const mode = options.mode ?? 'wave';
      if (mode !== 'wave' && mode !== 'sequential') throw new Error('Invalid --mode: ' + String(mode));
      if (!runtime.trackMigration) throw new Error('Track migration runtime is not configured.');
      const result = await runtime.trackMigration.upgrade(positional[0], {mode, noBackup: options['no-backup'] === true,
        backupDirectory: typeof options['backup-dir'] === 'string' ? options['backup-dir'] : undefined});
      const value = {...result, status: result.status === 'applied' ? 'upgraded' : result.status};
      return {code: result.status === 'review-required' ? 2 : 0, domainOutput: value,
        message: [`upgrade-track: ${value.status} ${result.path}`, `Mode: ${mode}`, `Backup: ${result.backupPath ?? '(none)'}`, ...result.diagnostics].join('\n')};
    },
  };
}
