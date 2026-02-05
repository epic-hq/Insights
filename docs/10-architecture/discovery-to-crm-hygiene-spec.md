# Discovery-to-CRM Hygiene Copilot MVP Spec

## Purpose
This document describes the 60–90 day MVP that turns the existing interview ingestion pipeline into a "Discovery-to-CRM Hygiene Copilot" for mid-market SaaS account executives. The scope covers:

1. "Sales methodology lenses" that roll up evidence across every interview in a project and present the canonical BANT/GPCT, SPICED, MEDDIC, and MAP views.
2. A contract-first JSON schema that the AI extractor returns for each call so downstream code can map into CRM fields, emails, tasks, and dashboards deterministically.
3. Agentic post-meeting automations that draft notes, next steps, MAP updates, and follow-up emails as soon as an interview finishes processing.
4. A pilot-ready dashboard that proves CRM hygiene and sales velocity improvements with evidence-linked traceability.

The design builds on the current BAML-powered evidence extraction, Trigger.dev orchestration, and Supabase persistence that already populate `evidence`, `evidence_facet`, `people`, and `analysis_jobs` tables for every conversation.【F:app/utils/processInterview.server.ts†L488-L599】【F:docs/user-flow.md†L315-L325】 It also fits the Remix/Vite front end used across the app.【F:README.md†L1-L83】

## Current capabilities & constraints
- **Extraction pipeline.** `uploadMediaAndTranscribeTask` → `extractEvidenceAndPeopleTask` → `analyzeThemesAndPersonaTask` run inside Trigger.dev, updating the `analysis_jobs` progress log and persisting evidence/people records in Supabase.【F:src/trigger/interview/uploadMediaAndTranscribe.ts†L1-L104】【F:src/trigger/interview/extractEvidenceAndPeople.ts†L1-L66】【F:src/trigger/interview/analyzeThemesAndPersona.ts†L1-L86】 The core extractor already resolves evidence to project/account taxonomies (`FacetResolver`) and stores verbatims plus confidence metadata.【F:app/utils/processInterview.server.ts†L488-L599】
- **Data model.** The `evidence` table tracks verbatim quotes, pains, segments, and independence keys, and is linked through join tables to facets, people, and project answers.【F:supabase/types.ts†L716-L820】【F:docs/user-flow.md†L315-L325】 This gives us the raw ingredients to compute qualification fields and deal hygiene signals.
- **Job queue.** Supabase edge functions poll `analysis_jobs` and call back into the processing API, so any new automation must either piggy-back on these jobs or schedule follow-up Trigger tasks when the interview status flips to `ready`.【F:supabase/functions/analysis_worker/index.ts†L1-L105】
- **Front end.** The Remix + React Router stack already renders interview detail pages that aggregate evidence and personas; we can extend the same layouts/components for sales lenses and dashboards.【F:README.md†L1-L83】【F:docs/user-flow.md†L315-L325】

## MVP component 1 – Sales methodology lenses
### Objectives
Create a project-level aggregation view (“Lens”) for each supported methodology (BANT/GPCT, SPICED, MEDDIC, MAP). Each lens should:
- Summarize the latest extracted values (value + confidence + evidence link) for the methodology slots.
- Highlight gaps (missing owner, low confidence, stale evidence) that should trigger rep action.
- Feed CRM write-back and dashboards with the same normalized data.

### Data processing
1. **Extend extraction output.** Augment `extractEvidenceAndPeopleCore` to normalize evidence units into methodology fields by inspecting facet kinds, verbatim tags (pains, gains, timeline), and question mappings. Add a new helper `mapEvidenceToSalesFrameworks` that produces per-interview candidates with confidence scores and transcript spans. Store the raw candidates in a new JSONB column `sales_framework_snapshot` on `interviews` or a new table `interview_sales_frameworks` (one row per framework) to keep historical context.【F:app/utils/processInterview.server.ts†L488-L599】【F:supabase/types.ts†L716-L820】
2. **Project-level rollup.** Introduce a periodic Trigger task `aggregateSalesLensesTask` that runs whenever an interview reaches `status='ready'`. It queries all interviews for the project, merges framework candidates, and applies freshness/confidence tie-breakers (e.g., prefer the most recent interview with confidence ≥0.7, otherwise surface top two conflicting values). Use `analysis_jobs` metadata to only recompute affected projects, storing the result in a materialized view/table `project_sales_lenses` keyed by `project_id + framework` for quick retrieval.【F:src/trigger/interview/uploadMediaAndTranscribe.ts†L13-L104】【F:supabase/functions/analysis_worker/index.ts†L17-L105】
3. **Gap detection.** During aggregation, compute hygiene flags such as `missing_economic_buyer`, `no_next_step_within_24h`, `no_objection_logged`, using evidence timestamps and MAP data. Persist these booleans in `project_sales_lenses` so dashboards can highlight risks without recomputation.

