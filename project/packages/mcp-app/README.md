# depa-codument-mcp-app-capsule

Host-neutral contracts and runtime support for exposing installed AI CLI pages as MCP Apps. The package does not enumerate or control desktop Agent sessions.

Shared runtime/SOP/PageTarget contracts live in `depa-codument-skill-app-contract`; this capsule composes its catalog, UI and SDK server. `serveMcpApp(runtime, { transport, log? })` requires an explicit transport and never selects stdio or console output. Connection failure releases the server; successful callers own `server.close()`. The supplied runtime ports and target registry remain caller-owned. CLI-specific transport selection is outside this package.
