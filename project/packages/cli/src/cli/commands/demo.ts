import type { CommandContext, CommandResult } from '../contracts/command';

export function demoCommand(context: CommandContext): CommandResult {
  const name = context.positional[0] ?? 'world';
  if (context.positional.length > 1) {
    return {
      code: 1,
      data: { command: 'demo' },
      message: 'Usage: demo accepts at most one name.',
    };
  }
  return {
    code: 0,
    data: { command: 'demo', name },
    message: `Demo, ${name}.`,
  };
}

