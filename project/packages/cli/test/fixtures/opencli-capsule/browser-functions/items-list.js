export default async function itemsList(input) {
  const query = new URLSearchParams(input ?? {}).toString();
  const response = await client_fetch(`https://example.test/api/items${query ? `?${query}` : ''}`, { method: 'GET' });
  if (!response.ok) throw new Error(`Example API failed: HTTP ${response.status}`);
  return response.json();
}
