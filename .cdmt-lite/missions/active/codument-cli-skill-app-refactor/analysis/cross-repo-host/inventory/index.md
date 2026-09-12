# Inventory navigation

Boundary: evidence-backed observations of the two repositories at the 2026-09-05 design snapshot. Holds: package roles, provenance/distribution, fact nodes, read/write paths, incidents and conformance. NotOwnedHere: target architecture and implementation state. Tier: dated. Source: scope and independent source observations. Downstream: boundary, convergence, report.

| Topic | Source |
|---|---|
| Package manifests, roles and exports | [package-boundaries](package-boundaries.md) |
| Clone provenance and distribution seams | [provenance-distribution](provenance-distribution.md) |
| Fact owner and transitions | [fact-nodes](fact-nodes.md) |
| Runtime relation-aware paths | [read-write-paths](read-write-paths.md) |
| Incidents and observed proof limits | [incidents](incidents.md) |
| DEPA conformance and profile applicability | [depa-conformance](depa-conformance.md) |

Reviewed counts: 33 manifest rows (30 non-generated, 3 generated; 17 naming-policy RISK rows), 12 provenance/distribution RISK rows, 18 fact nodes (0 demonstrated backwrites/conflicts), 28 read/write steps (1 RISK-bypass, 2 UNKNOWN), 9 incident/observation rows (5 current RISK). These are overlapping topic counts, not a deduplicated bug total. Four-dimensional conformance and 2 optional profile assessments are in their separate table. Review: [round 1 FIX_APPLIED](../reviews/inventory-round-1.md), [round 2 NO_GAP](../reviews/inventory-round-2.md).
