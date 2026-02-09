# Taxonomy + Search Architecture Audit (2026-02-09)

## Purpose
Establish a current-state, implementation-grounded view of taxonomy architecture and how it powers user-facing Q&A/search.

## Current Source of Truth (Code + Schema)

### Taxonomy tables in active use
- `facet_kind_global`: canonical kind list (for example: `pain`, `goal`, `workflow`, `job_title`).
- `facet_global`: global seed labels.
- `facet_account`: tenant/account-level normalized vocabulary; includes `is_active`.
- `person_facet`: person-to-facet links using `facet_account_id` (no `facet_ref`).
- `person_scale`: numeric scales (for example `icp_match`).
- `evidence_facet`: evidence-to-facet links using `facet_account_id`; includes `person_id` (nullable).
- `theme_evidence`: theme-to-evidence links for rollups.

### People/org normalization in active use
- `people.default_organization_id` and `people_organizations` are active.
- `people_organizations.job_title` and `project_people.relationship_type` reflect role-column rename work.

## What was removed (important)
- `facet_ref` usage is removed from `person_facet` and `evidence_facet`.
- `facet_candidate` and `project_facet` were dropped in simplification migration.

## Ingestion write path (today)
1. `processInterview.server.ts` extracts evidence + facet mentions.
2. Facet mentions are matched/created via `FacetResolver.ensureFacet(...)` into `facet_account`.
3. `evidence_facet` rows are written with `facet_account_id`.
4. Person-level synthesized facets are upserted into `person_facet` via `persistFacetObservations(...)`.
5. `evidence_people` links evidence to person.

## Retrieval/search path used by agents

### People search
- `semantic-search-people` uses pgvector RPC `find_similar_person_facets`, then falls back to keyword on:
  - `people.name`
  - `person_facet -> facet_account.label`
  - `organizations.name`
- `fetch-people-details` can return facets/scales, but `includeFacets` defaults to `false`.

### Evidence search
- `semantic-search-evidence` searches both:
  - evidence embeddings
  - `evidence_facet` embeddings (`find_similar_evidence_facets`)
- This is taxonomy-aware for pains/goals/thinks/feels style queries.

### Theme + people attribution
- `fetch-top-themes-with-people` uses `theme_evidence`, then resolves people from:
  1. `evidence_facet.person_id`
  2. fallback `evidence_people`
  3. fallback `interview_people`

## Document Drift (verified)

### Corrected in this pass
1. `docs/20-features-prds/facet-catalog.md`
   - rewritten to current `facet_account_id` model.
2. `docs/00-foundation/_information_architecture.md`
   - facets section updated to current schema/flow and legacy note.

### Remaining stale doc
1. `docs/40-user-guides/user-flow/user-flow-diagram.mmd`
   - still omits current direct `evidence_facet.person_id` model and over-emphasizes older links.

### Docs mostly aligned
1. `docs/10-architecture/interview-processing-explained.md`
   - generally aligned to account-ID facet model and modern ingestion phases.

## Gaps affecting answer quality
1. `evidence_facet.person_id` is present in schema but not consistently set during interview ingestion writes.
   - Impact: segment/theme queries relying on direct person attribution can undercount or miss matches.
2. `fetch-people-details` defaults `includeFacets=false`.
   - Impact: people-focused answers can miss taxonomy context unless explicitly requested.
3. `getFacetCatalog` currently merges global + account facets into a single numeric-key map.
   - Risk: id-space collisions (global id vs account id) can produce ambiguous catalog entries.

## How taxonomy should improve user question answering

### Query classes and best retrieval path
1. Person similarity / segment fit:
   - Use `semantic-search-people` first; then enrich with `fetch-people-details(includeFacets=true, includeEvidence=true)`.
2. Theme attribution ("who has this theme?"):
   - Use `fetch-top-themes-with-people` and prefer `evidence_facet.person_id`; keep fallbacks.
3. "What do these people have in common?":
   - Use overlap on `person_facet` by normalized `facet_account_id` + supporting evidence snippets.
4. "What pain is strongest in segment X?":
   - Use `segmentThemeQueries` path (`evidence_facet.kind_slug` + `theme_evidence`) for frequency + citations.

### Operational priorities
1. Ensure `evidence_facet.person_id` is written at ingestion time, not only via backfill/fallback.
2. Default people-agent retrieval to include facets for analytical questions.
3. Refresh stale taxonomy docs so model/tool prompts reflect real schema.

## Confidence
- Current table model + migration claims: High
- Tool behavior mapping: High
- Impact estimate on answer quality: Medium-High
- Id-collision risk in catalog merge: Medium (structural risk, depends on data distribution)

## Phased execution plan

### Phase 1: correctness and attribution
1. Write `evidence_facet.person_id` during ingestion whenever person linkage is known.
2. Keep fallback joins (`evidence_people`, `interview_people`) for legacy rows.
3. Add regression tests for person-attributed theme and segment queries.

### Phase 2: retrieval quality defaults
1. Default people-focused analytical requests to include facets.
2. Keep lightweight mode for simple list/status requests to control tokens.
3. Add smoke prompts for "commonalities", "ICP fit", and "top themes + who".

### Phase 3: taxonomy model hardening
1. Remove/namespace any mixed id-space merge in `getFacetCatalog`.
2. Ensure all returned catalog IDs are valid `facet_account.id` when used for persistence.
3. Add unit tests for collision and mixed catalog integrity.

## Benchmark and confidence tracking

Track these on every optimization pass:

1. Accuracy parity: result agreement against known-good UI/table views for 20 canonical prompts.
2. Attribution quality: percentage of theme/person answers with direct evidence/person links.
3. Cost/latency: median and p95 token+latency deltas versus baseline.
4. Failure safety: percent of requests returning a graceful fallback answer on tool/model failure.

Target confidence gates before broad rollout:

- correctness confidence >= 0.9 on canonical prompt set
- no critical regressions in attribution quality
- >= 20% median latency reduction for standardized project-status prompts

## Linked beads

- `Insights-2az1`: set `evidence_facet.person_id` at ingestion
- `Insights-qx11`: harden `getFacetCatalog` merge semantics
- `Insights-oion`: default people analytical context to include facets