### API & UI
- **Server loaders.** Add Remix loaders under `/app/features/sales-lenses` that fetch `project_sales_lenses` rows plus the linked evidence IDs to render methodology cards. Reuse existing evidence detail components so users can jump from a field to the underlying transcript.【F:docs/user-flow.md†L315-L325】
- **Lens interface.** Each lens card shows: current value, owner, due date, confidence, and an evidence chip linking to `evidence.id`. A side panel lists hygiene warnings and offers “Fix now” actions (open modal to edit field and trigger CRM write-back).
- **Agentic UX.** Embed a "Commit to CRM" button that calls a Trigger task to write the lens values into Salesforce/HubSpot once the user accepts, mirroring the existing post-processing update flow.

### Storage schema sketch
The first-pass sketch stored methodology slots directly on a single table, but it did not preserve the CRM references we need to
identify an economic buyer, influencer, or decision maker across interviews. A normalized design keeps provenance while making
people/organization/opportunity joins cheap.

```sql
create type sales_framework as enum ('BANT_GPCT','SPICED','MEDDIC','MAP');

create table sales_lens_summaries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  interview_id uuid references interviews(id) on delete cascade,
  framework sales_framework not null,
  source_kind text not null default 'interview',
  attendee_person_ids uuid[] not null default '{}',
  attendee_person_keys text[] not null default '{}',
  attendee_unlinked jsonb not null default '[]'::jsonb,
  hygiene_summary jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  computed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sales_lens_summaries_interview_framework_unique
  on sales_lens_summaries (framework, interview_id) where interview_id is not null;

create table sales_lens_slots (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references sales_lens_summaries(id) on delete cascade,
  slot text not null,
  label text,
  description text,
  text_value text,
  numeric_value numeric,
  date_value date,
  status text,
  confidence numeric,
  owner_person_id uuid references people(id) on delete set null,
  related_person_ids uuid[] not null default '{}',
  related_organization_ids uuid[] not null default '{}',
  evidence_refs jsonb not null default '[]'::jsonb,
  hygiene jsonb not null default '[]'::jsonb,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sales_lens_stakeholders (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references sales_lens_summaries(id) on delete cascade,
  account_id uuid not null references accounts.accounts(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  person_key text,
  candidate_person_key text,
  display_name text not null,
  role text,
  influence text check (influence in ('low','medium','high')) default 'low',
  labels text[] not null default '{}',
  organization_id uuid references organizations(id) on delete set null,
  email text,
  confidence numeric,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sales_lens_hygiene_events (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references sales_lens_summaries(id) on delete cascade,
  slot_id uuid references sales_lens_slots(id) on delete cascade,
  code text not null,
  severity text check (severity in ('info','warning','critical')),
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null
);
```

Each slot row carries `owner_person_id`, `related_person_ids`, and `related_organization_ids` so we can resurface the right CRM
records even when the extractor only produced a role or nickname. Hygiene events are their own table so we can show precise risk
chips ("No economic buyer" pointing at MEDDIC.economic_buyer) rather than opaque text arrays.

## MVP component 2 – Extractor JSON schema
Define the contract emitted after each interview so tasks, CRM mappers, and automations consume identical payloads.

### Schema goals
- Provide structured slots per methodology, plus generic entities (stakeholders, objections, next steps).
- Include evidence spans and confidence for auditability.
- Support multi-framework outputs in a single payload for A/B testing and analytics.

