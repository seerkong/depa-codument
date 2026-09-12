# Terra real E2E — Round 45

Status: bounded measurement batch finished; full business acceptance not achieved. All seven formal trials are terminal. No additional trial or budget reset is authorized by this report.

## Fixed boundaries

- Product candidate: R3, SHA256 `8fdf75af54b2f64a026db4cfee743ee027e8bf82456eedd0a3841492aeee9931`.
- Model: `gpt-5.6-terra`, reasoning `medium`, including observed child sessions.
- Original requirements remain unchanged. All business work executes under private `/tmp` roots using the copied candidate and temporary global Skill.
- Up to three outer attempts per independent run. Resume preserves attempts and failures; it does not create a new first-pass opportunity.
- First pass means outer attempt 0 passed all gates. Internal hook/GapLoop/Attractor corrections can still occur within that attempt.
- Corrected pass means the run passed within its bounded attempts. Neither internal NO_GAP nor tests alone constitutes external acceptance.
- A separate zero-internal-correction success rate is not instrumented; do not interpret the outer first-pass rate as that metric. Corrected pass is cumulative (it includes first-pass successes), not the conditional recovery rate among initial failures.
- Costs are deduplicated observed per-response counters across parent and child logs. Cached input is included in total input. Unknown monetary/account cost is not estimated. Outer controller and report-auditor tokens are not included.

## Final measured results

| Independent run | First pass | Final pass | Minutes | Noncached input | Cached input | Output |
|---|---:|---:|---:|---:|---:|---:|
| Todo 1 — bvTcgN | yes | yes | 25.93 | 460,534 | 6,728,960 | 59,941 |
| Stream 1 — OQoacs | no | no | 65.85 | 785,640 | 12,166,656 | 96,196 |
| Blog — I5ZuWb | no | no | 72.03 | 1,172,547 | 16,867,328 | 129,504 |
| Ecommerce — lztBFk | no | blocked | 44.82 | 642,833 | 9,248,000 | 95,660 |
| Nested Mission — XiBVUg | no | no | 32.06 | 746,233 | 11,953,152 | 99,408 |
| Todo 2 — Yg2OnD | no | yes | 75.58 | 1,224,206 | 15,419,136 | 169,763 |
| Stream 2 — dIrjAv | no | blocked | 28.01 | 480,687 | 7,321,088 | 64,658 |

Outer first-pass rate: **1/7 (14.3%)**. Cumulative bounded final-pass rate: **2/7 (28.6%)**. Todo: first 1/2, final 2/2; Stream: first 0/2, final 0/2; Blog, Ecommerce and Nested: each first 0/1, final 0/1. Blocked business trials remain in the denominator. These small-sample observations under evolving harness baselines are not stable population rates.

Machine-readable ledger: [terra-e2e-round45-results.json](terra-e2e-round45-results.json). Its per-case `runs` and usage include calibration/probes, whereas `denominator` counts only formal business trials; use the explicit formal/calibration totals below for like-for-like comparisons.

## Failure evidence and baseline caveats

