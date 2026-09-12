# Independent HTTP acceptance interface

Deliver the original product including actual asynchronous message processing and storefront UI. Use integer cents for amounts; no external real payment service is needed (explicit local payment simulator).

`e2e-server.json` declares the real app command argv, reads PORT, binds 127.0.0.1. GET /health→200; GET /→real HTML. JSON objects unwrapped and collections arrays. Auth Bearer token; IDs strings. Business errors non-2xx. Demo SKU/coupon provisioning below is local test/admin setup; document production security.

- POST /api/register {email,password} → 201 {id,token}.
- POST /api/skus {name,priceCents,stock} → 201 {id,name,priceCents,stock,reserved:0}.
- GET /api/skus/:id → current {stock,reserved,...}; stock is on-hand, reserved is outstanding reservations, available=stock-reserved.
- POST /api/coupons {code,discountCents} → 201 coupon.
- POST /api/cart/items {skuId,quantity} with token → 200; GET /api/cart → {items:[{skuId,quantity}]} owned by user.
- POST /api/orders {couponCode?,idempotencyKey} with token → 201 {id,totalCents,status:"pending"}; atomically reserve current cart and clear it. Repeat same idempotencyKey returns same order, no second stock reservation. Insufficient available stock→409.
- POST /api/orders/:id/pay {paymentId} with owner token → 200; durable asynchronous message processing eventually sets status paid, decrements on-hand stock and releases reservation. Duplicate paymentId must not double-deduct. Failures must be recoverable; explain and test.
- POST /api/orders/:id/cancel with owner token → 200; pending order cancellation releases reservation, no stock deduction. Cannot cancel paid order (409).
- GET /api/orders/:id with owner token → current order; foreign user forbidden 403/404.

Provide genuine test/typecheck/build scripts and Model/Engineering knowledge. Do not replace asynchronous business effects with synchronous test-only success.
