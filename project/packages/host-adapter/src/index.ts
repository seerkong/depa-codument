import type { DomainOperation, DomainOwner } from 'depa-codument-domain-contract/operations';
import type { CommandContext, CommandDefinition, CommandRun } from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import { createDecisionCommands } from './decisions';
import { createProjectCommands } from './project';
import { createQueryCommands } from './query';
import { createScaffoldCommand } from './scaffold';
import { createValidationCommand } from './validate';
import { createSchemaCommand } from './schema';
import { createStdCommands } from './std';
import { createArtifactCommands } from './artifact';
import { createArchiveCommand } from './archive';
import { createMigrationCommands } from './migration';
import type { CodumentResourceMigrator, CodumentTrackMigrator, MigrationGuideTopic } from 'depa-codument-domain-contract';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';
export { CODUMENT_DOMAIN_EXECUTION, isCodumentDomainExecution } from './execution';

export interface CodumentDomainCommandRuntime {
  readonly domain?: DomainOwner;
  /** Product presentation mode, never authored domain state. */
  readonly domainJson?: boolean;
  readonly migration?: CodumentResourceMigrator;
  readonly trackMigration?: CodumentTrackMigrator;
  readonly migrationGuidance?: (topic: MigrationGuideTopic) => Promise<string>;
}

/** Adapts domain input/output, never performs repository writes or duplicates readiness rules. */
export function createCodumentDomainCommands<R extends CodumentDomainCommandRuntime = CodumentDomainCommandRuntime>(): readonly CommandDefinition<R>[] {
  type Context = CommandContext<R>;
  function owner(context: Context): DomainOwner {
    if (!context.runtime.domain) throw new Error('Codument domain runtime is not configured.');
    return context.runtime.domain;
  }
  function leaf(name: string, usage: string, count: number, run: CommandRun<R>, verification = false): CommandDefinition<R> {
    const schema = createArgvSchema<R>(usage, [usage], [
      { name: 'json', kind: 'boolean' }, ...(verification ? [{ name: 'fresh', kind: 'boolean' as const }] : []),
    ]);
    return {
      name, summary: usage, usage: [usage], examples: [],
      doc: { summary: usage, usage: [usage], examples: [], options: verification ? ['--fresh', '--json'] : ['--json'] },
      schema: { ...schema, parse(args, path, runtime) {
        const separator = args.indexOf('--');
        if (verification && (separator < 0 || separator === args.length - 1)) throw new Error(`Usage: ${usage}`);
        const before = separator < 0 ? args : args.slice(0, separator);
        const context = schema.parse(before, path, runtime);
        if (context.positional.length !== count || (!verification && separator >= 0)) throw new Error(`Usage: ${usage}`);
        return { ...context, args: [...args] };
      } },
      execution: CODUMENT_DOMAIN_EXECUTION.lifecycle, run,
    };
  }
  function group(name: string, children: readonly CommandDefinition<R>[]): CommandDefinition<R> {
    return { name, summary: `Codument ${name} operations.`, usage: [`codument ${name} <command>`], examples: [], children };
  }
  const report = (value: object) => ({ code: 0, data: { ...value }, message: `✓ ${JSON.stringify(value)}` });
  const apply = (build: (context: Context) => DomainOperation): CommandRun<R> => async context => report(await owner(context).apply(build(context)));
  function verification(context: Context) {
    return { command: context.args.slice(context.args.indexOf('--') + 1), fresh: context.options.fresh === true,
      captureOutput: context.runtime.domainJson === true || context.options.json === true };
  }
  const ready: CommandRun<R> = async ({ runtime, positional }) => {
    const [id] = positional;
    if (!id || positional.length !== 1) throw new Error('Usage: codument track ready <id> [--json]');
    if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
    const result = await runtime.domain.ready(id);
    const lines = result.ready.map(task => {
      const criteria = task.criteria.total > 0 ? ` criteria=${task.criteria.checked}/${task.criteria.total}` : '';
      return `${task.id}\t${task.kind}\t${task.status}${criteria}\t${task.name ?? ''}`.trimEnd();
    });
    return { code: 0, data: result, message: lines.join('\n') || `No ready Track tasks for '${id}'.` };
  };
  const lifecycle = (['track', 'mission'] as const).flatMap(kind => {
    const base = `codument ${kind}`;
    const task = [leaf('transition', `${base} task transition <id> <task-id> <status> [--json]`, 3,
      apply(({ positional: [id, taskId, status] }) => ({ type: 'task-transition', kind, id, taskId, status })))];
    if (kind === 'track') task.push(leaf('complete', `${base} task complete <id> <task-id> [--fresh] [--json] -- <verification-command> [args...]`, 2,
      apply(context => ({ type: 'task-complete', kind, id: context.positional[0], taskId: context.positional[1], ...verification(context) })), true));
    const children = [
      createScaffoldCommand<R>(kind === 'track' ? 'Track' : 'Mission'),
      leaf('transition', `${base} transition <id> <status> [--json]`, 2,
        apply(({ positional: [id, status] }) => ({ type: 'resource-transition', kind, id, status }))),
      leaf('gap-round', `${base} gap-round <id> <round> [--json]`, 2,
        apply(({ positional: [id, round] }) => ({ type: 'gap-round', kind, id, round: Number(round) }))),
      group('task', task),
    ];
    if (kind === 'track') {
      children.push(leaf('context', 'depa-codument track context <id> [--json]', 1,
        async context => report(await owner(context).context(context.positional[0]))));
      children.push(leaf('ready', `${base} ready <id> [--json]`, 1, ready));
      children.push(leaf('verify', `${base} verify <id> [--fresh] [--json] -- <verification-command> [args...]`, 1,
        async context => report(await owner(context).verify({ track: context.positional[0], ...verification(context) })), true));
    } else {
      children.push(createArchiveCommand<R>('mission'));
      children.push(leaf('bind-track', `${base} bind-track <mission-id> <task-id> <track-id> [--json]`, 3,
        apply(({ positional: [id, taskId, trackId] }) => ({ type: 'bind-track', kind, id, taskId, trackId }))));
    }
    return [group(kind, children), group(kind[0].toUpperCase() + kind.slice(1), children)];
  });
  return [...lifecycle, createDecisionCommands<R>(), createProjectCommands<R>(), ...createQueryCommands<R>(),
    createValidationCommand<R>(), createSchemaCommand<R>(), createStdCommands<R>(), createArtifactCommands<R>(), createArchiveCommand<R>('track'), ...createMigrationCommands<R>()];
}
