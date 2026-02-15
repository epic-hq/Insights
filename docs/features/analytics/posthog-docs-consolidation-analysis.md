# PostHog Documentation Consolidation Analysis

> **Date**: 2026-02-15
> **Purpose**: Audit existing PostHog documentation, identify duplication/drift/gaps, and propose a consolidation plan

---

## 1. Current State: Documentation Inventory

### Location A: `docs/70-PLG/` (Strategy Layer)

| File | Purpose | Lines | Last Role |
|------|---------|-------|-----------|
| `strategy/activation-strategy.md` | Reverse trial design, campaign flows, feature gates | 382 | Strategy + some implementation |
| `strategy/instrumentation-plan.md` | Full event taxonomy, user journey stages, cohorts, code patterns | 743 | Strategy + implementation + reference |
| `nurture/plan.md` | Unified PLG nurture plan (self-described "single source of truth") | 189 | Orchestration / index |
| `nurture/brevo-setup.md` | Brevo integration, PostHog cohort config, webhook setup | 640 | Implementation |
| `nurture/email-sequences.md` | Full email content for 18 templates | 1205 | Content / design |
| `nurture/dashboard-spec.md` | PostHog dashboard configuration | 84 | Operations |

### Location B: `docs/60-ops-observability/` (Operations Layer)

| File | Purpose | Lines | Last Role |
|------|---------|-------|-----------|
| `posthog-tracking.md` | Event naming conventions, core event definitions, cohorts, checklist | 294 | Reference |
| `posthog-events-implemented.md` | Catalog of 21 implemented events with exact properties and file locations | 662 | Reference (ground truth) |
| `posthog-implementation-summary.md` | How `account_signed_up` was implemented (auth flow explanation) | 207 | Historical / tutorial |
| `posthog-setup-guide.md` | Step-by-step PostHog dashboard setup (funnels, cohorts, alerts) | 200 | Operations |

### Location C: `docs/features/analytics/` -- Empty

No files exist here yet. This was the planned destination for a new server-side implementation guide.

---

## 2. Duplication Map

The following content is duplicated across two or more files:

### Event Definitions (3-way duplication)

| Content | `instrumentation-plan.md` | `posthog-tracking.md` | `posthog-events-implemented.md` |
|---------|---------------------------|----------------------|-------------------------------|
| `account_signed_up` properties | Yes (Section 6A) | Yes (Section 1) | Yes (Section 1) -- most current |
| `project_created` properties | Yes (Section 6C) | Yes (Section 2) | Yes (Section 2) -- most current |
| `interview_added` properties | Yes (Section 6D) | Yes (Section 3) | Yes (Section 3) -- most current |
| `invite_sent/accepted` properties | Yes (Section 6L) | Yes (Section 6) | Yes (Sections 4-5) -- most current |
| Naming conventions | Yes (Section 6) | Yes (top) | Implicit |
| Implementation checklist | Yes (Section 9) | Yes (bottom) | Yes (bottom "Next Steps") |

**Drift detected**: `posthog-tracking.md` lists `project_created` location as "TBD" and `invite_sent` role as "admin/member/viewer", while `posthog-events-implemented.md` shows the actual implemented locations and the real role enum ("owner/member"). The tracking guide was written before implementation and never updated.

### Cohort Definitions (3-way duplication)

| Content | `instrumentation-plan.md` | `posthog-tracking.md` | `brevo-setup.md` | `nurture/plan.md` |
|---------|---------------------------|----------------------|-------------------|-------------------|
| `lc-new-no-content` | Yes | No | Yes (detailed) | Yes (summary) |
| `lc-dormant-14d` | Yes | Yes | Yes (detailed) | Yes (summary) |
| `lc-power-user` | Yes | Yes | Yes (detailed) | Yes (summary) |
| `lc-stalled-no-insight` | Yes | No | Yes (detailed) | Yes (summary) |
| Role cohorts | No | Yes | No | No |
| Value cohorts | Yes | Yes | No | No |
| Trial cohorts | No | No | Yes (detailed) | Yes (summary) |

**Drift detected**: `posthog-tracking.md` defines `lc-power-user` as ">=10 events in last 7 days" while `instrumentation-plan.md` and `brevo-setup.md` define it as "3+ sessions/week, 5+ tasks completed". The actual implementation in `updateUserMetrics.ts` uses `taskCompletedCount >= 5` (no session counting).

