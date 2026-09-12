export const emptyObjectSchema = { type: 'object', additionalProperties: false };
export const googleInputSchema = {
  type: 'object', additionalProperties: false,
  required: ['query'],
  properties: { query: { type: 'string', minLength: 1, maxLength: 200 } },
};
export const googleOutputSchema = {
  type: 'object', additionalProperties: false, required: ['query', 'results', 'count'],
  properties: { query: { type: 'string' }, results: { type: 'array' }, count: { type: 'integer', minimum: 0 } },
};

export function pageRuntime(runtime) {
  const page = runtime.page;
  if (!page || typeof page !== 'object') throw new Error('page capability is unavailable');
  return page;
}
