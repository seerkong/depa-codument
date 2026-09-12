export const FETCH_SCRIPT = `
(async () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), request.timeoutMs);
  try {
    const headers = { Accept: 'application/json', ...request.headers };
    const init = { method: request.method, credentials: 'include', headers, signal: ctrl.signal };
    if (request.hasBody) {
      if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
      init.body = request.body;
    }
    const response = await fetch(request.url, init);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      contentType: response.headers.get('content-type') || '',
      text: await response.text(),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: '',
      url: request.url,
      contentType: '',
      text: '',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
})()`;

function requestObject(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('--request JSON is required');
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('--request must be a JSON object');
  }
  return value;
}

function requestUrl(value) {
  if (typeof value !== 'string' || !value) throw new Error('--request.url is required');
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('--request.url must use http or https');
  }
  if (url.username || url.password) throw new Error('--request.url must not contain credentials');
  return url;
}

function requestHeaders(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('--request.headers must be an object');
  }
  return Object.fromEntries(Object.entries(value).map(([key, header]) => {
    if (!key || typeof header !== 'string') throw new Error('--request.headers values must be strings');
    return [key, header];
  }));
}

export function parseBrowserFetchRequest(raw) {
  const value = requestObject(raw);
  const url = requestUrl(value.url);
  const method = typeof value.method === 'string' && value.method ? value.method.toUpperCase() : 'GET';
  if (!/^[A-Z]+$/.test(method)) throw new Error('--request.method must contain only letters');
  if (value.body !== undefined && typeof value.body !== 'string') {
    throw new Error('--request.body must be a string');
  }
  const timeoutMs = value.timeoutMs === undefined ? 15_000 : value.timeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error('--request.timeoutMs must be an integer from 1 to 60000');
  }
  return {
    url: url.href,
    origin: url.origin,
    method,
    headers: requestHeaders(value.headers),
    body: value.body,
    hasBody: value.body !== undefined,
    timeoutMs,
  };
}

export async function executeBrowserFetch(page, raw) {
  const request = parseBrowserFetchRequest(raw);
  await page.goto(`${request.origin}/`);
  if (typeof page.evaluateWithArgs === 'function') {
    return page.evaluateWithArgs(FETCH_SCRIPT, { request });
  }
  return page.evaluate(`{\nconst request = ${JSON.stringify(request)};\n${FETCH_SCRIPT}\n}`);
}