### Person Properties (2-way duplication)

| Content | `instrumentation-plan.md` | `brevo-setup.md` |
|---------|---------------------------|-------------------|
| Full UserProperties interface | Yes (Section 7) | No |
| Person properties table | Yes (subset) | Yes (subset, different format) |
| Activation definition code | Yes | No (prose only) |

### Code Patterns (2-way duplication)

| Content | `instrumentation-plan.md` | `posthog-implementation-summary.md` |
|---------|---------------------------|-------------------------------------|
| Server-side capture pattern | Yes (Section 10) | Yes (slightly different) |
| Identify pattern | Yes (Section 10) | Yes |
| Error handling pattern | No | Yes |
| `checkIfNewUser` logic | No | Yes (detailed) |

### PostHog Dashboard/Funnel Setup (2-way duplication)

| Content | `instrumentation-plan.md` | `posthog-setup-guide.md` | `dashboard-spec.md` |
|---------|---------------------------|--------------------------|---------------------|
| Activation funnel | Yes (Section 11) | Yes (Section 2) | Yes (Sections 4-5) |
| Billing funnel | No | Yes (Section 6) | Yes (Section 6) |
| Retention analysis | No | Yes (Section 3) | No |
| Dashboard tiles | No | Yes (Section 4) | Yes (Sections 1-3) |

---

## 3. Broken Cross-References

| Source File | Broken Link | Actual Location |
|-------------|-------------|-----------------|
| `nurture/email-sequences.md` line 8 | `../../60-ops-observability/email-campaigns-setup.md` | Does not exist |
| `nurture/email-sequences.md` line 1199 | `../../60-ops-observability/email-campaigns-setup.md` | Does not exist |
| `nurture/email-sequences.md` line 1200 | `../../60-ops-observability/activation-strategy.md` | Does not exist (it is at `../strategy/activation-strategy.md`) |
| `nurture/email-sequences.md` line 1201 | `../../60-ops-observability/plg-instrumentation-plan.md` | Does not exist (it is at `../strategy/instrumentation-plan.md`) |
| `updateUserMetrics.ts` line 16 | `docs/60-ops-observability/plg-instrumentation-plan.md` | Does not exist (it is at `docs/70-PLG/strategy/instrumentation-plan.md`) |

---

## 4. Gaps Identified

### Missing from Documentation

1. **No unified "what is implemented vs. what is planned" view**: `posthog-events-implemented.md` lists 21 done events, but `instrumentation-plan.md` lists ~50+ planned events. No single place shows the delta or priority for the remaining ~30 events.

2. **No server-side implementation guide with ready-to-copy code**: The instrumentation plan has example code patterns, but they are generic templates, not mapped to specific file locations with the actual import paths and context access patterns used in this codebase.

3. **No mapping of events to PLG impact**: Events are listed taxonomically (by domain: auth, interviews, surveys, etc.) but not by PLG stage impact (which events drive activation? which drive retention?).

4. **No operational runbook**: `posthog-setup-guide.md` covers initial setup but nothing about monitoring, debugging missing events, or validating data quality.

5. **Missing events with high PLG value** that are already trackable:
   - `survey_response_received` -- exists in plan but not implemented
   - `survey_ai_analyzed` -- exists in plan but not implemented
   - `lens_applied` / `custom_lens_created` -- exist in plan but not implemented
   - `contacts_imported` -- exists in plan but not implemented
   - `agent_message_sent` -- exists in plan but not implemented
   - `session_started` -- exists in plan but not implemented

### Code vs. Documentation Mismatches

| Aspect | Documentation Says | Code Actually Does |
|--------|-------------------|-------------------|
| PostHog client function name | `getPostHogServer()` (instrumentation plan) | `getPostHogServerClient()` (`posthog.server.ts`) |
| `posthog-tracking.md` plan value | `"free" \| "pro" \| "enterprise"` | `"free" \| "starter" \| "pro" \| "team"` (actual) |
| `hasViewedAnalysis` | Should check PostHog events | Uses `interviewCount > 0` as proxy (TODO in code) |
| `hasUsedAgent` | Should check PostHog events | Hardcoded `false` (TODO in code) |

