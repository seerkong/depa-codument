# Independent HTTP acceptance interface

Deliver the complete original product (real REST API, reader UI and editor workbench), not an oracle-only adapter.

`e2e-server.json` declares `{ "command": ["bun", "run", "start"] }` or equivalent argv; server uses PORT on 127.0.0.1. GET /health is 200, GET / is real HTML. JSON objects are unwrapped, collections arrays, IDs strings, errors non-2xx. Auth uses Bearer token.

- POST /api/register {email,password,role:"author"|"editor"} → 201 {id,token}; self-selected roles are acceptable only for this local demonstration, document production provisioning.
- POST /api/posts {title,body,tags:[string],category:string} as author → 201 {id,title,body,tags,category,status:"draft"}.
- PATCH /api/posts/:id {title?,body?,tags?,category?} as owner → 200 updated post. Other authors cannot mutate.
- POST /api/posts/:id/publish as editor → 200 status published. Authors cannot publish (403).
- POST /api/posts/:id/unpublish as editor → 200 status offline.
- GET /api/public/posts → published posts only; optional tag/category filters. GET /api/public/posts/:id → published post or 404. No private drafts leak.
- POST /api/posts/:id/comments {body} as logged-in user → 201 {id,body,status:"pending"}.
- POST /api/comments/:id/approve as editor → 200 status approved; author denied 403.
- GET /api/public/posts/:id/comments → approved comments only.

Provide working test/typecheck/build scripts; preserve Modeling/Engineering and product checks. Original requirements remain the goal; this is a stable external interface, not the entire acceptance scope.
