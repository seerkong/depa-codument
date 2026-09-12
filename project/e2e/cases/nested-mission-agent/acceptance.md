# Current product routing and independent acceptance

Keep the original business and Mission requirements in request.md. Its legacy execution paragraph names old .eidolon skills and the codument binary; for this new-version run those names must route through the single installed depa-codument Skill and dynamic plan-mission/impl-mission/impl-track operations. Use depa-codument project bind. Do not install old skills or call old binaries.

The runner creates main-repo and inventory-repo under this workspace and initializes both. The root Mission completes the selected delivery; the autonomous inventory child retains a real outstanding task and remains active. Parent/child links are reciprocal, selected-tasks references leaf tasks, and cross-layer TrackLink declares all refs. Only the local ignored binding file stores absolute project paths.

Each repository supplies actual runnable code, real `test`, `typecheck`, `build` scripts and `e2e-server.json` command argv. Servers read PORT and bind 127.0.0.1. The main server receives INVENTORY_URL pointing to the inventory server. This seam may be an HTTP adapter over the actual domain implementation; no second fake state machine.

Inventory API (JSON): POST /stock {sku,quantity} →201; GET /stock/:sku →200 {quantity,reserved}. POST /reservations {id,sku,quantity} →201, insufficient→409; DELETE /reservations/:id releases stock, idempotently 200/204. POST /reservations/:id/commit →200, idempotently deducts quantity once and removes outstanding reserved amount.

Main API: POST /orders {id,items:[{sku,quantity,priceCents}]} →201 {id,totalCents,status:"pending"}, insufficient stock→409 without partial reservations. POST /orders/:id/pay →200 {status:"paid"}, duplicate payment must not double-deduct. POST /orders/:id/cancel →200, releases pending reservation; paid cancellation→409. GET /orders/:id →200 current order. Both servers GET /health→200.

Tests use randomized IDs/amounts and observe both repositories' live state. Do not fake receipt files or mark child backlog completed to force parent success.
