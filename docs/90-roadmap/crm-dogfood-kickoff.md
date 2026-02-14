# CRM Dogfood Kickoff: Gap Analysis & BMad Input

**Purpose:** Map the Claude-generated CRM MVP spec against what UpSight already has, identify true gaps, and prepare context for BMad spec sessions.

**Date:** February 7, 2026

---

## What Already Exists (Don't Rebuild This)

### Database Tables

| Entity | Table | Status | Notes |
|--------|-------|--------|-------|
| **People** | `people` | ✅ Rich | firstname, lastname, title, role, company, email, phone, linkedin, lifecycle_stage, segment, image_url, contact_info jsonb |
| **Organizations** | `organizations` | ✅ Rich | industry, size_range, funding_stage, revenue, domain, lifecycle_stage, crm_external_id |
| **Opportunities** | `opportunities` | ✅ Rich | stage, kanban_status, amount, close_date, next_step, next_step_due, confidence, forecast_category, primary_contact_id, organization_id |
| **People ↔ Orgs** | `people_organizations` | ✅ Junction | role, is_primary, started_at, ended_at |
| **People ↔ Interviews** | `interview_people` | ✅ Junction | Links conversations to people |
| **People ↔ Evidence** | `evidence_people` | ✅ Junction | Links evidence clips to people |
| **People ↔ Personas** | `people_personas` | ✅ Junction | confidence_score, source |
| **People ↔ Projects** | `project_people` | ✅ Junction | With stats tracking |
| **Orgs ↔ Interviews** | `interview_organizations` | ✅ Junction | Links conversations to orgs |
| **Annotations** | `annotations` | ✅ Polymorphic | Attaches to any entity (opportunity, person, etc.) |
| **Tasks** | `tasks` | ✅ Exists | Linked to insights, opportunities, evidence |
| **Sales Lens** | `sales_lens_summaries`, `sales_lens_slots`, `sales_lens_stakeholders` | ✅ Schema exists | BANT/MEDDIC/SPICED/MAP framework extraction |

### UI Features

| Feature | Route/Component | Status |
|---------|----------------|--------|
| **People list** | `app/features/people/pages/index.tsx` | ✅ Table + card views, search, filter by org, segment inference |
| **People detail** | `app/features/people/pages/detail.tsx` | ✅ Profile, linked interviews, evidence, personas |
| **Opportunities list** | `app/features/opportunities/pages/index.tsx` | ✅ Kanban by stage + calendar by month, pipeline totals |
| **Opportunity detail** | `app/features/opportunities/pages/opportunityDetail.tsx` | ✅ Stakeholder matrix, next steps, AI deal advisor, inline editing |
| **Opportunity creation** | `app/features/opportunities/pages/new.tsx` | ✅ Form with stage selection |
| **Stage config** | `app/features/opportunities/stage-config.ts` | ✅ Customizable per-account, 8 default stages |
| **Organizations** | `app/features/organizations/` | ✅ List + detail views |

### Mastra Agent Tools (Already Built)

| Tool | File | What It Does |
|------|------|-------------|
| `create-opportunity` | `manage-opportunities.ts` | Creates opportunity with all fields |
| `update-opportunity` | `manage-opportunities.ts` | Updates stage, amount, next step, etc. |
| `manage-people` | `manage-people.ts` | CRUD for people records |
| `manage-organizations` | `manage-organizations.ts` | CRUD for org records |
| `manage-person-organizations` | `manage-person-organizations.ts` | Link people to orgs |
| `manage-tasks` | `manage-tasks.ts` | Create/update tasks |
| `manage-annotations` | `manage-annotations.ts` | Add notes to any entity |
| `fetch-people-details` | `fetch-people-details.ts` | Get person with all relationships |
| `fetch-evidence` | `fetch-evidence.ts` | Get evidence clips |
| `import-people-from-table` | `import-people-from-table.ts` | Bulk import people |
| `import-opportunities-from-table` | `import-opportunities-from-table.ts` | Bulk import opportunities |
| `research-organization` | `research-organization.ts` | Research org via web |
| `research-company-website` | `research-company-website.ts` | Scrape company info |
| `recommend-next-actions` | `recommend-next-actions.ts` | AI recommendations |

