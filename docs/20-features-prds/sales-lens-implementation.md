# Sales Lens Implementation Guide

This document captures the current code-level implementation of the sales methodology lenses across storage, Trigger.dev tasks, and the Remix surface.

## Data model (Supabase)

The sales lens feature introduces dedicated tables defined in `supabase/schemas/42_sales_lens.sql`:

- `sales_lens_summaries` – one row per framework snapshot (BANT/GPCT, SPICED, MEDDIC, MAP). Stores attendee UUIDs, attendee person keys, unlinked attendee descriptors, hygiene rollups, and metadata.
- `sales_lens_slots` – slot-level values (e.g. "critical_event", "economic_buyer") including confidence, owners, related people, and linked evidence pointers.
- `sales_lens_stakeholders` – normalized roster of stakeholders for each summary. Tracks `person_id`, a stable `person_key`/`candidate_person_key` for unlinked attendees, labels (economic_buyer, influencer, etc.), influence, optional email, and evidence pointers.
- `sales_lens_hygiene_events` – generated hygiene issues and reminders tied to summaries/slots.

Each table is protected with RLS policies and timestamp triggers mirroring other account-scoped entities. The Supabase types (`supabase/types.ts`) were extended accordingly.

### Mini-CRM backbone

To keep lenses actionable we now lean on a light-weight CRM schema baked into the core tables:

- `people` adds canonical contact fields (`primary_email`, `primary_phone`, `linkedin_url`, `website_url`, `timezone`, `lifecycle_stage`, and `default_organization_id`). These cover the high-signal attributes surfaced in the UI, while richer qualitative traits continue to live in `person_facet`/`person_scale` for research-driven enrichment.
- `organizations` tracks `primary_contact_id`, hierarchical `parent_organization_id`, lifecycle metadata, and optional `crm_external_id` so we can pivot opportunities and write-backs cleanly into downstream tools.
- `opportunities` now stores pipeline-ready columns (`stage`, `forecast_category`, `amount`, `currency`, `close_date`, `next_step`, `next_step_due`, `confidence`, plus optional `source`/`crm_external_id` metadata) alongside primary contact and organization links.

The guiding principle is: **contact & pipeline atoms live on first-class tables, behavioral/segment data lives in facets.** That gives AEs instant access to key fields in the UI while keeping the facet catalog focused on evolving qualitative insights.

## Extraction builder (`app/utils/salesLens.server.ts`)

`buildInitialSalesLensExtraction` is the deterministic builder used by Trigger.dev and Remix actions.

Key points:

- It fetches the interview, attendees (`interview_people`), known `people`, and the first 12 evidence snippets.
- `decorateStakeholders` applies lightweight heuristics to label the highest influence attendees as `economic_buyer`/`decision_maker` and the runner-up as `influencer`, guaranteeing each stakeholder has a `personKey` for auto-linking.
- `attendeePersonKeys` mirrors `attendeePersonIds` so subsequent meetings can auto-match unknown attendees.
- Slot payloads and the next-step payload now carry both `ownerPersonId` and `ownerPersonKey`, letting downstream workflows keep context even when the CRM contact is missing.

## Persistence helper (`app/lib/sales-lens/storage.server.ts`)

`upsertSalesLensFromExtraction` receives raw task output, validates it with Zod, deletes prior rows for the interview, then inserts summaries, slots, stakeholders, and hygiene events in a single transaction-style flow. Notable behavior:

- Unlinked attendees are stored with `displayName`, `personKey`, and `candidatePersonKey` so the UI can request confirmation.
- Stakeholders are expanded into `sales_lens_stakeholders` rows, capturing linked `person_id`, influence, labels, and confidence, while preserving evidence pointers for traceability.
- The helper returns a lightweight `{ interviewId, frameworks }` payload to assist calling tasks with logging/analytics.

Because the base tables now own core CRM fields, `upsertSalesLensFromExtraction` expects stakeholder payloads that already include a `personId` when we can auto-link the attendee. Downstream write-backs can therefore map directly to pipeline entities without running secondary resolution queries.

## Trigger pipeline (`src/trigger/sales/generateSalesLens.ts`)

The Trigger.dev task `generateSalesLensTask` simply invokes `buildInitialSalesLensExtraction` and `upsertSalesLensFromExtraction`. It is triggered automatically from the interview evidence workflow and can now be invoked manually through the Remix action (see below).

## Remix route (`app/routes/_protected.projects.$projectId.sales-lenses.tsx`)

The loader assembles the latest summary per framework, joins slots and stakeholders, and hydrates:

- `framework.stakeholders` for the roster list (with influence, labels, link status, confidence, person key).
- `framework.unlinkedAttendees` listing outstanding attendees that still need person confirmation.
- `framework.attendeePersonKeys` for debugging/autolink visibility.

The `action` uses a Zod schema (`salesLensActionSchema`) to support two intents:

1. `refresh` – triggers `generateSalesLensTask` for a specific interview so the lens can be regenerated on-demand.
2. `commit` – placeholder hook for future CRM write-back. Currently returns a success envelope with a "coming soon" message.

Each card renders two fetcher-backed buttons (`Commit to CRM`, `Refresh lens`) and surfaces any action message inline.

## Auto-linking & review flow

- Every stored stakeholder is stamped with a `person_key` (either the Supabase person ID or a slug derived from the display name) to help dedupe and auto-suggest matches on subsequent meetings.
- The loader surfaces `unlinkedAttendees`, encouraging the AE to confirm matches before CRM write-back is enabled.
- `StakeholderList` highlights linked personas (`Linked to …`) and displays labels derived from the heuristic pass so risk and hygiene checks have structured inputs.
- Stakeholder rows now retain linked organization IDs when available, giving the upcoming CRM write-back flow immediate access to company context and owner metadata.

## Next steps

- Implement CRM write-back using the same action pathway (intent=`commit`).
- Extend hygiene generation to reference `sales_lens_stakeholders` (e.g., missing `economic_buyer`).
- Backfill historical interviews with person keys by re-running the Trigger.dev task.
