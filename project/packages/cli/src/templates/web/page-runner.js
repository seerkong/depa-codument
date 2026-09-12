function json(response) {
  return response.json().then((body) => {
    if (!response.ok || body.ok === false) {
      const error = new Error(body.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = body;
      throw error;
    }
    return body;
  });
}

export function connectPage(pageName, handlers = {}) {
  const normalizedPageName = (value) => {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError('Page name is required');
    return value.trim();
  };
  let registeredPageName = normalizedPageName(pageName);
  let targetRef = '';
  let readyResolve;
  let ready = new Promise((resolve) => { readyResolve = resolve; });
  let opened = false;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/ws/pages`);
  const sendRegistration = () => socket.send(JSON.stringify({
    type: 'page.register', pageName: registeredPageName,
  }));
  socket.addEventListener('open', () => {
    opened = true;
    sendRegistration();
  });
  socket.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'page.registered') {
      if (message.pageName !== registeredPageName) return;
      targetRef = message.targetRef;
      readyResolve(targetRef);
      handlers.registered?.(targetRef);
      return;
    }
    if (message.type !== 'page.request') return;
    const handler = handlers[message.method];
    try {
      if (typeof handler !== 'function') throw new Error(`Unsupported page method: ${message.method}`);
      const result = await handler(message.params ?? {});
      socket.send(JSON.stringify({ type: 'page.response', requestId: message.requestId, ok: true, result }));
    } catch (error) {
      socket.send(JSON.stringify({ type: 'page.response', requestId: message.requestId, ok: false, error: String(error?.message ?? error) }));
    }
  });
  return {
    get ready() { return ready; },
    get targetRef() { return targetRef; },
    register(nextPageName) {
      const next = normalizedPageName(nextPageName);
      if (next === registeredPageName && targetRef) return ready;
      registeredPageName = next;
      targetRef = '';
      ready = new Promise((resolve) => { readyResolve = resolve; });
      if (opened) sendRegistration();
      return ready;
    },
    close() { socket.close(); },
  };
}

export async function listAgentTargets() {
  return json(await fetch('/api/agent/targets'));
}

export async function bindAgent(targetId, scopeId = '') {
  return json(await fetch('/api/agent/bind', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetId, scopeId }),
  }));
}

export async function invokeLocalFunction(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new TypeError('Local Function request must be an object');
  const { fqn, input = {}, config = null } = request;
  if (typeof fqn !== 'string' || !fqn.trim()) throw new TypeError('Local Function fqn is required');
  const pageName = document.documentElement.dataset.pageName
    || /^\/page-content\/([a-z0-9][a-z0-9-]*)(?:\/|$)/.exec(location.pathname)?.[1]
    || /^\/pages\/([a-z0-9][a-z0-9-]*)(?:\/|$)/.exec(location.pathname)?.[1];
  if (!pageName) throw new Error('Page name is not available to the Page Runner');
  const envelope = await json(await fetch(`/api/pages/${encodeURIComponent(pageName)}/local-functions/invoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fqn, input, config }),
  }));
  return envelope.result;
}

export async function sendAgentTask(task) {
  try {
    return await json(await fetch('/api/agent/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(task),
    }));
  } catch (error) {
    if (error?.payload?.bindingRequired === true && window.parent !== window) {
      window.parent.postMessage({ type: 'codument.session-required' }, location.origin);
    }
    throw error;
  }
}