- Todo 1: final real Ego Browser flows passed; an earlier internal Playwright installation attempt did not. The external UI receipt supplements rather than rewrites that evidence.
- Todo 2: attempt 0 created and completed a second Track while the approved pending Track remained `new`; the outer lifecycle gate correctly failed it. Handoff lacked an explicit approved Track ID, the default status query omitted pending, and the model did not recover it from files. Attempt 1 completed the original Track and passed API/fresh checks, but actual Ego UI found an asynchronous form-reset exception and title DOM injection. Attempt 2 retained the existing hook counter, repaired text-only rendering/form handling and a fresh-discovered JSON-null PATCH exception, then passed actual browser interaction and independent final acceptance. Final evidence: 5 tests/31 assertions plus 19 independent HTTP assertions; strict/modeling passed and engineering had 0 errors/2 documented warnings. The application's script named typecheck is build/tests, not strong static typing. This was a real recovery within three attempts, not a fresh first-pass trial (E305/E307/E308).
- Stream 1: initial Python discovery failure required controller runtime provisioning; attempt 1 reviewer scratch creation also triggered the source guard. Attempt 2 independently failed actual terminal streaming timing: shell output begins after the complete model turn, not during the stream. All raw attempts remain.
- Blog: intermediate reconnect events and archive selection exposed runner defects. These were corrected without rewriting original results. The final attempt has real independent failures: missing draft-editing UI and inconsistent passwordHash knowledge. Outer final browser observations also found absent reader comments and moderation content.
- Ecommerce: five configured GapLoop rounds all applied actual fixes. The final FIX_APPLIED exhausted `on_exhausted=block`; the implementation correctly left lifecycle incomplete. The controller stopped an automatically started outer retry, preserving its raw interruption and cost. Effective outcome is blocked/nonpassing business delivery, not an excluded transport failure. Final outer review/UI did not run. Syntax-only `node --check` also must not be reported as strong type checking.
- Nested: two planning corrections consumed the first two outer attempts. The last implementation passed resource, selection and script checks but emitted `e2e-server.json.argv` instead of the runner's `command`. The nested acceptance wording lacked the explicit JSON example present in HTTP cases, so this is a boundary mismatch with a test-contract clarity caveat, not evidence of broken order HTTP behavior. A separate controller diagnostic, using the actual argv without source edits, passed live reservation, insufficient-stock, duplicate-payment and cancellation checks. It does not replace the formal FAIL or missing final independent review (E304).
- Stream 2: automatic Python discovery passed. Internal corrections repaired assistant/tool conversation history and layered iteration errors; 14 tests and bridge modes passed. The fifth independent GapLoop still reproduced synchronous SDK/provider stream-creation exceptions escaping without semantic error facts. The configured block ended the run before outer business/fresh review. No outer retry was started, and no sixth hook round was added (E306).
- Harness lineage: initial `06b0e66…`; reconnect fix `66116139…`; archived lifecycle selection `141bb423…`; pre-model Python discovery and reviewer scratch guidance `a9582386…`. Product R3 is unchanged. Later repetitions are product repetitions under explicitly improved harness conditions, not claims of identical infrastructure.

## Verification of the runner

- Latest complete `/tmp` project check: 670 pass, 0 fail, 7,807 assertions, 139 files; typecheck and lint passed (exec 47539, harness 671c5540…). The preceding full run had one clone-test timeout; isolated and full reruns passed without raising the timeout (E303).
- Latest focused runner tests: 17 pass, 101 assertions. Bounded fresh reviews covered the data/source, archive and stop-policy corrections (E300–E301); the resource-level versus scope-level hook receipt limitation remains explicit.
- Final source and isolated-copy harness SHA256 both `671c554008dc9c8500a1e2902822e71fe15cc2769147b19fd41ac2ddf976ce1b`. Latest no-model smoke RifTBP passed all 10 checks: isolated install, global layout, workspace App, help, guidance, unknown-command exit, sandbox denial, permitted sandbox writes, timeout and legacy-command rejection.
- Python-only preflight: OJNy9N, repeated runtime identity check and actual sandbox execution, modelCalls=0.
- Smoke/probe and earlier full checks: E290–E292/E296. Independent final UI and failure records: E293–E299.
- Final bounded fresh Terra report audit: NO_GAP after checking Todo 2's raw result, failed/passed UI receipts and usage, then recomputing all seven formal outcomes and formal/calibration totals. This audits the report, not the failed business deliveries. MissionLite preflight passed after correcting an invalid node-status enum; no completion/archival check is claimed (E309).

## Cost interpretation

The observed totals are dominated by repeated cached context in long implementation sessions, but noncached input and output remain substantial. Keep quality checks intact. Runtime discovery, recovered-transport classification and lifecycle-aware validation remove avoidable reruns; their actual savings must be measured with the subsequent runs, not asserted from source changes alone.

| Accounting scope | Input including cache | Cached input | Noncached input | Output |
|---|---:|---:|---:|---:|
| Seven formal business trials | 85,217,000 | 79,704,320 | 5,512,680 | 715,130 |
| Observed calibration/probes | 13,201,601 | 12,438,528 | 763,073 | 102,236 |
| Combined observed counters | 98,418,601 | 92,142,848 | 6,275,753 | 817,366 |

