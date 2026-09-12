import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';

export async function statusCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length || Object.keys(context.options).length) throw new Error(`Usage: ${BIN} status`);
  const workspace = context.runtime.workspace();
  if (!await workspace.exists('codument')) return { code: 1, data: { command: 'status', initialized: false },
    message: `Codument is not initialized. Run ${BIN} init first.` };
  if (!context.runtime.domain) throw new Error('Codument status requires the local domain query runtime.');
  const result = await context.runtime.domain.query({ operation: 'status' });
  if (result.kind !== 'status') throw new Error('Unexpected Codument status projection.');
  const product = result.value, { tracks, tasks, progress } = product.statistics;
  return { code: 0, data: { command: 'status', initialized: true, workspace: 'codument', product },
    message: [ 'Codument Project Status', `Status: ${product.status}`, '', 'Tracks Overview',
      ...product.tracks.map(track => `${track.metadata.status}  ${track.id}  ${track.taskSummary?.completed ?? 0}/${track.taskSummary?.total_tasks ?? 0}`),
      '', 'Current Progress', product.current ? `Current Track: ${product.current.track}` : 'No track in progress.',
      ...(product.current?.phase ? [`Current Phase: ${product.current.phase}`] : []),
      ...(product.current?.task ? [`Current Task: ${product.current.task}`] : []),
      ...(product.current?.nextTask ? [`Next: ${product.current.nextTask}`] : []),
      '', 'Statistics', `Tracks: ${tracks.total} total | ${tracks.inProgress} in progress | ${tracks.new} new | ${tracks.completed} completed`,
      `Tasks: ${tasks.total} total | ${tasks.completed} done | ${tasks.inProgress} in progress | ${tasks.todo} todo | ${tasks.blocked} blocked`,
      `Progress: ${progress}%`,
    ].join('\n') };
}