### Draft schema
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SalesConversationExtraction",
  "type": "object",
  "required": ["meeting_id", "project_id", "account_id", "frameworks", "entities", "next_step"],
  "properties": {
    "meeting_id": { "type": "string", "format": "uuid" },
    "project_id": { "type": "string", "format": "uuid" },
    "account_id": { "type": "string", "format": "uuid" },
    "opportunity_id": { "type": ["string", "null"], "format": "uuid" },
    "attendee_person_ids": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" }
    },
    "attendee_person_keys": {
      "type": "array",
      "items": { "type": "string" }
    },
    "frameworks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "slots"],
        "properties": {
          "name": { "enum": ["BANT_GPCT", "SPICED", "MEDDIC", "MAP"] },
          "hygiene": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["code", "severity"],
              "properties": {
                "code": { "type": "string" },
                "severity": { "enum": ["info", "warning", "critical"] },
                "message": { "type": ["string", "null"] },
                "slot": { "type": ["string", "null"] }
              }
            }
          },
          "slots": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["slot"],
              "properties": {
                "slot": { "type": "string" },
                "label": { "type": ["string", "null"] },
                "summary": { "type": ["string", "null"] },
                "text_value": { "type": ["string", "null"] },
                "numeric_value": { "type": ["number", "null"] },
                "date_value": { "type": ["string", "null"], "format": "date" },
                "status": { "type": ["string", "null"] },
                "confidence": { "type": ["number", "null"], "minimum": 0, "maximum": 1 },
                "owner_person_id": { "type": ["string", "null"], "format": "uuid" },
                "owner_person_key": { "type": ["string", "null"] },
                "related_person_ids": {
                  "type": "array",
                  "items": { "type": "string", "format": "uuid" }
                },
                "related_organization_ids": {
                  "type": "array",
                  "items": { "type": "string", "format": "uuid" }
                },
                "evidence": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["evidence_id"],
                    "properties": {
                      "evidence_id": { "type": "string", "format": "uuid" },
                      "start_ms": { "type": ["integer", "null"], "minimum": 0 },
                      "end_ms": { "type": ["integer", "null"], "minimum": 0 },
                      "transcript_snippet": { "type": ["string", "null"] }
                    }
                  }
                },
                "hygiene": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["code", "severity"],
                    "properties": {
                      "code": { "type": "string" },
                      "severity": { "enum": ["info", "warning", "critical"] },
                      "message": { "type": ["string", "null"] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "entities": {
      "type": "object",
      "properties": {
        "stakeholders": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["display_name"],
            "properties": {
              "person_id": { "type": ["string", "null"], "format": "uuid" },
              "person_key": { "type": ["string", "null"] },
              "candidate_person_key": { "type": ["string", "null"] },
              "display_name": { "type": "string" },
              "role": { "type": ["string", "null"] },
              "influence": { "enum": ["low", "medium", "high"], "default": "low" },
              "labels": {
                "type": "array",
                "items": { "enum": ["economic_buyer", "influencer", "champion", "blocker", "decision_maker"] }
              },
              "organization_id": { "type": ["string", "null"], "format": "uuid" },
              "email": { "type": ["string", "null"], "format": "email" },
              "confidence": { "type": ["number", "null"], "minimum": 0, "maximum": 1 },
              "evidence": { "$ref": "#/properties/frameworks/items/properties/slots/items/properties/evidence" }
            }
          }
        },
        "objections": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["type", "status", "confidence"],
            "properties": {
              "type": { "enum": ["price", "timing", "integration", "security", "authority", "other"] },
              "status": { "enum": ["raised", "resolved", "open"] },
              "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
              "evidence": { "$ref": "#/properties/frameworks/items/properties/slots/items/properties/evidence" }
            }
          }
        }
      }
    },
    "next_step": {
      "type": "object",
      "required": ["description", "confidence"],
      "properties": {
        "description": { "type": "string" },
        "owner_person_id": { "type": ["string", "null"], "format": "uuid" },
        "owner_person_key": { "type": ["string", "null"] },
        "due_date": { "type": ["string", "null"], "format": "date" },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "evidence": { "$ref": "#/properties/frameworks/items/properties/slots/items/properties/evidence" }
      }
    },
    "map": {
      "type": "object",
      "properties": {
        "milestones": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["label"],
            "properties": {
              "label": { "type": "string" },
              "owner_person_id": { "type": ["string", "null"], "format": "uuid" },
              "owner_person_key": { "type": ["string", "null"] },
              "due_date": { "type": ["string", "null"], "format": "date" },
              "status": { "enum": ["planned", "in_progress", "done"] },
              "evidence": { "$ref": "#/properties/frameworks/items/properties/slots/items/properties/evidence" }
            }
          }
        }
      }
    }
  }
}
```

### Integration plan
- Mirror the JSON contract with a canonical Zod schema (`app/lib/sales-lens/schema.ts`) so Trigger tasks, Remix loaders, and server utilities can share one validator. That schema enforces cross-field requirements such as “slot owner must provide either a `person_id` or `owner_person_key`.”【F:app/utils/processInterview.server.ts†L488-L599】
- Store the validated JSON alongside each interview (`interviews.sales_extraction_payload`) for replay/debug.
- Feed the same payload into CRM mappers and Trigger tasks so write-back, automations, and dashboards stay consistent.

## MVP component 3 – Post-meeting automations
### Trigger points
- When `extractEvidenceAndPeopleTask` completes and returns evidence IDs, schedule a new Trigger.dev workflow `postMeetingAutomationTask`. It consumes the JSON schema payload, enriches with CRM context, and performs downstream actions.【F:src/trigger/interview/uploadMediaAndTranscribe.ts†L61-L104】【F:src/trigger/interview/extractEvidenceAndPeople.ts†L1-L66】

### Actions
1. **Review & commit notification.** Send the AE a Slack/Email summary with the five key bullets (pain, stakeholders, objection, next step, MAP link) plus “Commit to CRM” and “Edit before sending” options. (Email templates can reuse the existing `emails/` setup; extend with new React email templates.)
2. **CRM write-back.** If the user approves, call CRM-specific adapters to update opportunity fields, attach evidence-linked notes, and create tasks using the schema payload. Build adapters under `app/lib/crm/` with providers for Salesforce, HubSpot, Pipedrive.
3. **Follow-up email draft.** Generate a buyer-ready recap using the MAP milestones, send through the email provider, and log the engagement in Supabase (e.g., `sales_followups` table storing status, send timestamp, and linked evidence IDs).
4. **MAP sync.** Publish a lightweight shared MAP page using existing Remix routes; updates flow back into Supabase and re-trigger hygiene checks.
5. **Agentic reminders.** Schedule follow-up Trigger tasks (e.g., 24h after meeting) to re-check if next steps were completed; if not, DM the AE with suggested remedial actions.

### Implementation notes
- Leverage Trigger.dev metadata tracking to surface automation progress inside the UI (reusing the metadata pattern already present in `uploadMediaAndTranscribeTask`).【F:src/trigger/interview/uploadMediaAndTranscribe.ts†L20-L78】
- Use Supabase row-level security aware service clients (as in existing tasks) to insert audit logs for each automation step, ensuring traceability and compliance.【F:src/trigger/interview/analyzeThemesAndPersona.ts†L11-L85】

## MVP component 4 – Pilot dashboard
### Audience & objectives
Provide RevOps leaders a single dashboard showing ROI during a 14-day pilot: time saved, field completeness, next-step discipline, stage velocity, and top hygiene risks.

### Data sources
- `project_sales_lenses` aggregation for framework completeness and gap flags.
- CRM integration logs for write-back success/failure counts.
- Interview-level timestamps from `analysis_jobs` and `interviews` to compute time-to-next-step metrics.【F:supabase/functions/analysis_worker/index.ts†L17-L105】
- Evidence counts and transcript links from `evidence` to prove coverage.【F:supabase/types.ts†L716-L820】

### Layout
1. **Hero metrics.** Cards for time saved/week, % opportunities with next step <24h, stakeholder coverage, and hygiene score. Include spark lines using last 14 days of interviews.
2. **Hygiene heatmap.** Grid of reps vs methodology slots showing completeness (% with confidence ≥0.7). Click opens the relevant lens with evidence.
3. **Deal risk list.** Table of opportunities missing critical slots (economic buyer, critical event). Each row offers “Fix now” buttons that deep-link to the lens edit modal.
4. **Evidence trust module.** Histogram of entries by confidence bucket and a transcript preview viewer to reinforce reliability.
5. **Automation insights.** Timeline of agentic tasks triggered (emails sent, reminders fired) with status badges.

### Delivery plan
- Implement as a Remix route under `/projects/:id/sales-dashboard`, using server loaders to fetch aggregated rows plus CRM stats. Reuse Tailwind and Shadcn UI primitives already in the stack.【F:README.md†L1-L83】
- Subscribe to Supabase realtime channels (`analysis_jobs`, `interviews`) so the dashboard updates as soon as new interviews finish processing, similar to existing interview detail pages.【F:docs/user-flow.md†L315-L325】

## Sequencing & timeline (60–90 days)
1. **Weeks 1–2:** Finalize JSON schema, implement extraction validation, and backfill historical interviews with schema payloads.
2. **Weeks 3–4:** Build per-interview framework snapshots and the `aggregateSalesLensesTask`; expose a basic internal API.
3. **Weeks 5–6:** Layer the post-meeting automation workflow, CRM adapters, and approval UX.
4. **Weeks 7–8:** Ship the pilot dashboard with hygiene metrics, gap detection, and realtime updates.
5. **Weeks 9–10:** Harden agentic loops (reminders, MAP sync), polish UI, collect pilot instrumentation.

## Risks & mitigations
- **Schema drift.** Mitigate by generating TypeScript types from the JSON schema and linting Trigger tasks against them.【F:app/utils/processInterview.server.ts†L488-L599】
- **CRM write-back variance.** Start with a sandbox/starter CRM inside Supabase for pilots, then enable provider adapters once stable.
- **Confidence thresholds.** Follow the existing `confidence >= 0.7` heuristic for auto-write and fall back to user approval below that threshold.

## Open questions
- Which email provider should power follow-ups (Resend, SendGrid)?
- Do we require calendar integration at MVP, or can we bootstrap with manual scheduling data?
- Should MAP milestones be shared externally via authenticated links or within the app only?
