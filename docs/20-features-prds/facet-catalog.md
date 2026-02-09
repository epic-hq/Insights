# Facet Catalog (Current Architecture)

Last verified: 2026-02-09

This document is the current source-of-truth for taxonomy in production code.

## Scope

The taxonomy system powers:

- person enrichment (`person_facet`, `person_scale`)
- evidence classification (`evidence_facet`)
- theme attribution and segment analysis (`theme_evidence` + people links)
- semantic retrieval for people/evidence tools

## Catalog layers

1. Global kinds (`facet_kind_global`)
   - Canonical taxonomy kinds (`pain`, `goal`, `workflow`, `job_title`, etc.).
2. Global seed facets (`facet_global`)
   - Platform seed values by kind.
3. Account facets (`facet_account`)
   - Tenant vocabulary used by ingestion and retrieval.
   - Includes `is_active`.

Resolution is account-first with global seeds available for fallback seeding.

## Current ingestion flow

1. Ingestion loads catalog from `getFacetCatalog({ db, accountId })`.
2. `FacetResolver.ensureFacet(...)` normalizes/creates account facets.
3. Evidence facet rows are inserted into `evidence_facet` using `facet_account_id`.
4. Person-level observations are upserted into:
   - `person_facet` (categorical)
   - `person_scale` (numeric scales like ICP)
5. People are linked to evidence through `evidence_people` and (where available) `evidence_facet.person_id`.

## Current tables

| Table | Purpose |
| --- | --- |
| `facet_kind_global` | Canonical facet kinds |
| `facet_global` | Global seed facets |
| `facet_account` | Account-level active taxonomy |
| `evidence_facet` | Facet labels on evidence (`facet_account_id`) |
| `person_facet` | Person-to-facet links (`facet_account_id`) |
| `person_scale` | Person-to-scale numeric values |

## Legacy model (removed)

These are no longer part of the active schema:

- `facet_ref` string references
- `facet_candidate`
- `project_facet`

If new code/docs mention those, treat it as drift.

## Search and answer quality implications

1. Person-focused questions are strongest when tools include facets (`person_facet`) and evidence snippets.
2. Theme attribution to people is strongest when `evidence_facet.person_id` is present.
3. Semantic people search relies on `person_facet` embeddings (`find_similar_person_facets`) and keyword fallback.
4. Theme/segment queries use `theme_evidence` + evidence/person joins, so missing person attribution lowers quality.

## Verification anchors

- `app/lib/database/facets.server.ts`
- `app/utils/processInterview.server.ts`
- `app/mastra/tools/fetch-top-themes-with-people.ts`
- `app/features/themes/services/segmentThemeQueries.server.ts`
- `supabase/migrations/20251024154750_simplify_facets.sql`
- `supabase/migrations/20251239000000_evidence_facet_person_id.sql`
- `supabase/migrations/20251240000000_backfill_evidence_facet_person_id.sql`
