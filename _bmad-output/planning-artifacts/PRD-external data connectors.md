---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
inputDocuments:
  - docs/20-features-prds/features/integrations/integrations-PRD.md
  - docs/20-features-prds/features/integrations/specs/example-api-integration-spec.md
  - docs/20-features-prds/features/gmail-integration/gmail-email-integration-PRD.md
  - docs/10-architecture/SEMANTIC_SEARCH.md
  - docs/10-architecture/architecture/evidence-based-extraction.md
  - docs/20-features-prds/features/content-types-and-processing.md
  - docs/20-features-prds/features/feature-spec-ingest.md
  - docs/00-foundation/_lens-based-architecture-v2.md
  - docs/10-architecture/platform-vision.md
  - docs/features/context-aware-survey-intelligence.md
  - _bmad-output/implementation-artifacts/codebase-findings-themes-icp-research-plan.md
  - _bmad-output/ux-research-party-mode-analysis-2026-02-09.md
documentCounts:
  briefs: 0
  research: 2
  projectDocs: 10
  projectContext: 0
workflowType: 'prd'
projectType: brownfield
classification:
  projectType: saas_b2b
  domain: customer_intelligence
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document: External Data Connectors

**Author:** Rick
**Date:** 2026-02-12
**Project:** UpSight (Insights)
**Status:** Draft — Steps 1-3 complete

---

## Executive Summary

Add external data connectors to UpSight that pull customer knowledge from Notion and Google Drive into the evidence pipeline — making documents, notes, and structured data from outside tools searchable, vectorized, and actionable within the existing lens/evidence/theme architecture.

**North Star:** "Never walk into a customer meeting unprepared." The data connectors feature directly supports the CAPTURE pillar — getting customer knowledge out of silos and into the intelligence engine.

**Key constraint:** Pica OS already handles OAuth to services like Google and Notion. This PRD scopes a quick delivery for proof of value (dogfood + startup demo).

---

## Evidence Integrity: Source Tiers

A critical architectural decision: imported content must NOT blur background information with actual customer voice.

### The Problem

UpSight's core value prop is "evidence you can verify" — receipts with verbatim quotes, timestamps, and person attribution. If we naively pipe Notion pages through the same extraction pipeline, a PM's notes saying "customers hate the API" gets treated the same as a customer literally saying "I hate the API" in an interview. Themes inflate with secondhand interpretations instead of independent customer signals.

### The Solution: Three Source Tiers

| Tier | What It Is | Examples | Evidence Behavior | Search Behavior |
|------|-----------|----------|-------------------|-----------------|
| **Tier 1: Customer Voice** | Direct customer statements | Interview transcripts, survey responses, support tickets, recorded calls | Full evidence extraction, high confidence, person-attributed, feeds themes/insights | Full semantic search |
| **Tier 2: Interpreted Notes** | Someone's notes *about* customers | Meeting notes, Notion customer research pages, Google Docs call notes | Evidence extraction BUT flagged as "reported" — lower default confidence, source indicator | Full semantic search |
| **Tier 3: Reference Context** | Internal knowledge, not customer voice | Feature specs, PRDs, strategy docs, competitive analysis | **NO evidence extraction** — indexed for search and agent context only, never feeds themes/insights | Full semantic search, agent can cite |

### Implications

- Themes and insights only count Tier 1 and Tier 2 evidence, with Tier 2 visually distinguished
- Pain matrix, ICP scoring, and persona generation weight Tier 1 higher
- Tier 3 enriches agent knowledge without polluting customer voice signal
- The agent labels source tier when citing content in responses

---

## Success Criteria

### User Success

- **Connected Knowledge:** User connects Notion/Google Drive via Pica in under 2 minutes and sees their documents appear in UpSight within 30 seconds of import
- **Searchable Everything:** User searches "onboarding problems" and gets results spanning interview transcripts, imported Notion pages, and Google Docs — with source tier clearly labeled
- **Trust Preserved:** User can distinguish customer voice evidence from notes-about-customers from internal reference docs at a glance
- **Agent Intelligence:** User asks the Chief of Staff "What do we know about [topic]?" and it cites imported documents alongside interview evidence, labeled by source tier
- **Aha Moment:** "All my scattered customer knowledge just became one searchable, intelligent system — and I can still tell what's real customer voice vs. my notes."

