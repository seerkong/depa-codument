import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

type Response = { status: number; data: any };
export type Request = (method: string, path: string, body?: unknown, token?: string) => Promise<Response>;
const password = 'E2e-Secure-Password-719!';
async function user(request: Request, role?: string) {
  const response = await request('POST', '/api/register', { email: `${randomUUID()}@example.test`, password, ...(role ? { role } : {}) });
  assert.equal(response.status, 201); assert.ok(response.data.token);
  return response.data.token as string;
}
export async function verifyBlog(request: Request): Promise<string[]> {
  const author = await user(request, 'author'), stranger = await user(request, 'author'), editor = await user(request, 'editor');
  const title = randomUUID(), tag = randomUUID();
  const created = await request('POST', '/api/posts', { title, body: 'Original body ' + title, tags: [tag], category: 'tech' }, author);
  assert.equal(created.status, 201); assert.equal(created.data.status, 'draft');
  const id = created.data.id;
  assert.equal((await request('GET', `/api/public/posts/${id}`)).status, 404);
  assert.equal((await request('POST', `/api/posts/${id}/publish`, {}, author)).status, 403);
  assert.ok([403,404].includes((await request('PATCH', `/api/posts/${id}`, { title: 'stolen' }, stranger)).status));
  const updated = await request('PATCH', `/api/posts/${id}`, { body: 'Updated ' + title }, author);
  assert.equal(updated.status, 200);
  const published = await request('POST', `/api/posts/${id}/publish`, {}, editor);
  assert.equal(published.status, 200); assert.equal(published.data.status, 'published');
  assert.equal((await request('GET', `/api/public/posts/${id}`)).data.body, 'Updated ' + title);
  const filtered = await request('GET', `/api/public/posts?tag=${tag}&category=tech`);
  assert.equal(filtered.status, 200); assert.equal(filtered.data.length, 1); assert.equal(filtered.data[0].id, id);
  const comment = await request('POST', `/api/posts/${id}/comments`, { body: 'Comment ' + tag }, stranger);
  assert.equal(comment.status, 201); assert.equal(comment.data.status, 'pending');
  assert.deepEqual((await request('GET', `/api/public/posts/${id}/comments`)).data, []);
  assert.equal((await request('POST', `/api/comments/${comment.data.id}/approve`, {}, author)).status, 403);
  assert.equal((await request('POST', `/api/comments/${comment.data.id}/approve`, {}, editor)).status, 200);
  const comments = await request('GET', `/api/public/posts/${id}/comments`);
  assert.equal(comments.data.length, 1); assert.equal(comments.data[0].body, 'Comment ' + tag);
  assert.equal((await request('POST', `/api/posts/${id}/unpublish`, {}, editor)).status, 200);
  assert.equal((await request('GET', `/api/public/posts/${id}`)).status, 404);
  return ['draft/publish/offline visibility', 'author/editor/ownership boundary', 'tag/category projection', 'comment moderation'];
}
export async function verifyEcommerce(request: Request): Promise<string[]> {
  const buyer = await user(request), other = await user(request);
  const cents = 100 + Math.floor(Math.random() * 10000);
  const sku = await request('POST', '/api/skus', { name: randomUUID(), priceCents: cents, stock: 5 });
  assert.equal(sku.status, 201); const skuId = sku.data.id;
  const coupon = randomUUID();
  assert.equal((await request('POST', '/api/coupons', { code: coupon, discountCents: 25 })).status, 201);
  assert.equal((await request('POST', '/api/cart/items', { skuId, quantity: 2 }, buyer)).status, 200);
  assert.equal((await request('GET', '/api/cart', undefined, buyer)).data.items[0].quantity, 2);
  assert.deepEqual((await request('GET', '/api/cart', undefined, other)).data.items, []);
  const idempotencyKey = randomUUID();
  const order = await request('POST', '/api/orders', { couponCode: coupon, idempotencyKey }, buyer);
  assert.equal(order.status, 201); assert.equal(order.data.totalCents, cents * 2 - 25);
  assert.equal(order.data.status, 'pending'); const id = order.data.id;
  assert.equal((await request('GET', `/api/skus/${skuId}`)).data.reserved, 2);
  assert.equal((await request('POST', '/api/orders', { couponCode: coupon, idempotencyKey }, buyer)).data.id, id);
  assert.equal((await request('GET', `/api/skus/${skuId}`)).data.reserved, 2);
  assert.ok([403,404].includes((await request('GET', `/api/orders/${id}`, undefined, other)).status));
  assert.equal((await request('POST', '/api/cart/items', { skuId, quantity: 4 }, other)).status, 200);
  assert.equal((await request('POST', '/api/orders', { idempotencyKey: randomUUID() }, other)).status, 409);
  const paymentId = randomUUID();
  assert.equal((await request('POST', `/api/orders/${id}/pay`, { paymentId }, buyer)).status, 200);
  for (let i = 0; i < 50; i++) {
    if ((await request('GET', `/api/orders/${id}`, undefined, buyer)).data.status === 'paid') break;
    await Bun.sleep(100);
  }
  assert.equal((await request('GET', `/api/orders/${id}`, undefined, buyer)).data.status, 'paid');
  assert.equal((await request('POST', `/api/orders/${id}/pay`, { paymentId }, buyer)).status, 200);
  await Bun.sleep(200);
  const after = (await request('GET', `/api/skus/${skuId}`)).data;
  assert.equal(after.stock, 3); assert.equal(after.reserved, 0);
  assert.equal((await request('POST', `/api/orders/${id}/cancel`, {}, buyer)).status, 409);
  assert.equal((await request('POST', '/api/cart/items', { skuId, quantity: 1 }, buyer)).status, 200);
  const cancel = await request('POST', '/api/orders', { idempotencyKey: randomUUID() }, buyer);
  assert.equal(cancel.status, 201);
  assert.equal((await request('POST', `/api/orders/${cancel.data.id}/cancel`, {}, buyer)).status, 200);
  const restored = (await request('GET', `/api/skus/${skuId}`)).data;
  assert.equal(restored.stock, 3); assert.equal(restored.reserved, 0);
  return ['cart ownership', 'integer money and coupon', 'stock reservation/insufficient stock/cancel recovery', 'async payment result and idempotence'];
}
