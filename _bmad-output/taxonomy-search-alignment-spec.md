# Quick Spec: Taxonomy-Search Alignment

Date: 2026-02-09
Owner: AI orchestration + search stack

## Problem

Taxonomy implementation has evolved (`facet_account_id`, person/org normalization), but parts of retrieval defaults and docs still lag. This causes:

- inconsistent people/theme answers
- weaker person attribution for theme/segment queries
- extra debugging cost when docs disagree with runtime behavior

## Goals

1. Align taxonomy docs with live schema and ingestion behavior.
2. Improve answer quality for people/theme questions without major token growth.
3. Preserve graceful fallback behavior when tools fail.

## Non-goals

1. Re-introducing `facet_ref`/`facet_candidate`/`project_facet`.
2. Full redesign of taxonomy UI management.
3. Rebuilding semantic search infrastructure.

## Requirements

1. Ingestion writes `evidence_facet.person_id` when person linkage is known.
2. People analytical responses include facets by default.
3. `getFacetCatalog` avoids mixed-id collision risk.
4. Core docs describe current model (`facet_account_id`) and removed legacy tables.
5. Benchmark suite tracks accuracy, attribution quality, latency, and fallback reliability.

## Stories

### Story 1: Direct person attribution in evidence facets
As an analyst, I want theme answers tied to the correct people so commonality and segment outputs are reliable.

Acceptance:

1. New ingestion paths populate `evidence_facet.person_id` when determinable.
2. Existing fallback joins remain for legacy data.
3. Integration tests verify person attribution for top themes + segment queries.

### Story 2: People analytical defaults include taxonomy context
As a user asking about fit/commonality, I want answers grounded in facets and evidence, not just profile fields.

Acceptance:

1. Analytical people prompts route through `includeFacets=true`.
2. Lightweight list/status prompts keep the cheaper mode.
3. Smoke tests confirm "what do X and Y have in common" returns grounded facet overlap.

### Story 3: Catalog merge semantics are safe and deterministic
As a developer, I want taxonomy IDs in memory to map cleanly to persisted records.

Acceptance:

1. `getFacetCatalog` has no numeric id collision risk between global/account sets.
2. Returned IDs used by persistence map to valid `facet_account.id`.
3. Unit tests cover collision scenario.

### Story 4: Docs reflect current runtime
As an engineer/operator, I want docs that match the schema so debugging and prompts stay reliable.

Acceptance:

1. `docs/20-features-prds/facet-catalog.md` matches current model.
2. `docs/00-foundation/_information_architecture.md` facet section uses current schema terms.
3. Taxonomy architecture audit links to code/migration anchors and active beads.

## Validation plan

1. Canonical prompt test set (20 prompts): compare answer correctness with UI/source tables.
2. Measure direct attribution coverage before/after (`evidence_facet.person_id` non-null where expected).
3. Log median/p95 latency and token cost for people/theme question classes.
4. Confirm fallback answer behavior on forced tool failures.
