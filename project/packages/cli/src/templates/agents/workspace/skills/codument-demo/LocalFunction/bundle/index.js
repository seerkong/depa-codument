const api = globalThis.Codument;
if (!api) throw new Error('Host resource definition API is unavailable');

export const resourceDefinitions = [
  api.defineLocalFunction({
    fqn: 'Codument.Demo.Action.Greet',
    description: '返回适合在 Skill App 页面展示的问候语',
    operation: 'action',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { name: { type: 'string', minLength: 1 } },
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['message'],
      properties: { message: { type: 'string' } },
    },
    configSchema: { type: 'null' },
    runtimeCapabilities: [],
    handler: (_runtime, input) => ({
      message: `Hello, ${typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : 'AI builder'}!`,
    }),
  }),
];
