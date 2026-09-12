import type { KnowledgeFinding, KnowledgeReadResult, KnowledgeReadRequest, KnowledgeFamily, KnowledgeScaffoldRequest } from 'depa-codument-domain-contract';
import type { CommandDefinition } from 'halfcode-cli-lite-cli-host-contract';
import { createArgvSchema } from 'halfcode-cli-lite-cli-host-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';

export function formatKnowledgeRead(result: KnowledgeReadResult): string {
  const family = result.family;
  if (result.kind === 'skipped') return `${family} disabled，跳过 (set enabled="true" in codument/config/${family}.xnl)`;
  if (result.kind === 'linted') {
    if (!result.findings.length) return `✓ ${family} lint: no fractal-split candidates in ${result.directory}`;
    return [`${family} lint: ${result.findings.length} fractal-split candidate(s) in ${result.directory}:`,
      ...result.findings.map(finding => `  • ${finding.file} — ${finding.reasons.join(', ')} → consider splitting into a same-name folder (see folder-manifest.md)`)].join('\n');
  }
  if (!result.findings.length) return `✓ ${family} validate: no issues in ${result.directory}`;
  const byFile = new Map<string, KnowledgeFinding[]>();
  for (const finding of result.findings) {
    const list = byFile.get(finding.file);
    if (list) list.push(finding);
    else byFile.set(finding.file, [finding]);
  }
  const lines = [`${family} validate: issues in ${result.directory}:`];
  for (const [file, findings] of byFile) {
    lines.push(`${file}:`);
    for (const finding of findings) {
      const where = finding.line !== undefined ? ` (line ${finding.line})` : '';
      const rule = finding.rule ? ` [${finding.rule}]` : '';
      lines.push(`  [${finding.layer}/${finding.severity}]${rule} ${finding.message}${where}`);
      if (finding.fix_hint) lines.push(`    fix_hint: ${finding.fix_hint}`);
    }
  }
  const errors = result.findings.filter(finding => finding.severity === 'error').length;
  lines.push(`${errors} error(s), ${result.findings.length - errors} warning(s)`);
  return lines.join('\n');
}

export function createKnowledgeCommands<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R>[] {
  return (['modeling', 'engineering'] as const).map(family => ({ name: family, summary: `Codument ${family} knowledge operations.`, usage: [`codument ${family} <command>`], examples: [],
    children: [...(['validate', 'lint'] as const).map((operation): CommandDefinition<R> => {
      const usage = `codument ${family} ${operation} [dir] ${operation === 'validate' ? '[--deltas <track>]' : '[--max-lines N] [--max-nodes N]'}`;
      const definitions = operation === 'validate' ? [{name: 'deltas', kind: 'value' as const}] : [{name: 'max-lines', kind: 'value' as const}, {name: 'max-nodes', kind: 'value' as const}];
      return {name: operation, summary: usage, usage: [usage], examples: [],
        doc: {summary: usage, usage: [usage], examples: [], options: [...definitions.map(option => `--${option.name}`), '--json']},
        schema: createArgvSchema<R>(usage, [usage], [...definitions, {name: 'json', kind: 'boolean'}]), execution: CODUMENT_DOMAIN_EXECUTION.registry,
        async run({runtime, positional, options}) {
          if (positional.length > 1) throw new Error(`Usage: ${usage}`);
          if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
          const request: KnowledgeReadRequest = {family, operation, directory: positional[0],
            deltas: typeof options.deltas === 'string' ? options.deltas : undefined,
            maxLines: options['max-lines'] === undefined ? undefined : Number(options['max-lines']),
            maxNodes: options['max-nodes'] === undefined ? undefined : Number(options['max-nodes'])};
          const result = await runtime.domain.knowledge(request);
          const message = formatKnowledgeRead(result);
          // Original engineering validate and both lint leaves printed text even
          // with --json; only modeling validate offered a JSON findings protocol.
          const originalJson = result.kind === 'validated' && family === 'modeling';
          return {code: result.kind === 'validated' && result.findings.some(finding => finding.severity === 'error') ? 1 : 0,
            domainOutput: result.kind === 'skipped' ? undefined : result.findings,
            ...(originalJson ? {} : {domainJsonText: message + '\n'}), message};
        },
      };
    }), createKnowledgeScaffoldCommand<R>(family)],
  }));
}

function createKnowledgeScaffoldCommand<R extends CodumentDomainCommandRuntime>(family: KnowledgeFamily): CommandDefinition<R> {
  const names = family === 'modeling' ? ['plane', 'context', 'track', 'fields', 'states'] : ['plane', 'category', 'topic', 'track'];
  const usage = `codument ${family} scaffold <kind> <name> --plane <plane> ${family === 'modeling' ? '--context <ctx> [--fields a:string,b:int] [--states a,b]' : '--category <cat> --topic <topic>'} [--track <track>]`;
  return {name: 'scaffold', summary: `Append a ${family} draft to its resource owner.`, usage: [usage], examples: [],
    doc: {summary: usage, usage: [usage], examples: [], options: [...names.map(name => `--${name}`), '--json']},
    schema: createArgvSchema<R>(usage, [usage], [...names.map(name => ({name, kind: 'value' as const})), {name: 'json', kind: 'boolean'}]),
    execution: CODUMENT_DOMAIN_EXECUTION.registry,
    async run({runtime, positional, options}) {
      const required = family === 'modeling' ? ['plane', 'context'] : ['plane', 'category', 'topic'];
      if (positional.length !== 2 || required.some(name => typeof options[name] !== 'string')) throw new Error(`Usage: ${usage}`);
      if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
      const common = {kind: positional[0]!, name: positional[1]!, plane: options.plane as string, track: typeof options.track === 'string' ? options.track : undefined};
      const request: KnowledgeScaffoldRequest = family === 'modeling'
        ? {...common, family, context: options.context as string, fields: typeof options.fields === 'string' ? options.fields.split(',') : [], states: typeof options.states === 'string' ? options.states.split(',') : []}
        : {...common, family, category: options.category as string, topic: options.topic as string};
      const receipt = await runtime.domain.scaffoldKnowledge(request);
      const message = [`${family} scaffold: ${receipt.kind} '${receipt.name}' appended to ${receipt.file}`,
        ...receipt.maintenanceWarnings?.map(warning => `Warning: ${warning}`) ?? []].join('\n');
      // Both historical scaffold commands ignored --json; retain that protocol.
      return {code: 0, domainOutput: receipt, domainJsonText: message + '\n', message};
    },
  };
}
