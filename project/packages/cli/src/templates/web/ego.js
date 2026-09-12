const output = document.querySelector('#output');
const openButton = document.querySelector('#open-session');
const findButton = document.querySelector('#find-records');
const urlInput = document.querySelector('#target-url');
let sessionId = '';

function resolveUrl(value) {
  try {
    return new URL(value, location.origin).href;
  } catch {
    return value;
  }
}

async function post(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  output.textContent = JSON.stringify(payload, null, 2);
  if (!response.ok) throw new Error(payload.message || response.statusText);
  return payload;
}

openButton.addEventListener('click', async () => {
  openButton.disabled = true;
  try {
    const payload = await post('/api/ego/session', { url: resolveUrl(urlInput.value) });
    sessionId = String(payload.sessionId ?? '');
    findButton.disabled = !sessionId;
  } catch (error) {
    output.textContent = String(error);
  } finally {
    openButton.disabled = false;
  }
});

findButton.addEventListener('click', async () => {
  if (!sessionId) return;
  findButton.disabled = true;
  try {
    await post('/api/ego/call', {
      sessionId,
      operation: 'findRecords',
      arguments: { status: 'pending' },
    });
  } catch (error) {
    output.textContent = String(error);
  } finally {
    findButton.disabled = false;
  }
});

