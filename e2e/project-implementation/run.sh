#!/usr/bin/env bash
# Explicit legacy product; shared current harness, no global/source fallback.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
: "${CODUMENT:?Set CODUMENT to the compiled pre-refactor /tmp binary}"
if [[ "${MODE:-full}" != full ]]; then
  echo "The common comparison harness supports full runs only." >&2
  exit 2
fi
export E2E_AGENT="${E2E_AGENT:-${AGENT:-codex}}"
if [[ "${SKIP_AGENT:-0}" == 1 ]]; then
  exec bun "$REPO/e2e/run.ts" smoke --bin="$CODUMENT"
fi
exec bun "$REPO/e2e/run.ts" run "${1:-stream-pipeline-ai-agent}" --bin="$CODUMENT"
