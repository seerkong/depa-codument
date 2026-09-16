import { BIN } from '../../identity';
import type { CommandContext, CommandResult } from '../contracts/command';
import { localResourceDetailPath } from 'halfcode-cli-lite-skill-app-support/resources/confined-resource-file';

export async function pageListCommand(context: CommandContext): Promise<CommandResult> {
  if (context.positional.length > 0) {
    return { code: 1, data: { command: 'Page.list', pages: [] }, message: `Usage: ${BIN} Page list` };
  }
  try {
    const catalog = context.runtime.page?.pages;
    if (!catalog) throw new Error('Page resource catalog is not configured');
    const catalogSnapshot = await context.runtime.resourceCatalog?.snapshot();
    const resourcesByFqn = new Map((catalogSnapshot?.resources ?? []).map((resource) => [resource.fqn, resource]));
    const pages = await Promise.all((await catalog.list()).map(async (page): Promise<typeof page & { readonly detailPath?: string }> => {
      if (!page.fqn) return page;
      const source = resourcesByFqn.get(page.fqn);
      if (!source) return page;
      const { detailPath } = await localResourceDetailPath(source);
      return Object.freeze({ ...page, detailPath });
    }));
    return {
      code: 0,
      data: { command: 'Page.list', count: pages.length, pages },
      message: pages.length
        ? pages.map((page) => `${page.name}\t${page.description}\t${page.detailPath ?? page.relativePath}\t${page.entryUrl}`).join('\n')
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
