# Codument product capsule

Owns product identity, the `codument/` domain repository and per-invocation admission/drain. Resource composition injects built-in Codument registrations into the public resource host without copying Kind definitions.

The separate `workspace-app` entry constructs the formal membership blueprint and complete product inspector. `workspace-install` composes a guarded initial installer with bundled text assets; ordinary query runtimes do not load those assets.

```ts
import { createCodumentWorkspaceInstaller } from 'depa-codument-product-capsule/workspace-install';
await createCodumentWorkspaceInstaller('/absolute/real/workspace').install({ agents: ['claude', 'codex'] });
```

The existing workspace root must be a real directory. The App is always `codument/`; Agent destinations only contain thin routes. Default Agent is Claude. Six Agent targets and workspace-local custom `skillsDirectory` are supported; saved targets, business resources, configuration and unmanaged instruction text are preserved. Conflicting Skills, changed App identity/targets and legacy Apps require reviewed migration, not an overwrite.

Preparation validates an isolated App before publication. Cooperative locks and identity/content guards detect drift; they are not an OS-wide compare-and-swap guarantee. Failures restore only unchanged transaction-owned writes and retain independently edited content with explicit recovery paths. This workspace installer does not perform global installation or upgrade an existing App.

`/commands` exposes `createCodumentProductCommands(bindings)`: this package selects public Resource/SOP, LocalFunction, Browser, Page, Serve, MCP and Management factories and adds Codument domain commands plus global CommandOperations. The executable supplies required typed runtime bindings and installation handlers, not another feature-selection table. Invocation owners retain cleanup responsibility; command composition neither acquires nor closes borrowed resources. Workspace migration policy and `serve-client-preflight` remain Codument-owned.
