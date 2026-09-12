const api = globalThis.Codument;
if (!api) throw new Error('Host resource definition API is unavailable');

export const publicEchoGet = api.defineBrowserWebApi({
  fqn: 'Codument.Demo.BrowserWebApi.PublicEcho.Get',
  description: 'Fetch a public echo receipt through the workspace-selected browser provider.',
  endpointKey: 'public-echo',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  async handler(runtime, _input, config) {
    if (config !== null) throw new Error('BrowserWebApi config is Host-fixed to null');
    return runtime.effects.browserWebApi.fetch({ path: '/get' });
  },
});

export const resourceDefinitions = [publicEchoGet];
