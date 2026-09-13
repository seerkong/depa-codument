# Real Codex E2E

The current-version suite owns the runner and independent acceptance. Historical `../../e2e/` remains read-only. Each `cases/*/request.md` preserves its original business requirement; `acceptance.md` supplies the current operation routing and a concrete external testing boundary, never replaces the whole requirement.

Run only from a copied repository under `/tmp`, with a candidate built by that copy's `scripts/build.ts`. There is no default global or legacy binary fallback:

```sh
bun test e2e
bun e2e/run.ts smoke --bin=/absolute/tmp/depa-codument-candidate
bun e2e/run.ts probe --bin=/absolute/tmp/depa-codument-candidate --codex=/absolute/codex
bun e2e/run.ts review-probe --bin=/absolute/tmp/depa-codument-candidate --codex=/absolute/codex
bun e2e/run.ts run todo --bin=/absolute/tmp/depa-codument-candidate --codex=/absolute/codex
bun e2e/run.ts report /private/tmp/depa-codument-e2e-<run> ...
```

Order: smoke → todo → stream-pipeline-ai-agent → blog → ecommerce → nested-mission-agent → second independent todo and stream runs. Each invocation creates a unique retained run root; do not rerun a still-active invocation. Up to three attempts per run retain first-attempt failures. Planning and implementation are separate fresh Codex sessions that recover from workspace files; each correction also opens a fresh session rather than relying on warm conversation history.

After changing reviewer transport, `review-probe` calibrates the same read-only agent turn, native execution observer and verdict gate with a tiny new Python fixture before spending a full business run. It makes one bounded real Terra call; it is not a no-model smoke or business acceptance, and cannot promote/resume an old trial. Reviewer guidance explicitly requires a successful standalone test call: a pytest success hidden inside a subsequently failing diagnostic block is not an admitted successful execution. Unsupported control flow/heredocs remain rejected rather than heuristically treated as PASS.

After planning validation, the parent records `planning-handoff.json` with repository, authored resource ID, lifecycle path and observed source hash. Each implementation session receives these exact identities and reobserves them with `track context`; default `list` intentionally remains active-only. Status/path changes are allowed, identity loss/duplication/replacement is rejected. This fresh-case handoff is not a second lifecycle owner, approval receipt or cached semantic verdict. New optimization batches use new run roots and retain all earlier failures and limits.

`workflow-policy.ts` owns the benchmark's explicit Track check choices and supplies the same declaration to planning, implementation and independent review. Each run preserves `workflow-policy.json`; planning and post-implementation admission check the actual typed hooks, including backlog declarations without executing unselected work. Product auto defaults are unchanged. A matching declaration does not prove fresh execution: the implementation still runs its hooks and the independent reviewer checks their evidence. Resume rejects absent or different policy snapshots instead of silently applying new choices to an old trial. Reports expose the recorded policy; older rows are null, not implicitly equivalent. Configuration-file equality alone does not guarantee equal checks because the authored Track may select none.

Before a stream model turn, the macOS runner discovers an existing managed Python 3.12 using `~/.local/bin/uv`, with downloads disabled. It verifies execution within the sandbox, records executable hashes in `python-runtime.json`, and creates only per-run executable wrappers. No host installation is changed. Missing runtimes fail before a model call; resume rejects runtime drift. Reviewers place new scratch environments under their isolated `HOME/tmp`, not in delivered source.

`run ... --resume=<run-root>` verifies binary and immutable case identity, rejects a live owner, retains earlier attempts and elapsed time, and cannot reset the three-attempt budget. Resume is not a first-pass or denominator reset. Framework-invalid pilots are separately excluded with an auditable reason; their token costs remain visible.

The three outer attempts do not override configured workflow stops. Implementation emits a structured delivered/blocked outcome; an exhausted `on_exhausted=block` hook ends that case as blocked, with no automatic retry/resume. A parent-owned terminal-policy receipt preserves any controller interruption's raw result while counting the actual workflow block as nonpassing business delivery, not excluding it as a transport failure. Continue other independent cases without resetting this case's hook budget.

An independent stop guard also reads CLI-owned round state, configured limits and terminal reports before accepting delivery or retrying, so a false delivered claim cannot override an observed singleton exhausted block. The product currently has a resource-level counter and free-form scoped reports, not scope-bound machine receipts. Multiple exhausted scopes with incomplete/mixed report evidence therefore yield explicit harness-unsupported, not a business-block assertion; complete unambiguous NO_GAP reports are accepted.

Model is fixed to `gpt-5.6-terra`, effort `medium`. The parent and observed child session contexts must match. No model substitution, no API publishing, no quota purchases. Credentials are copied only into a private temporary auth file and removed when the invocation finishes; after an uncatchable kill, remove that one exact auth file manually. Personal config/plugins/Skills are not copied. Use `--auth` to choose an alternate existing auth file without printing it.

