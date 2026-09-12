import { CliError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { executeBrowserFetch } from './request.js';

cli({
  site: 'codument-opencli',
  name: 'browser-fetch',
  access: 'read',
  description: 'Execute one authenticated HTTP(S) fetch inside the user browser',
  example: 'npx -y @jackwener/opencli codument-opencli browser-fetch --request \'{"url":"https://example.com/api/items","method":"GET"}\' -f json',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  siteSession: 'persistent',
  defaultWindowMode: 'foreground',
  defaultFormat: 'json',
  args: [
    { name: 'request', required: true, help: 'JSON envelope: { url, method, headers, body, timeoutMs }' },
  ],
  columns: ['ok', 'status', 'statusText', 'url', 'contentType', 'error'],
  func: async (page, kwargs) => {
    try {
      return [await executeBrowserFetch(page, String(kwargs.request ?? ''))];
    } catch (error) {
      throw new CliError('INVALID_ARGUMENT', error instanceof Error ? error.message : String(error));
    }
  },
});