### Existing Documentation

| Doc | Path | Relevance |
|-----|------|-----------|
| Discovery-to-CRM Hygiene Spec | `docs/10-architecture/discovery-to-crm-hygiene-spec.md` | 362-line spec for sales methodology lenses, JSON schema, post-meeting automations |
| CRM Workflow Guide | `docs/40-user-guides/crm-workflow.md` | 271-line user guide for the existing CRM workflow |
| CRM Value Prop | `docs/50-market/customer-centric-crm-value-prop.md` | 706-line positioning doc with entity model, user journeys, competitive analysis |
| CRM Opportunities Guide | `docs/40-user-guides/user-guides/crm-opportunities-guide.md` | User-facing guide |

---

## True Gaps (What the Claude Spec Proposes That We DON'T Have)

### Gap 1: Follow-Up Nudges & Staleness Alerts

**Claude spec says:** Daily digest of follow-ups due, staleness alerts, agent-suggested actions.

**What exists:** `opportunities.next_step` and `next_step_due` fields exist. No scheduled check or notification system.

**What to build:**
- New agent tool: `check-followups` — queries people/opportunities with overdue `next_step_due` or stale `last_interaction`
- Trigger.dev scheduled task to run daily or on session start
- Surface in AI assistant panel (already has "3 prioritized tasks" pattern)

**Complexity:** Low-Medium. Mostly a new Mastra tool + scheduled trigger task.

### Gap 2: ICP Match Scoring

**Claude spec says:** Score contacts against active ICP profiles, surface top matches.

**What exists:** ICP builder exists in onboarding. `people` has segment data. No scoring mechanism.

**What to build:**
- New agent tool: `score-contact-icp` — compares person fields against ICP definitions
- Store score on people record (add `icp_match_score numeric` column or use metadata jsonb)
- Recalculate after conversation enrichment
- Surface in people list as sortable column

**Complexity:** Medium. Needs ICP definition schema + scoring algorithm.

### Gap 3: Suggest Stage Change (Evidence-Based)

**Claude spec says:** After conversation analysis, suggest pipeline stage transitions with evidence.

**What exists:** Sales lens extraction already identifies BANT signals, stakeholders, objections. Stage config is customizable. AI deal advisor gives recommendations via annotations.

**What to build:**
- New agent tool: `suggest-stage-change` — evaluates latest sales lens data + evidence signals, proposes stage transition with reasoning
- UI: confirmation prompt on opportunity detail ("Based on your last call, Sarah mentioned budget approval — move to Evaluation?")
- Log stage changes with evidence references in annotations

**Complexity:** Medium. The data is there; needs the decision logic + UI prompt.

### Gap 4: Contact Enrichment from Conversations (Auto-Update)

**Claude spec says:** After each conversation, auto-extract and suggest updates to contact record (pain points, competitors, timeline, objections).

**What exists:** Evidence extraction runs on every conversation. People are linked to interviews. Sales lens extracts stakeholders and signals. But extracted data doesn't flow BACK to update the person record.

**What to build:**
- Post-processing step after lens analysis: extract signals and propose person field updates
- "Suggested updates" UI on person detail (accept/dismiss pattern, like AI deal advisor)
- New agent tool: `enrich-contact-from-conversation` — runs after transcript analysis

**Complexity:** Medium-High. Needs careful UX for accept/dismiss flow.

### Gap 5: Quick Capture (Voice-First Contact Creation)

**Claude spec says:** "Add contact Sarah Chen from Acme, met at Focus26" → agent parses into structured fields.

**What exists:** `create-people` Mastra tool exists. AI assistant panel exists. No voice-first capture flow.

**What to build:**
- This is mostly a prompt engineering task — the Chief of Staff agent already has `manage-people` tool
- Add a "Quick Add Contact" action to the AI assistant panel
- Voice input already works via the AI chat interface

**Complexity:** Low. Mostly UX polish + prompt tuning.

---

## What to SKIP from the Claude Spec

These are already built or not needed:

