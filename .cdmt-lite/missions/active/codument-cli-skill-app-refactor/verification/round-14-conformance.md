# Round 14: concrete runtime facets and public adoption gate

Execution state remains in ../loop.md. No product adoption is implied by the public gate.

## Applied delta and evidence

- T06/T07/T12: explicit capability context/effects, single captured profile, allowlisted configuration/database claims, invocation-only SQLite, partial rollback and validation/handler/output cleanup. Clock/IDs are borrowed ports, not hidden globals. Catalog descriptor and request execution share admission/drain. Support reexports the single pure configuration implementation.
- T12 Page/Site catalog projection requires neither a builder nor a Page/workflow/browser/Agent owner. Optional build observations are borrowed; entryUrl is a projection, not a health assertion. Existing code-first descriptor materialization keeps its declared trust/effect boundary.
- T09 concrete one-shot factory and software-owned lifetime are selected together. The same public CLI leaf executes Ego, OpenCLI plugin, OpenCLI browser-eval and MDD chrome-extension through their actual implementations with subprocess IO doubles. Unknown combinations/lifetime overrides reject.
- Packed live composition now includes an actual controlled Codex protocol child process, reaped before providers close. Two instances have independent PIDs, resources and Page owners. No actual Codex message or browser session is used.
- Full command inventory: 57 executable paths in H and frozen C agree exactly; C has an explicit policy per path. H's production registry has not adopted those policies yet. See command-migration-round-14.json; this is an inventory, not proof of H product execution.

## rec-03 conformance

1. CLI/resources isolated packages: actual catalog/request and Page/Site reads, throwing live/network effects, no live fallback; root execution/capability tests additionally exercise real SQLite.
2. T04 exact leaf selection and T02 admitted capability/lifetime tests plus actual packed four-backend command matrix. Product registry adoption remains B01/B02.
3. Packed CLI record/probe/HTTP re-admission: protocol/root/agent/instance/profile/material/unknown payload negatives and successful exactly-once handler dispatch; Page targets remain rejected without authority.
4. Lazy Page unit tests cover first-use concurrency, failure/partial cleanup, cancellation/close; generic ownership tests cover error continuation and duplicates. Packed Page/Codex/provider/resource aggregate verifies concrete shutdown and two-instance separation.
5. Resource artifacts/material mutation tests, Page generation store/coordinator tests, real Vue worker and MCP negotiated in-memory transport consumers pass. No change to MCP transport.

## Commands

- run-upstream-check.ts round-14-runtime: all five exit 0; root check **503 pass, 0 fail, 2636 assertions, 110 files**, typecheck/lint pass; CLI/resources/optionals/legacy consumers pass.
- verify-minimum-bun.ts round-14-minimum-runtime --curl-mirror: CLI/resources/optionals all exit 0 on pinned Bun 1.3.0. Archive SHA512 unchanged from E135; binary SHA256 ce7b4f94a13ee0f881b06cfb4e428a017ddc69c3307dae0cb86709042fe0c058.
- git diff --check both roots: exit 0. C protected 1207 files unchanged. H before product adoption: 917 eligible files, digest ad966d0960eae2864496b227563652de502a43dfd653a8a7208abf0f86cf4cd5.

Public rec-02/03/04 now allow B01 Halfcode self-consumption. Product-wide policies, identity bridges/compatibility, packaging, Codument adoption/domain/workspace/migration/token work, and final independent verification are still pending. Real browser/platform-native tests outside Darwin arm64 are NOT_RUN; vendor test archives do not authenticate publishers. No npm publication or global installation.
