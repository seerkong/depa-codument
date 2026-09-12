# Independent HTTP acceptance interface

Implement the original requirement fully, including a working browser UI. This document fixes only the boundary used by external tests; do not implement a separate test-only application.

- `e2e-server.json`: `{ "command": ["bun", "run", "start"] }` (or another executable argv array). The command starts the actual application, binds `127.0.0.1`, reads `PORT`, and uses an initially empty per-run data store. It must remain running until terminated.
- `GET /health` → 200; `GET /` → functional HTML UI using the real API.
- All bodies and API responses are JSON; errors are non-2xx. Entity responses are unwrapped objects; lists are arrays. IDs are strings. Authorization is `Bearer <token>`.
- `POST /api/register {email,password}` → 201 `{id,token}`; duplicate email → 409.
- `POST /api/login {email,password}` → 200 `{token}`; invalid credentials → 401.
- `POST /api/tasks {title,status?,dueDate?,tags?}` → 201 task `{id,title,status,dueDate,tags}`; default status `todo`.
- `GET /api/tasks` → only the authenticated user's tasks. Optional `status`, `tag`, `dueBefore` filters combine; dueBefore is inclusive ISO date comparison.
- `GET /api/tasks/:id` → task; another user's task → 403 or 404.
- `PATCH /api/tasks/:id {title?,status?,dueDate?,tags?}` → updated task. Status allowed only `todo|doing|done`; invalid → 400.
- `DELETE /api/tasks/:id` → 200 or 204; deleted task → 404.
- Missing authentication → 401. No cross-user reads or mutations. Do not return password hashes or plaintext passwords.

Provide package scripts `test`, `typecheck`, and `build` that really check the application. Express the original required Modeling planes and Engineering knowledge in the Track. Do not replace gap-loop, hooks or independent verification with this HTTP interface.
