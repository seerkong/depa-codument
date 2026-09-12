import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';

export async function pageListCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0) {
    return { code: 1, data: { command: 'Page.list', pages: [] }, message: `Usage: ${BIN} Page list` };
  }
  try {
    const catalog = context.runtime.page?.pages;
    if (!catalog) throw new Error('Page resource catalog is not configured');
    const pages = await catalog.list();
    return {
      code: 0,
      data: { command: 'Page.list', count: pages.length, pages },
      message: pages.length
        ? pages.map((page) => `${page.name}\t${page.description}\t${page.relativePath}\t${page.entryUrl}`).join('\n')
        : 'No pages found.',
    };
  } catch (error) {
    return {
      code: 1,
      data: { command: 'Page.list', count: 0, pages: [] },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