---

## 5. Strategic Alignment Assessment

### How Server-Side Tracking Supports PLG Goals

The PLG strategy (defined in `activation-strategy.md` and `instrumentation-plan.md`) depends entirely on server-side event tracking for:

1. **Activation measurement**: Cannot measure D14 activation rate without `interview_detail_viewed`, `survey_results_viewed`, and `task_completed` events
2. **Stall point detection**: Cohorts like `lc-new-no-content` and `lc-content-not-viewed` depend on events being captured reliably
3. **Brevo email triggers**: The entire nurture automation chain flows from PostHog person properties (set by `updateUserMetricsTask`) through the CDP to Brevo
4. **Conversion funnels**: Billing events (`checkout_started`, `checkout_completed`) feed the conversion funnel

Without comprehensive server-side tracking, the PLG strategy cannot execute.

### Current Coverage Assessment

Of the events required for the PLG intervention matrix:

| PLG Intervention | Required Events | Status |
|-----------------|-----------------|--------|
| "Create a survey" nudge (D2) | `account_signed_up` + no `survey_created` | Partially covered (signup done, survey_created done) |
| "See what we found" nudge | `interview_detail_viewed` | Done |
| "Analyze with AI" nudge | `survey_response_received`, `survey_ai_analyzed` | NOT implemented |
| "Turn insights into action" nudge | `insight_viewed`, `task_created`, `task_completed` | Done |
| "Add contacts" nudge | `contacts_imported` | NOT implemented |
| "Ask the agent" nudge | `agent_message_sent` | NOT implemented |
| Reverse trial grant | `interview_added` (count) | Done (via metrics task) |
| Upgrade prompt | Usage tracking | Partial (`billing_page_viewed`, `checkout_*` done) |

**Coverage: ~60% of PLG-critical events are implemented.**

---

## 6. Information Architecture Assessment

### Current Problem

Documentation is organized by **team concern** (ops vs. PLG) rather than by **content type**. This creates a situation where:

- A developer looking to implement a new event must read 4+ files to understand naming conventions, what is already implemented, where to add code, and which PLG goal the event serves
- A strategist reviewing PLG progress must cross-reference the instrumentation plan with the events-implemented doc to understand coverage
- The nurture plan (`plan.md`) tries to be a "single source of truth" but actually just points to 6 other docs

### Root Cause

The docs grew organically: `posthog-implementation-summary.md` was written when the first event (`account_signed_up`) was implemented. Then `posthog-tracking.md` was written as a forward-looking plan. Then `posthog-events-implemented.md` was created as the catalog grew. Then `instrumentation-plan.md` was written with a PLG lens. Each new doc partially superseded the previous ones without consolidating.

---

## 7. Proposed Consolidation Plan

### Principle: Separate by Content Type, Not Team

| Content Type | Home | Audience | Update Cadence |
|-------------|------|----------|----------------|
| **Strategy** (why, what to measure, PLG goals) | `docs/70-PLG/` | Product, leadership | Quarterly |
| **Implementation** (how to add events, code patterns, event catalog) | `docs/features/analytics/` | Developers | Per-sprint |
| **Operations** (dashboards, monitoring, troubleshooting) | `docs/60-ops-observability/` | Ops, all | Monthly |
| **Nurture** (email content, Brevo config) | `docs/70-PLG/nurture/` | Marketing, product | Per-campaign |

### Specific File Actions

#### KEEP (no changes needed)

| File | Reason |
|------|--------|
| `docs/70-PLG/strategy/activation-strategy.md` | Strategy doc -- already well-scoped to reverse trial design and campaign flows |
| `docs/70-PLG/nurture/email-sequences.md` | Content doc -- email templates are a separate concern (fix broken links only) |
| `docs/70-PLG/nurture/dashboard-spec.md` | Operations doc -- but should move to `60-ops-observability/` |

#### CONSOLIDATE (merge into new files)