### Business Success

- **Dogfood Validation:** UpSight team uses connectors for own customer research within first week
- **Demo-Ready:** Founder can demo the Notion → UpSight → searchable evidence flow in under 3 minutes with a live prospect
- **Activation Metric:** New user connects first external data source within first session (target: 60%+ of onboarding users)
- **Evidence Volume:** Imported content increases total searchable evidence per project by 3x+

### Technical Success

- **Pipeline Integrity:** Imported content flows through existing `project_assets` → evidence extraction → embedding → semantic search pipeline with no new infrastructure
- **Source Provenance:** Every imported piece maintains a link back to its origin (Notion page URL, Google Drive file URL)
- **Tier Classification:** AI correctly classifies imported content into Tier 1/2/3 with >90% accuracy
- **Performance:** Import of 50 documents completes processing within 5 minutes via Trigger.dev background tasks

### Measurable Outcomes

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first import | < 2 min from OAuth connect | Track in-app |
| Search results from imported content | Appear within 60s of import | Pipeline latency |
| Evidence tier accuracy | > 90% correct classification | Manual audit sample |
| Agent citation of imported docs | 80%+ of relevant queries cite imported content | Agent eval |
| Demo close rate improvement | Qualitative improvement in first 5 demos | Founder feedback |

---

## Product Scope

### MVP — Ship First (3-5 days)

- Notion page connector via Pica (OAuth → select pages → import as `project_assets`)
- Google Docs connector via Pica (OAuth → select docs → import as `project_assets`)
- Source tier classification during import (user selects or AI auto-classifies)
- Evidence extraction for Tier 1 & 2 content (Tier 2 flagged as "reported")
- Tier 3 indexed for semantic search only (no evidence extraction)
- Source provenance stored (origin URL, platform, import timestamp)
- Imported content appears in semantic search results with source badge
- Agent can cite imported content in responses
- Meeting transcript upload via existing path — PDF and TXT support (Tier 1)

### Growth Features (Post-MVP)

- Google Sheets connector (leverages existing `parseSpreadsheet`)
- Bulk import (select entire Notion database or Drive folder)
- Auto-sync (periodic re-fetch for updated docs)
- Evidence tier visual indicators throughout UI (themes, insights, person detail)
- Tier weighting in pain matrix and persona generation
- Gmail read-only connector (email threads as Tier 1 customer voice)

### Vision (Future)

- Support ticket connectors (Zendesk, Intercom) as Tier 1 customer voice
- Slack/Teams message import with channel-level tier classification
- Cross-source evidence linking
- Analytics data as quantitative context (GA4, PostHog)
- Automatic meeting brief generation from all imported sources
- Full CAPTURE pillar realized: every customer touchpoint unified with clear source provenance

---

## Appendix: Data Source Comparative Analysis

> Elicitation artifact from Step 2 — Comparative Analysis Matrix scoring potential data sources for quick-delivery proof of value.

| Data Source | Ship Speed (30%) | Wow Factor (25%) | Evidence Quality (20%) | Arch Fit (15%) | Parse Ease (10%) | **Weighted** |
|---|---|---|---|---|---|---|
| **Notion Pages** | 9 | 9 | 9 | 9 | 8 | **8.95** |
| **Google Docs** | 8 | 8 | 9 | 9 | 7 | **8.30** |
| **Google Sheets** | 9 | 5 | 5 | 10 | 9 | **7.30** |
| **Gmail Threads** | 5 | 10 | 10 | 5 | 3 | **6.80** |
| **Support Tickets** | 5 | 8 | 9 | 5 | 5 | **6.55** |
| **Slack/Teams** | 4 | 7 | 6 | 5 | 3 | **5.20** |
| **CRM (SF/HS)** | 5 | 4 | 4 | 6 | 6 | **4.75** |
| **Analytics (GA4/PH)** | 3 | 4 | 3 | 3 | 3 | **3.30** |

**Recommendation:** Notion + Google Docs as MVP (3-5 days), Google Sheets fast follow (+1 day), Gmail Phase 2, Support/Slack Phase 3.

**Key insight:** Pica OS handles OAuth for all sources. The differentiator is content-to-evidence mapping quality and parsing complexity. Notion and Google Docs produce the richest narrative content that maps most naturally to the evidence extraction pipeline.
