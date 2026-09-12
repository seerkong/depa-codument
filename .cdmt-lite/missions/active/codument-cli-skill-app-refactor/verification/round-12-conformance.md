# Round 12: captured execution and public live seams

Execution state remains in `../loop.md`; this file records scope and evidence, not a second work graph. H denotes `/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite`. C's protected `src`, `codument` and `project` files were unchanged in this round.

## Execution material consistency (rec-04)

| Case | Implemented boundary and evidence |
| --- | --- |
| Legacy entry + relative dependency mutation | Existing captured static module graph remains; H `packages/skill-app-support/test/legacy-closure.test.ts`, packed resources gate. |
| Package source, metadata, lock and installed dependency mutation | New captured-package/v1 identity covers source/config/package.json + installed production package payloads/resolution edges + canonical lock/toolchain. H `packages/skill-app-support/test/package-closure.test.ts`; normal registry-installed code-first consumer removes live node_modules and changes metadata before building the captured material. |
| Cleanup, concurrency, unsupported material | Independent private generations, defensive byte copies, scope-safe dependency names, imported-file boundary, retry after failed build, close drains; tsconfig inheritance and package-internal symlinks explicitly unsupported. New package and lazy-owner negative tests preserve these distinctions. |
| Admission and actual material agree | Atomic `BundleDefinitionCatalog.resolve` pairs handler and material receipt. T07 preflight refuses absent/stale material, binds requested/effective profile, and rechecks resource revision. Actual packed code-first receipt reaches LocalFunction server re-admission; after metadata/dependency disappearance, the old request fails. Packed resource-first HTTP→LF→PageWorkflow similarly rejects stale material/identity and executes valid requests. |

The snapshot is derived from author-owned files; no authored source is rewritten by capture/build/close. It is not a JS sandbox, filesystem-wide atomic snapshot, mtime cache, registry publisher authentication or a supply-chain system. Capturing the complete selected installed package payload is conservative; this round adds no cache that trades away exactness. App/page builder profile consistency beyond the declared HostPackage/legacy closure is not silently claimed.

## Public package boundaries

- T06: execution/live/Page contracts and receipts; no implementation/provider dependency.
- T07: runtime-first preflight, exact request parsing and server re-admission; only injected catalog/instance/handler ports perform effects. No product CommandRuntime or global Serve lookup.
- T08: filesystem capture/stage/build/cleanup and atomic material index.
- T12: resource and LocalFunction composition, invocation admission/drain; no T13/T14/browser/Vue/MCP production dependency.
- T13: Page projection/build/workflow/channel/listener ownership and lazy Page composition. Concrete optional providers are injected. Its direct capsule dependency used by tests is dev-only; production does not gain an otherwise-unused dependency merely to match a proposed package list.
- T14: Hono Page/HTTP surface and narrow LocalFunction route; exact request protocol uses T07, live authority stays with the passed runtime. HTTP requests carrying any Origin use the Page-scoped route, not the CLI route. No product status/init/upgrade routing is added.

Existing C Page/HTTP files were selected individually (13 paths, hashes in `cross-repo-live-relocation.json`), not copied as a whole repository. New source owner is H. C generic copies remain frozen migration inputs until adoption, not an independently evolving implementation.

## rec-03 evidence and remaining gaps

Already exercised through public exports / packed artifacts:

- Local invocation with a failing live-transport sentinel; live-required without transport rejects before runtime acquisition.
- Unknown capability and bare Page-target requests reject; invalid schema does not call live transport.
- Server mismatch cases for root/agent/instance/protocol/profile/material/extra fields, plus instance change during admission.
- Close drains invocation runtime before explicitly owned resources; Page lazy startup is single-flight; cancellation before dispatch, safe retry, failed provider cleanup blocking retry, reentrant close, two-instance isolation and per-phase failure aggregation.
- Real loopback HTTP invokes actual PageWorkflow coordinators with controlled browser ports. Real Vue worker publishes through public PageBuildCoordinator/file store. MCP still uses an explicit independent transport. No real browser, messages or npm publish.

Still required before closing the complete runtime node or adopting either product:

1. Public leaf-command + admitted backend lifecycle placement over the entire command inventory, not just LocalFunction and existing lower-level policy functions.
2. Public client-side exact service-record/instance selection and narrow live transport integration. The new consumer currently constructs its explicit HTTP request; it does not prove the old private `invokeServeLocalFunction` transport has been migrated.
3. Full catalog/domain/request versus live facets and aggregate product close chain (including Codex/provider ownership), not only the Page owner and LF executor separately. The product aggregate must continue cleanup if an earlier dependent owner fails.
4. Remaining browser/backend bindings and read-only Page projection consumers, followed by H adoption, C versioned wrapping, same-set three-consumer/normal optional dependency resolution, and clone modes.

Final current-runtime logs: `logs/round-12-audit-final-*` (472 pass, 0 fail, 2439 assertions in root check). Lowest-runtime history: `logs/round-12-minimum-live-*` passed before the last two negative cases. Final recovery `round-12-minimum-audit-mirror-long` verified the same fixed runtime archive and passed CLI/resources (including code-first/server receipts), but optional installation timed out before executing tests; Bun1.3.0's `--offline` still made registry requests. Earlier download failures remain in their own logs. This limitation is explicit in E128 and loop; no final all-optional minimum-runtime PASS is claimed.
