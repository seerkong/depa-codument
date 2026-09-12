// Raw historical verification inputs from test/resources/decision-migration-inventory.
// Not a runtime dependency or an automated semantic migration implementation.
export const LEGACY_DECISION_SOURCES = [
  {
    "name": "case-01-archive-recoverable",
    "files": [
      {
        "path": "codument/tracks/archived/2026-07/2026-07-01-0900-migration-recoverable/decisions.xnl",
        "source": "<decision #fixture.migration.recoverable {\n  priority = \"P0\"\n  status = \"accepted\"\n  durable_candidate = true\n  confidence = 0.98\n  reversibility = \"moderate\"\n  source_kind = \"track\"\n}\n(\n  <question ?>Which recovery policy preserves historical semantics?</?>\n  <recommendation ?>Recover the complete archived XNL node instead of rebuilding it from the summary.</?>\n  <options { } [\n    <option { key = \"recover_xnl\" recommended = true }\n    (\n      <title ?>Recover archived XNL</?>\n      <description ?>Preserve the original decision tree and extension fields.</?>\n    )\n    >\n    <option { key = \"parse_summary\" }\n    (\n      <title ?>Parse the Markdown summary</?>\n      <description ?>Reconstruct only the fields visible in the lossy projection.</?>\n    )\n    >\n  ]>\n  <answer { }\n  (\n    <raw-answer ?>Recover the archived XNL node.</?>\n    <decision-text ?>Archive recovery is authoritative when one matching node exists.</?>\n    <rationale ?>The archive retains information that the Markdown summary discarded.</?>\n    <evidence ?>The summary contains no question, options, raw answer, or provenance subtree.</?>\n  )\n  >\n  <legacy-provenance { schema = \"fixture-v1\" }\n  (\n    <archive-path ?>codument/tracks/archived/2026-07/2026-07-01-0900-migration-recoverable/decisions.xnl</?>\n  )\n  >\n)\n>\n"
      },
      {
        "path": "codument/decisions/2026-07/2026-07-01-0900-fixture.migration.recoverable/decision.md",
        "source": "# Decision: fixture.migration.recoverable\n\nDecision URI: decision://fixture.migration.recoverable\nSource: archive://2026-07-01-0900-migration-recoverable\n\nStatus: accepted\nDurable candidate: yes\nEvidence: The summary intentionally omits the complete decision structure.\nConfidence: 0.98\nReversibility: moderate\n"
      }
    ]
  },
  {
    "name": "case-02-markdown-only",
    "files": [
      {
        "path": "codument/decisions/2026-06/2026-06-02-1015-fixture.migration.markdown_only/decision.md",
        "source": "# Decision: fixture.migration.markdown_only\n\nDecision URI: decision://fixture.migration.markdown_only\n\n# Historical decisions\n\nThe original document has no recoverable XNL source.\nLEGACY-RAW-CONTENT-MUST-SURVIVE, including punctuation: `<legacy> & \"quoted\"`.\n\n### 1. Preserve the original narrative\n\n- Context: This predates structured `decisions.xnl`.\n- User response: Keep the complete historical document.\n- Final decision: Convert only fields that can be determined.\n- Rationale: Missing question, options, hierarchy, and activation must not be invented.\n- Status: accepted\n\n### 2. A second historical choice\n\n- Context: One Markdown file may contain several choices while exposing one legacy URI.\n- Final decision: Retain the ambiguity as a migration issue.\n- Status: accepted\n"
      }
    ]
  },
  {
    "name": "case-03-missing-source",
    "files": [
      {
        "path": "codument/decisions/2026-07/2026-07-03-1115-fixture.migration.missing_source/decision.md",
        "source": "# Decision: fixture.migration.missing_source\n\nDecision URI: decision://fixture.migration.missing_source\nSource: archive://2026-07-03-1115-missing-archive\n\nStatus: accepted\nDurable candidate: yes\nEvidence: The referenced archive directory is intentionally absent.\n"
      }
    ]
  },
  {
    "name": "case-04-ambiguous-id",
    "files": [
      {
        "path": "codument/tracks/archived/2026-07/2026-07-04-1230-ambiguous-archive/decisions/domain/duplicate.xnl",
        "source": "<decision #fixture.migration.ambiguous {\n  status = \"accepted\"\n  durable_candidate = true\n}\n(\n  <question ?>Which archive candidate is authoritative?</?>\n  <answer { }\n  (\n    <decision-text ?>Recursive candidate must not win by scan order.</?>\n    <evidence ?>This is the recursive source candidate.</?>\n  )\n  >\n)\n>\n"
      },
      {
        "path": "codument/tracks/archived/2026-07/2026-07-04-1230-ambiguous-archive/decisions.xnl",
        "source": "<decision #fixture.migration.ambiguous {\n  status = \"accepted\"\n  durable_candidate = true\n}\n(\n  <question ?>Which archive candidate is authoritative?</?>\n  <answer { }\n  (\n    <decision-text ?>Root candidate must not win by scan order.</?>\n    <evidence ?>This is the root source candidate.</?>\n  )\n  >\n)\n>\n"
      },
      {
        "path": "codument/decisions/2026-07/2026-07-04-1230-fixture.migration.ambiguous/decision.md",
        "source": "# Decision: fixture.migration.ambiguous\n\nDecision URI: decision://fixture.migration.ambiguous\nSource: archive://2026-07-04-1230-ambiguous-archive\n\nStatus: accepted\nDurable candidate: yes\nEvidence: Two archive source files intentionally claim the same stable id.\n"
      }
    ]
  },
  {
    "name": "case-05-target-conflict",
    "files": [
      {
        "path": "codument/tracks/archived/2026-07/2026-07-05-1345-target-conflict-source/decisions.xnl",
        "source": "<decision #fixture.migration.target_conflict {\n  status = \"accepted\"\n  durable_candidate = true\n}\n(\n  <question ?>Which target policy applies?</?>\n  <answer { }\n  (\n    <decision-text ?>Use the recovered archive policy.</?>\n    <evidence ?>This node conflicts with the existing canonical registry node.</?>\n  )\n  >\n)\n>\n"
      },
      {
        "path": "codument/decisions/legacy/2026-07-05-1345-fixture.migration.target_conflict/decision.md",
        "source": "# Decision: fixture.migration.target_conflict\n\nDecision URI: decision://fixture.migration.target_conflict\nSource: archive://2026-07-05-1345-target-conflict-source\n\nStatus: accepted\nDurable candidate: yes\nEvidence: The archive node conflicts with an existing canonical target.\n"
      },
      {
        "path": "codument/decisions/policies/existing.xnl",
        "source": "<decision #fixture.migration.target_conflict {\n  status = \"accepted\"\n  durable_candidate = true\n}\n(\n  <question ?>Which target policy applies?</?>\n  <answer { }\n  (\n    <decision-text ?>Keep the existing target policy.</?>\n    <evidence ?>This node already exists in the canonical registry.</?>\n  )\n  >\n)\n>\n"
      }
    ]
  }
] as const;
