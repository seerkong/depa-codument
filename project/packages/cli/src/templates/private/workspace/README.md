# codument workspace

This hidden directory marks the project as initialized by DEPA Codument.
It is named `.codument` so it does not collide with the compiled `codument` binary.

- `config.json` records the fixed Codex workspace target, page-source settings, and optional discriminated browser provider config. Select `browser.transport` (`ego-browser`, `opencli`, or `mdd-browser-robot`), then place provider-specific settings in the same-named block. MDD requires `browser.mdd-browser-robot.transport="chrome-extension"` and never falls back to Ego or OpenCLI.
- Refresh managed `AGENTS.md` / `CLAUDE.md` and skill shells with `codument upgrade-workspace`.
- Template-owned paths are refreshed; config, serve records, and other user-owned files are retained.
