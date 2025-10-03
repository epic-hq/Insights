# Facet Catalog & People Attributes

This guide explains the multi-tenant facet catalog, how interview ingestion auto-tags people, and how researchers can manage new candidates.

## Catalog Layers

1. **Global seeds** (`facet_kind_global`, `facet_global`)
   - Shared vocabulary shipped with the product.
   - Read-only to tenants; seeds live in migrations + `_NORUN_seed.sql`.
2. **Account vocabulary** (`facet_account`)
   - Team-specific terms promoted from the candidate queue.
   - Each record references the global kind and optionally links back to a global facet.
3. **Project view** (`project_facet`)
   - Enables/disables catalog entries per project.
   - Supports project-only facets (`scope = 'project'`, `facet_ref` starts with `p:`) and per-project aliases.

Resolution order shown in the UI + BAML: `project overrides → account facets → global seeds`.

## Interview Ingestion Pipeline

1. `processInterview.server.ts` loads the merged catalog via `getFacetCatalog(accountId, projectId)`.
2. The catalog is passed into `ExtractEvidenceFromTranscript`, so BAML can:
   - Prefer existing facets (`facet_ref` like `g:12` or `a:45`).
   - Emit per-person scales on the defined `scale` kind.
   - Produce `candidate` payloads when no safe match exists.
3. `persistFacetObservations` writes the results:
   - Matched facets go to `person_facet` (one row per person/facet pair).
   - Scales go to `person_scale` (normalised `0…1` score + optional band).
   - Candidates land in `facet_candidate` with evidence pointers for analyst review.

Every new candidate carries the originating person, evidence, synonyms, and free-form notes. Approving a candidate promotes it to `facet_account`, links it to the current project (via `project_facet`), and optionally seeds back the person-facet relationship.

## Managing the Catalog

Navigate to **Project → Facets** to:

- View the merged catalog for the current project.
- Enable/disable facets or set project-specific aliases.
- Review candidates generated from interviews.
- Approve (promote) or reject suggestions individually, or auto-approve the pending queue.

Approving a candidate will:

1. Create an account-level facet (unique slug per kind, per account).
2. Enable it for the current project.
3. Mark the candidate as `approved` and link it back to the new facet reference.
4. Optionally attach the facet to the originating person (if known).

Use the aliases/toggles to keep project language consistent without fragmenting the shared vocabulary.

## Tables Overview

| Table | Purpose |
| --- | --- |
| `facet_kind_global` | Canonical facet kinds (goal, pain, behavior, etc.). |
| `facet_global` | Seed facets shipped with the platform. |
| `facet_account` | Account-level terms promoted by analysts. |
| `project_facet` | Project overrides, aliases, and project-only facets. |
| `facet_candidate` | Queue of AI-suggested facets awaiting review. |
| `person_facet` | Person ↔ facet assignments with evidence + confidence. |
| `person_scale` | Person ↔ scale score (0–1) for behavioural spectra. |

## Developer Notes

- Use `getFacetCatalog` / `persistFacetObservations` for server logic.
- BAML contract lives in `baml_src/extract_evidence.baml`; ensure new fields stay in sync.
- Multi-tenant enforcement relies on RLS; always pass `accountId` + `projectId` when querying.
- Seeds for global kinds/facets live in `_NORUN_seed.sql` so local resets remain deterministic.
- UI state lives under `app/features/facets`; update that feature when adding new management flows.
- Automated verification lives in `app/lib/database/facets.server.test.ts` (catalog merge rules) and `app/utils/processInterview.server.integration.test.ts` (ingestion pipeline + persistence) — keep them aligned with schema changes.
