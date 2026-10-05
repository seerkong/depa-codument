import type { CommandDefinition } from 'halfcode-lite-cli-contract';
import { createArgvSchema } from 'halfcode-lite-cli-logic';
import type { CodumentDomainCommandRuntime } from './index';
import { CODUMENT_DOMAIN_EXECUTION } from './execution';
import type { WorkspaceBindingCommand } from 'depa-codument-domain-contract';

export function createProjectCommands<R extends CodumentDomainCommandRuntime>(): CommandDefinition<R> {
  const usages = { bind: 'codument project bind <project-ref> <workspace-path>', bindings: 'codument project bindings', unbind: 'codument project unbind <project-ref>' };
  return { name: 'project', summary: 'Manage local ProjectRef bindings.', usage: ['codument project <command>'], examples: [],
    children: (['bind', 'bindings', 'unbind'] as const).map((operation): CommandDefinition<R> => {
      const usage = usages[operation];
      return { name: operation, summary: usage, usage: [usage], examples: [],
        doc: { summary: usage, usage: [usage], examples: [], options: ['--json'] },
        schema: createArgvSchema<R>(usage, [usage], [{ name: 'json', kind: 'boolean' }]),
        execution: CODUMENT_DOMAIN_EXECUTION.registry,
        async run({ runtime, positional }) {
          const count = { bind: 2, bindings: 0, unbind: 1 }[operation];
          if (positional.length !== count) throw new Error(`Usage: ${usage}`);
          if (!runtime.domain) throw new Error('Codument domain runtime is not configured.');
          const [projectRef, workspacePath] = positional;
          let command: WorkspaceBindingCommand;
          if (operation === 'bindings') command = { operation };
          else if (operation === 'bind') command = { operation, projectRef, workspacePath };
          else command = { operation, projectRef };
          const result = await runtime.domain.project(command);
          let message: string;
          if (operation === 'bindings') message = result.bindings.map(binding => `${binding.projectRef}\t${binding.workspacePath}`).join('\n');
          else if (operation === 'bind') message = `ProjectRef '${projectRef}' bound locally to ${result.binding!.workspacePath}`;
          else message = `ProjectRef '${projectRef}' unbound locally`;
          if (result.maintenanceWarnings?.length) message += '\n' + result.maintenanceWarnings.map(warning => `Warning: ${warning}`).join('\n');
          return { code: 0, domainOutput: operation === 'bindings' ? result.bindings : result, message };
        },
      };
    }),
  };
}