The macOS whole-process Seatbelt boundary protects the runner, binary, installed Skill and original projects; writable roots are only business workspace, temporary cache and temporary Codex state. Codex does not reapply a nested Seatbelt (macOS rejects that); its `danger-full-access` setting is constrained by this mandatory outer boundary. There is no unsandboxed fallback. Native process and permission smoke tests must pass before model use. Other operating systems currently fail closed.

Setup alone can write the temporary home to install the Skill. All candidate invocations, including setup/query/validation, use Seatbelt. Personal-home content reads are denied except explicit installed runtime directories; metadata reads are allowed so Node can resolve its executable. Application verifiers cannot read the temporary Codex state/auth. The trusted Codex host necessarily reads its temporary credential; this is not a separate credential boundary between Codex and its own tools. Network remains available for the model and dependencies.

All setup/agent/verification commands have logs and bounded lifetimes; process groups are killed on completion/timeout. Global `codument` and `depa-codument` installations are never rewritten. Each run copies the candidate and installs its global Skill into a temporary home; business assets remain `workspace/codument/`. The old `codument` command is a rejecting sentinel, not an alias.

Independent acceptance has three gates: installation/runtime identity; strict real Track/Mission/knowledge workflow; application scripts + randomized business oracle + fresh semantic/implementation review. Agent completion text and self-authored tests alone cannot pass. HTTP boundary tests run actual servers; stream fixtures exercise the generated real adapter and pipeline, not a live paid model provider. Full business/UI/architecture completeness remains part of fresh review.

Mutable runtime facts use a harness-owned per-phase `E2E_DATA_DIR` under isolated `HOME/tmp`; `DATA_FILE` provides a JSON store path. Apps honor this environment at server startup. HTTP, browser, nested servers and agent checks use distinct state directories. This separates databases/queues from delivered source without exempting ignored source, dependencies or `dist/`. Stream verification dependencies are installed before the delivered fingerprint is frozen; app scripts and business verification must then preserve it. Fresh-app archive checks match each knowledge member to its promoted owner/content and ensure BehaviorPatch replay would not change the current semantic delivery; this is not a general historical merge oracle.

Archive promotion correlation currently admits a singleton archived delivery per repository. Multiple archived deliveries return explicit harness-unsupported/infrastructure status, not a business FAIL or PASS: reconstructing successive historical merges requires baseline-aware verification. Earlier completed validation remains evidence of its recorded harness only.

HTTP cases additionally stop at an `awaiting-ui` event. The runner owns an immutable request; a suite-owned UI controller claims its exact request with a private lease, starts exactly one isolated app process, proves `/health`, then records `server-ready`. Only after that transition does the 15-minute browser evidence clock begin. The outer controller uses one Ego Browser TaskSpace for this suite and exercises visible registration/business/edit/filter flows, including user-input rendering. It must submit its terminal result through `ui-receipt`, which verifies the request identity, data directory and lease before writing the receipt and controller transition. The generated application and coding agent cannot write any of those root records.

```sh
# Starts the controller and prints origin, attempt and lease only after /health succeeds.
bun e2e/run.ts ui-server /private/tmp/depa-codument-e2e-<run> --bin=/absolute/tmp/depa-codument-candidate
# Submit a typed observation from the independent browser operator.
bun e2e/run.ts ui-receipt /private/tmp/depa-codument-e2e-<run> --bin=/absolute/tmp/depa-codument-candidate --receipt='<JSON>'
```

Actual UI defects, bare HTML and mismatched evidence reject acceptance; never synthesize a PASS from source inspection or the implementation agent's claims. A missing lease/start, failed health check or missing post-ready receipt is a controller infrastructure failure and does not ask the model to repair the application. Browser acceptance failure carries observed findings and remains a business correction. Historical `infrastructure-failed` Todo and Blog applications may instead be examined once with `ui-reverify <historical-run-root>`: it creates a new temporary, read-only controller root pointing at the frozen application workspace. It never changes the historical run, source tree, result, attempts, usage or first-pass statistics; reports list that result separately as `uiReverifications`.

Results and JSONL usage live outside the writable business repository. Report first-pass and corrected-pass rates separately; infrastructure failures and incomplete runs are excluded and explicitly counted. Token counters are observed Codex counters, not estimated currency. Missing counters remain null. Child-session cost coverage must be stated rather than silently undercounted.

Reports prefer per-response raw session usage (deduplicated by response ID), including child and interrupted turns. Completed top-level totals are shown separately, never added again. Session coverage counts are observations, not a guarantee that the provider exposed every billed token; currency cost stays null.