| Claude Spec Feature | Why Skip |
|-------------------|----------|
| Contact data model | ✅ `people` table is richer than the spec |
| Organization model | ✅ `organizations` table already exists |
| Pipeline stages | ✅ Customizable stage config already exists |
| Interaction log / timeline | ✅ `interview_people` + `evidence_people` + `annotations` already provide this |
| Contact list view | ✅ People index page with table/card views exists |
| Contact detail view | ✅ People detail page with evidence, interviews, personas exists |
| Conversation → Contact linking | ✅ `interview_people` junction + post-processing already links people |
| Pipeline board view | ✅ Opportunities kanban exists |
| Search contacts | ✅ People index has search |
| Stakeholder tracking | ✅ Sales lens stakeholders table exists |
| AI deal advisor | ✅ Opportunity detail has AI recommendations via annotations |

---

## B2B + B2C Considerations

The Claude spec is B2B-focused (deals, pipeline, stakeholders). UpSight must work for both:

| Aspect | B2B | B2C |
|--------|-----|-----|
| **Pipeline** | Multi-stakeholder deals with stages | Individual customer journeys |
| **Contacts** | Linked to organizations | Standalone individuals |
| **Scoring** | ICP match against company profile | ICP match against individual attributes |
| **Follow-ups** | Deal-driven cadence | Relationship/retention cadence |
| **Evidence** | Qualification signals (BANT) | Satisfaction/churn signals |

**Design principle:** The 5 new tools should work regardless of whether a person has an organization. Don't require `organization_id` for any CRM feature.

---

## BMad Spec Plan

### Recommended Approach: Quick Spec (not full flow)

This is **not** a greenfield feature. It's 5 targeted additions to an existing, rich CRM foundation. A quick spec is appropriate.

### BMad Session Setup

Start a fresh agent session with this context:

```
Read these files for existing CRM context:
1. docs/90-roadmap/crm-dogfood-kickoff.md (this file — gap analysis)
2. docs/10-architecture/discovery-to-crm-hygiene-spec.md (existing CRM architecture)
3. docs/50-market/customer-centric-crm-value-prop.md (entity model, user journeys)
4. docs/_information_architecture.md (system-wide IA)
5. supabase/schemas/12_core_tables.sql (people + organizations schema)
6. supabase/schemas/32_opportunities.sql (opportunities schema)
7. app/mastra/tools/manage-opportunities.ts (existing agent tools)

Then run /bmad-quick-spec for: CRM Dogfood MVP — 5 new capabilities:
1. check-followups (scheduled follow-up nudges)
2. score-contact-icp (ICP match scoring)
3. suggest-stage-change (evidence-based stage transitions)
4. enrich-contact-from-conversation (auto-update contacts post-call)
5. Quick capture UX for voice-first contact creation

Requirements:
- Must work for B2B AND B2C (don't require organization_id)
- Build as Mastra agent tools + Trigger.dev scheduled tasks
- Surface in existing AI assistant panel and entity detail pages
- Reuse existing tables where possible (annotations for suggestions, metadata jsonb for scores)
```

### Priority Order for Implementation

| # | Feature | Effort | Dogfood Value |
|---|---------|--------|---------------|
| 1 | `check-followups` | 1 day | Highest — daily driver |
| 2 | `suggest-stage-change` | 2 days | High — evidence-based pipeline |
| 3 | `score-contact-icp` | 2 days | High — prioritize outreach |
| 4 | Quick capture UX | 1 day | Medium — convenience |
| 5 | `enrich-contact-from-conversation` | 3 days | Medium-High — but complex UX |

**Total estimated effort:** ~9 days of implementation (after spec)

---

## Success Criteria (from Claude spec, adapted)

Rick can answer these from UpSight within 30 seconds:

1. ✅ Who do I need to follow up with today? → `check-followups`
2. ✅ What did [person] tell me in our last conversation? → Already works (person detail + evidence)
3. ✅ Which contacts best match my target ICP? → `score-contact-icp`
4. ✅ What stage is [person] in, and what evidence supports that? → `suggest-stage-change`
5. ✅ Who haven't I talked to in over 2 weeks? → `check-followups` (staleness)
