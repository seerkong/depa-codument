const output = document.querySelector('#output');
const product = document.querySelector('#product');

async function readJson(response) {
  const payload = await response.json();
  output.textContent = JSON.stringify(payload, null, 2);
}

async function loadHealth() {
  const payload = await (await fetch('/api/health')).json();
  if (payload.name) product.textContent = payload.name;
  if (payload.bin && payload.version) {
    document.title = `${payload.name} ${payload.version}`;
  }
}

document.querySelector('#demo-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = new FormData(event.target).get('name');
  await readJson(await fetch(`/api/demo?name=${encodeURIComponent(String(name ?? ''))}`));
});

document.querySelector('#status-button').addEventListener('click', async () => {
  await readJson(await fetch('/api/status'));
});

loadHealth().catch((error) => {
  output.textContent = String(error);
});

