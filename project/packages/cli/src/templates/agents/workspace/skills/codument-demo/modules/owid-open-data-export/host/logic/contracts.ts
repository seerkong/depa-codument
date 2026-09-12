export const owidInputSchema = {
  type: 'object', additionalProperties: false, required: ['chartSlug', 'entityCodes', 'startYear', 'endYear', 'downloadScope'],
  properties: {
    chartSlug: { const: 'life-expectancy' },
    entityCodes: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string', pattern: '^[A-Z]{3}$' } },
    startYear: { type: 'integer', minimum: 1543, maximum: 2023 },
    endYear: { type: 'integer', minimum: 1543, maximum: 2023 },
    downloadScope: { enum: ['displayed', 'full'] },
  },
};

export const owidOutputSchema = {
  type: 'object', additionalProperties: false, required: ['code', 'message', 'meta'],
  properties: {
    code: { type: 'integer' }, message: { type: 'string' }, data: { type: 'object' }, meta: { type: 'object' },
    error: { type: 'object', additionalProperties: false, required: ['kind', 'detail'], properties: {
      kind: { enum: ['input-validation', 'page-structure', 'page-interaction', 'business-response', 'download', 'decode'] },
      detail: { type: 'string' },
    } },
  },
};

export function pageRuntime(runtime) {
  const page = runtime.page;
  if (!page || typeof page !== 'object') throw new Error('page capability is unavailable');
  return page;
}
