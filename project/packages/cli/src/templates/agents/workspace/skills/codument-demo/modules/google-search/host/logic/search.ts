function inputRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('input must be an object');
  return input;
}

export function queryValue(input) {
  const query = String(inputRecord(input).query ?? '').trim();
  if (!query) throw new Error('query is required');
  if (query.length > 200) throw new Error('query must not exceed 200 characters');
  return query;
}

function unwrap(response) {
  return response?.result?.value ?? response;
}

export const submitExpression = (query) => `(() => {
  const input = document.querySelector('textarea[name="q"], input[name="q"]');
  if (!input) return { ok: false, error: 'Google search input not found' };
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  if (setter) setter.call(input, ${JSON.stringify(query)}); else input.value = ${JSON.stringify(query)};
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const form = input.closest('form');
  if (!form) return { ok: false, error: 'Google search form not found' };
  if (typeof form.requestSubmit === 'function') form.requestSubmit(); else form.submit();
  return { ok: true };
})()`;

export const extractExpression = `(() => {
  const root = document.querySelector('#search');
  if (!root) return { ok: false, error: 'Google results root not found' };
  const results = [];
  for (const heading of root.querySelectorAll('a h3')) {
    const anchor = heading.closest('a');
    const url = anchor?.href || '';
    const title = (heading.textContent || '').trim();
    if (!title || !/^https?:\/\//.test(url)) continue;
    const block = anchor.closest('[data-snhf], [data-hveid], .MjjYud') || anchor.parentElement;
    const snippetNode = block?.querySelector('[data-sncf], .VwiC3b, [style*="-webkit-line-clamp"]');
    const displayNode = block?.querySelector('cite');
    results.push({
      rank: results.length + 1,
      title,
      url,
      displayUrl: (displayNode?.textContent || '').trim(),
      snippet: (snippetNode?.textContent || '').trim()
    });
  }
  if (!results.length) return { ok: false, error: 'Google result DOM changed or contains no natural results' };
  return { ok: true, results };
})()`;

export const GoogleSearchPage = {
  async extract(session) {
    const extracted = unwrap(await session.send('Runtime.evaluate', { expression: extractExpression, returnByValue: true }));
    if (!extracted?.ok) throw new Error(extracted?.error || 'Unable to extract Google results');
    return { results: extracted.results, count: extracted.results.length };
  },
};

export const GoogleSearchWorkflow = {
  async search(session, input) {
    const query = queryValue(input);
    const submitted = unwrap(await session.send('Runtime.evaluate', {
      expression: submitExpression(query),
      awaitPromise: true,
      returnByValue: true,
    }));
    if (!submitted?.ok) throw new Error(submitted?.error || 'Unable to submit Google search');
    let lastError = 'Google results did not become ready';
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : 500));
      try {
        const extracted = await GoogleSearchPage.extract(session);
        return { query, ...extracted };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(lastError);
  },
};

export const DemoPage = {
  async setResult(session, input) {
    return session.send('Page.setResult', inputRecord(input));
  },
};
