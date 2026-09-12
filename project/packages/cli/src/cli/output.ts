import type { CommandResult } from 'halfcode-cli-lite-cli-host-contract';
import { formatCommandResult } from 'halfcode-cli-lite-cli-host-logic';
import { streamOutput } from 'halfcode-cli-lite-cli-host-support';
export { buildOutputPayload, renderFrontmatter } from 'halfcode-cli-lite-cli-host-logic';

export interface RenderOptions { json?: boolean; }

/** Legacy product adapter: process mutation remains at this executable boundary. */
export function renderCommandResult(result: CommandResult, options: RenderOptions = {}): void {
  streamOutput(process.stdout).write(formatCommandResult(result, options.json));
  if (result.code !== 0) process.exitCode = result.code;
}
