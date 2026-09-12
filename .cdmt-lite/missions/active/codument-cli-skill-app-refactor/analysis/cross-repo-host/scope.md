# Scope and authority

- Target A: /Users/kongweixian/infra-dev/depa-codument/project — current extracted package tree and product composition.
- Target B: /Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite — proposed canonical source of reusable public packages and its own consuming CLI.
- Reference only: original resource-first demo and halfcode-cli-lite-apps; no changes to examples.
- Scope: all package manifests and public package boundaries in both target repositories; representative runtime, extension, Kind, clone and distribution paths that establish boundary claims. This is not an exhaustive function-level audit.
- Desired ownership: reusable implementation and public unscoped halfcode-cli-lite-* packages in Halfcode; Codument-owned domain and meaningful consumer adapters/capsules remain depa-codument-*; third-party CLI consumes versioned public APIs, not either repository's private source.
- Preserve: codument/ formal workspace root, builtin Kind definitions, mixed resource/code authoring, CLI-first execution, migration plus semantic fallback, accuracy mechanisms; init/status/upgrade-workspace merge remains frozen.
- This phase writes only Mission Lite analysis/planning documents. No upstream/source edits, package moves, installs into user workspaces, global changes, npm publication or release ownership claims.
- External facts not yet verified: npm names/ownership availability and cross-platform native runtime support. Planned gates must not be described as achieved.
- Analysis manifest owns analysis progress; ../../loop.md owns execution graph. Historical analysis/evidence remains dated; this snapshot supersedes incompatible future design assumptions only.
