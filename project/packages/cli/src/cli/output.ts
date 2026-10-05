import type { CommandResult } from 'halfcode-lite-cli-contract';
import { formatCommandResult } from 'halfcode-lite-cli-logic';
import { streamOutput } from 'halfcode-lite-cli-support';
export { buildOutputPayload, renderFrontmatter } from 'halfcode-lite-cli-logic';

export interface RenderOptions { json?: boolean; }

/** Legacy product adapter: process mutation remains at this executable boundary. */
export function renderCommandResult(result: CommandResult, options: RenderOptions = {}): void {
  streamOutput(process.stdout).write(formatCommandResult(result, options.json));
  if (result.code !== 0) process.exitCode = result.code;
}