Formal elapsed sum is 20,657,088 ms (344.28 minutes), **not batch wall-clock duration**. Including calibration/probes, known elapsed sum is 24,532,005 ms; four probe durations and one probe's usage are unknown. All formal trials have observed usage. The combined counters are not a complete account bill: unknown counters and outer controller/auditor usage are not included, and monetary cost is unavailable.

Stream 2's lower cost is not evidence of equal-quality efficiency: it terminated at an internal hook, whereas Stream 1 reached final outer review after additional attempts. Both failed complete delivery. The two fresh repetitions overlapped in wall-clock time but used independent roots/data/model contexts; do not sum their elapsed values and label that batch wall-clock duration.

Calibration and transport probes below are excluded from the business denominator, but not from the cost ledger. Their raw logs and original conclusions are retained alongside corrective classification.

| Calibration/probe | Classification | Minutes | Input (includes cached) | Cached input | Output |
|---|---|---:|---:|---:|---:|
| Todo j4zhPE | Harness-invalid pending lifecycle query | 10.02 | 1,491,897 | 1,387,008 | 21,047 |
| Todo OWXOhA | Harness-invalid older candidate/runner; real application failures retained | 54.57 | 11,587,757 | 10,954,240 | 79,733 |
| DqsSjg | Harness-invalid false positive on refusal | unknown | 45,153 | 39,168 | 614 |
| eazEEK | Infrastructure failure before usable usage observation | unknown | unknown | unknown | unknown |
| cS2ETJ | Actual native CLI/model probe passed | unknown | 47,888 | 40,192 | 475 |
| GF9rEg | Actual native CLI/model probe passed | unknown | 28,906 | 17,920 | 367 |

The latest no-model smoke is RifTBP (10 checks passed, modelCalls=0). Session-accounting coverage counts log files/fragments, not necessarily unique conversations. Neither missing counters nor unknown account billing is represented as zero.

## Isolation and closure

All seven runner locks and temporary Codex auth files were absent at final inspection. Actual UI/application servers were stopped after verifying their process identities; Ego TaskSpace 3 was finished exactly once and its page closed. The unrelated local artifact registry at port 49165 was left running. No original workspace upgrade or global installation was performed in this batch.

Original `codument/` fingerprint remains `b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f`; old global `codument` SHA256 remains `05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8`; frozen R3 candidate is unchanged. The pre-existing user edit in `src/templates/codument/std/attractors/depa-attractor.md` is preserved. New harness code is in `project/e2e/`; generated business apps remain isolated trial artifacts, not product-source patches.

## Next decision and prioritized gaps

The requested measurement sequence and repeats are finished, but the business acceptance node and broader refactor mission are not complete. Ecommerce and Stream 2 explicitly exhausted configured `on_exhausted=block`; the other failures exhausted their three outer attempts. Do not resume these trials, add a fourth attempt, reset hook counters or overwrite failures to improve the measured rate. A new corrective candidate and fresh measurement batch require an explicit next-batch/policy decision; the recommended choice is to preserve existing limits and results, not raise them.

1. Make the approved Track ID explicit in plan-to-implementation handoff and document pending-plan discovery; do not label default legacy status compatibility itself broken without evidence.
2. Make nested planning knowledge requirements and server descriptor schema explicit upfront, with actionable validation errors and a concrete JSON example.
3. Preserve and strengthen independent actual UI, terminal streaming timing and synchronous pre-iterable exception oracles. Tests and model self-reports must not substitute for these observations; no removal of GapLoop, hooks or Attractor checks.
4. Add scope-bound machine-readable hook evidence before claiming complete scope/chronology validation. Current conservative ambiguous-scope infrastructure classification is not proof that every hook completed.
5. After source-level fixes justified by these findings, freeze a new candidate/harness and run fresh affected cases under unchanged limits. Retain this baseline, its failed trials, calibration costs and environment caveats. Do not manually patch temporary business solutions and count them as product improvement.