| Old Files | New File | What Merges |
|-----------|----------|-------------|
| `posthog-tracking.md` + `posthog-events-implemented.md` + event sections from `instrumentation-plan.md` | `docs/features/analytics/posthog-server-implementation-guide.md` | All event definitions, properties, file locations, code patterns, and implementation status into one developer-facing guide |
| `posthog-implementation-summary.md` | Archived / deleted | Historical context about first event -- superseded by the comprehensive events-implemented doc |
| `posthog-setup-guide.md` + `dashboard-spec.md` | `docs/60-ops-observability/posthog-dashboards-and-setup.md` | All PostHog configuration, dashboard setup, and monitoring guidance |

#### UPDATE (content changes to existing files)

| File | Changes |
|------|---------|
| `docs/70-PLG/strategy/instrumentation-plan.md` | Remove event definitions (Section 6) and code patterns (Section 10) that now live in implementation guide. Keep strategy sections: business objectives, journey stages, user flows, behavioral triggers, cohort definitions, success metrics, timeline. Add link to new implementation guide. |
| `docs/70-PLG/nurture/plan.md` | Update cross-references to point to consolidated docs. Remove duplicate cohort definitions. |
| `docs/70-PLG/nurture/brevo-setup.md` | Fix cross-references. Keep Brevo-specific config. Remove PostHog cohort definitions (link to instrumentation plan instead). |
| `docs/70-PLG/nurture/email-sequences.md` | Fix 3 broken cross-references. |
| `docs/70-PLG/README.md` | Update file references to reflect new structure. |

#### MOVE

| File | From | To |
|------|------|----|
| `docs/70-PLG/nurture/dashboard-spec.md` | PLG nurture | `docs/60-ops-observability/posthog-dashboards-and-setup.md` (merged) |

#### DELETE (after consolidation)

| File | Reason |
|------|--------|
| `docs/60-ops-observability/posthog-tracking.md` | Superseded by consolidated implementation guide |
| `docs/60-ops-observability/posthog-events-implemented.md` | Superseded by consolidated implementation guide |
| `docs/60-ops-observability/posthog-implementation-summary.md` | Historical document, content absorbed into implementation guide |
| `docs/60-ops-observability/posthog-setup-guide.md` | Merged into dashboards-and-setup doc |

### Resulting Structure

```
docs/
  70-PLG/
    README.md                           # Updated references
    strategy/
      activation-strategy.md            # Unchanged (strategy)
      instrumentation-plan.md           # Trimmed (strategy only, links to implementation guide)
    nurture/
      plan.md                           # Updated references
      brevo-setup.md                    # Fixed references, removed PostHog cohort dupe
      email-sequences.md                # Fixed broken links
      dashboard-spec.md                 # REMOVED (moved to ops)

  60-ops-observability/
    posthog-dashboards-and-setup.md     # NEW: merged setup guide + dashboard spec
    (posthog-tracking.md)               # DELETED
    (posthog-events-implemented.md)     # DELETED
    (posthog-implementation-summary.md) # DELETED
    (posthog-setup-guide.md)            # DELETED

  features/analytics/
    posthog-server-implementation-guide.md   # NEW: unified developer guide
    posthog-docs-consolidation-analysis.md   # THIS FILE (for historical reference)
```

---

## 8. Risk Assessment

### High Risk
- **Broken cross-references during migration**: Multiple docs link to each other. Consolidation must update all references atomically.
  - **Mitigation**: Use grep to find all references to deleted files before removing them.

### Medium Risk
- **Information loss during merge**: Some nuance in individual docs could be lost.
  - **Mitigation**: Preserve the full event taxonomy from `posthog-events-implemented.md` as the ground truth. All 21 implemented events must appear in the new guide.

### Low Risk
- **Team confusion during transition**: Developers may look at old file locations.
  - **Mitigation**: Leave brief redirect notes in deleted file locations, or rely on git history.

---

## 9. Implementation Priority

### Phase 1 (This Session)
1. Create `docs/features/analytics/posthog-server-implementation-guide.md` -- the unified developer guide
2. Fix broken cross-references in `email-sequences.md`

### Phase 2 (Follow-up)
3. Trim `instrumentation-plan.md` to strategy-only content
4. Merge `posthog-setup-guide.md` + `dashboard-spec.md` into ops doc
5. Update all cross-references across the remaining docs
6. Delete superseded files

### Phase 3 (Future)
7. Implement the ~30 remaining unimplemented events (prioritized by PLG impact)
8. Build the missing operational runbook
