---
title: 'Research Follow-ups & Contact Intelligence'
slug: 'research-followups-contact-intelligence'
created: '2026-02-07'
status: 'review'
stepsCompleted: [1, 2, 3]
tech_stack: ['TypeScript', 'React Router 7', 'Mastra (agents/tools)', 'Trigger.dev v4', 'Supabase', 'LiveKit', 'BAML']
files_to_modify: ['app/features/lenses/services/generateResearchCoverageLens.server.ts', 'app/features/lenses/services/generateICPMatchLens.server.ts', 'app/features/lenses/services/generateValuePrioritiesLens.server.ts', 'app/features/dashboard/pages/projectIntelligence.tsx', 'app/features/dashboard/components/ResearchCoverageWidget.tsx', 'app/features/dashboard/components/ICPMatchesWidget.tsx', 'app/features/dashboard/components/ValuePrioritiesWidget.tsx', 'app/mastra/tools/check-followups.ts', 'app/mastra/tools/fetch-research-coverage-lens.ts', 'app/mastra/tools/score-contact-icp.ts', 'app/mastra/tools/enrich-contact-from-conversation.ts', 'src/trigger/lens/applyResearchCoverageLens.ts', 'src/trigger/lens/applyICPMatchLens.ts', 'src/trigger/research/checkFollowupsDaily.ts', 'app/mastra/agents/project-status-agent.ts', 'agents/livekit/agent.ts']
code_patterns: ['Mastra dynamic imports', 'Deterministic recommendation rules', 'person_scale scoring', 'Annotations for suggestions', 'Materialized views for coverage metrics', 'LiveKit tool invocation', 'Lens ecosystem composition', 'Meta-dashboard widgets']
test_patterns: ['Vitest for Mastra tools', 'Manual testing for Trigger.dev tasks', 'Integration tests for voice flow', 'E2E tests for dashboard widgets']
---

# Tech-Spec: Research Follow-ups & Contact Intelligence

**Created:** 2026-02-07

## Overview

### Problem Statement

Researchers don't know who to talk to next or which project questions need more coverage. People are identified during research but their details aren't tracked or enriched after conversations. Research gaps (unanswered questions, under-represented segments, stale contacts) are invisible until manually discovered.

### Solution

Build a **Lens Ecosystem** with meta-dashboard composition that delivers verifiable "wow moments":

**Core Architecture: Lens-Based Intelligence System**
- Unified lens framework for all analysis (Research Coverage, ICP Match, Value Priorities, BANT)
- Meta-dashboard "Project Intelligence" composes 4 key widgets from individual lenses
- Every insight is evidence-linked and verifiable (click through to source quotes with timestamps)

**CRITICAL DISTINCTION: Recommendations vs Insights/Themes**
- **Insights/Themes** (existing): What users care about - product priorities, pain points, feature requests (e.g., "Integration complexity" with 8 mentions)
- **Recommendations** (new): What YOU should do next to validate and act on insights with confidence (e.g., "Interview 3 more Enterprise users to validate 'Integration complexity' theme")
- **Relationship**: Recommendations guide researchers to strengthen evidence for insights, ensuring decisions are based on sufficient validated data

**Feature 1: Research Coverage Lens** (Foundation)
- Identifies research gaps: unanswered questions, under-represented segments, stale contacts (14+ days)
- Surfaces in dashboard as "Research Coverage" widget with completion score and actionable gaps
- Daily Trigger.dev task computes lens, caches with freshness tracking (recompute if evidence changes >10%)
- **Generates recommendations**: "Talk to Sarah (18 days stale)" or "Interview 3 more SMB users for Question 2"

**Feature 2: ICP Match Lens** (Differentiation)
- Scores people against ICP criteria (stored in person_scale table)
- Shows match breakdown: "Sarah Chen: 4/5 criteria met (missing: Use Case - last mentioned Interview #12)"
- Surfaces in dashboard as "ICP Matches" widget with top 3 ranked matches
- **Generates recommendations**: "Validate ICP fit with Sarah" or "Interview Mike (92% ICP match) about pricing"

**Feature 3: Value Priorities Lens** (Consolidation)
- Consolidates themes + product-insights into one lens
- Shows top priorities by evidence count + confidence (color-coded: 🟢HIGH/🟡MEDIUM/🔴LOW)
- Surfaces in dashboard as "Top Priorities" widget with validation status
- **Generates recommendations**: "Validate 'Integration complexity' theme (only 3 mentions, needs 5)" or "Deep dive on 'Pricing' (8 mentions, HIGH confidence)"

**Feature 4: Contact Intelligence & Enrichment**
- `enrich-contact-from-conversation` - Post-interview: extract person field updates, create annotation suggestions
- Quick capture voice - Integrate "Add contact Sarah from Acme" into existing voice flow
- **Easy synopsis**: Interview records show auto-generated summaries, people records show participation history with key quotes

### Scope

**In Scope:**
- ✅ **Lens Ecosystem**: Research Coverage Lens + ICP Match Lens + Value Priorities Lens (consolidate existing)
- ✅ **Meta-Dashboard**: "Project Intelligence" dashboard with 4 composable widgets
- ✅ **Evidence Traceability**: Every insight links to evidence with hover previews and drill-through
- ✅ **Confidence Indicators**: Color-coded (🟢HIGH/🟡MEDIUM/🔴LOW) for all insights
- ✅ **Actions Everywhere**: [Talk to] [Follow up] [Validate] buttons on every insight
- ✅ Mastra tools: check-followups, fetch-research-coverage-lens, score-contact-icp, enrich-contact-from-conversation
- ✅ Trigger.dev daily scheduled tasks for lens computation (with caching + freshness)
- ✅ Store ICP scores in person_scale, enrichment suggestions as annotations
- ✅ Works for B2B and B2C (no organization_id required)
- ✅ **Audit existing lenses**: Delete redundant lenses, consolidate overlapping ones

**Out of Scope:**
- ❌ Sales pipeline intelligence (opportunity stage suggestions) - defer to later phase
- ❌ CRM external integrations (Salesforce, HubSpot)
- ❌ Email/Slack notifications (just in-app panel for MVP)
- ❌ Cross-project synthesis or portfolio-level insights
- ❌ Custom cadence rules (use fixed thresholds for MVP)

**Related Features (Separate Beads):**
- 🔗 **Evidence & Insight Validation UI** (Insights-3im) - User override, manual evidence creation/editing, theme management. Critical for user trust but can be built after recommendation engine is proven. Users need ability to validate AI extractions and feel in control.

## Context for Development

### Codebase Patterns

**Existing patterns to follow:**

1. **Mastra Tools Pattern** (from `app/mastra/tools/manage-opportunities.ts`):
   - Use dynamic imports for Supabase inside `execute()` to avoid static `~/` imports
   - Extract `accountId` and `projectId` from `context?.requestContext?.get?.()`
   - Return structured output with `success`, `message`, and typed data
   - Use Zod schemas for input/output validation
   - Example:
     ```typescript
     execute: async (input, context?) => {
       const supabase = supabaseAdmin as SupabaseClient<Database>
       const { accountId, projectId } = ensureContext(context)
       // ... query and return structured response
     }
     ```

2. **Trigger.dev Tasks Pattern** (from `src/trigger/interview/`):
   - Use v4 SDK (`@trigger.dev/sdk`)
   - Check `result.ok` before accessing `result.output`
   - Use metadata tracking for progress visibility in UI
   - Use Supabase admin client for RLS-aware queries
   - Example for scheduled tasks:
     ```typescript
     export const checkFollowupsTask = task({
       id: "check-followups-daily",
       run: async (payload, { ctx }) => {
         // ... implementation
       }
     })
     schedules.create({ task: "check-followups-daily", cron: "0 9 * * *" })
     ```

3. **Recommendations System** (from `app/mastra/tools/recommend-next-actions.ts`):
   - Uses deterministic rule engine in `app/features/research-links/utils/recommendation-rules.ts`
   - Returns 1-3 prioritized recommendations with: `id`, `priority`, `title`, `description`, `reasoning`, `actionType`, `navigateTo`
   - Based on `getProjectResearchContext()` which fetches: interviews, surveys, themes, evidence counts, data quality metrics
   - Current integration: Project Status Agent calls `recommendNextActions` tool
   - **Key insight:** Recommendations are rule-based (not LLM), use thresholds like:
     - Low-evidence themes: `evidence_count < 3`
     - High-evidence themes: `evidence_count >= 5`
     - Data quality: `peopleNeedingSegments`, `peopleWithoutTitles`

4. **Research Coverage Tracking** (from investigation):
   - Materialized views provide pre-computed metrics:
     - `project_answer_metrics`: per answer (evidence_count, interview_count, persona_count)
     - `research_question_summary`: per research question (answered_answer_count, open_answer_count)
     - `decision_question_summary`: per decision question (rolled up metrics)
   - Tables: `project_answers` (status: planned, asked, answered, skipped), `interview_people` (participation tracking), `people_personas` (segment coverage)
   - **Key insight:** Coverage gaps are identified by:
     - `open_answer_count > 0` (unanswered questions)
     - Low `persona_count` (under-represented segments)
     - People with no `interview_people` links (non-contributors)
     - Time-based staleness (last interaction > 14 days)

5. **AI Insights Panel** (from `app/features/dashboard/components/AiInsightCard.tsx`):
   - Current implementation: Single `AiInsightCard` component showing one insight at a time
   - Props: `insight` (string), `source` (string), `href` (navigation), `interactive` (boolean)
   - Styled with gradient background, sparkles icon, "Ask follow-up" CTA
   - **Pattern to follow:** Display multiple cards (3 recommendations) from `check-followups` tool
   - Placement: Project status dashboard alongside existing AI assistant panel

6. **Person Scale Pattern** (from `supabase/schemas/12_core_tables.sql`):
   - Table schema: `person_scale (person_id, kind_slug, score, confidence, source, evidence_id)`
   - Score range: 0-1 (numeric)
   - Multiple scales per person supported (NPS, ICP match, satisfaction, etc.)
   - Includes confidence (0-1), source tracking (interview, survey, inferred), optional evidence link
   - **Usage for ICP:** Insert row with `kind_slug='icp_match'`, `score=0.85`, `confidence=0.9`, `source='computed'`

7. **Annotations Pattern** (from `app/mastra/tools/manage-annotations.ts`):
   - Polymorphic: can attach to any entity via `entity_type` + `entity_id`
   - Fields: `annotation_type` (suggestion, note, recommendation), `content`, `metadata` (jsonb)
   - AI recommender tools can query: `SELECT * FROM annotations WHERE annotation_type='suggestion' AND entity_type='person'`
   - **Current usage:** AI deal advisor creates annotations on opportunities
   - **Pattern for enrichment:** Store suggestions as annotations on people, users can accept/dismiss

8. **Extract Evidence Pipeline** (from `src/trigger/interview/v2/extractEvidenceCore.ts`):
   - BAML-based extraction: `InterviewExtraction` type with `FacetMention[]`, `PersonFacetObservation[]`, `PersonScaleObservation[]`
   - Post-processing: `persistFacetObservations()` writes to `person_facet` and `person_scale` tables
   - **Key pattern:** AI extracts structured data → persisted to DB → surfaced as annotations or insights
   - **Usage for enrichment:** After interview, extract person field updates (title, company, pain points) and create annotations

9. **LiveKit Voice Integration** (from `app/components/chat/ProjectStatusVoiceChat.tsx` + `agents/livekit/agent.ts`):
   - Real-time voice chat via LiveKit rooms
   - Gets token from `/api.livekit-token` endpoint with `accountId` + `projectId`
   - LiveKit agent can invoke Mastra tools with context (account_id, project_id passed in room metadata)
   - **Integration point for quick capture:** Add intent recognition in LiveKit agent to detect "Add contact [name] from [company]" commands, invoke `manage-people` tool

10. **Pain Matrix / Facet Analysis** (from `app/mastra/tools/fetch-pain-matrix-cache.ts`):
    - Precomputed analysis stored in `pain_matrix_cache` table (matrix_data as jsonb, evidence_count, pain_count, user_group_count)
    - Freshness tracking: recomputes when `evidence_count` delta > 10%
    - **Pattern:** Expensive analyses are cached with freshness checks to avoid unnecessary recomputation
    - **Relevant for ICP scoring:** Similar caching pattern could be used for ICP scores if computation is expensive

### Files to Reference

| File | Purpose |
| ---- | ------- |
| **Documentation** | |
| `docs/90-roadmap/crm-dogfood-kickoff.md` | Gap analysis and feature requirements |
| `docs/10-architecture/discovery-to-crm-hygiene-spec.md` | Sales lens architecture and JSON schema patterns |
| `docs/50-market/customer-centric-crm-value-prop.md` | Entity model and user journeys |
| **Database Schemas** | |
| `supabase/schemas/12_core_tables.sql` | People, organizations, person_scale, person_facet, annotations tables |
| `supabase/schemas/32_opportunities.sql` | Opportunities schema |
| `supabase/migrations/20250927061429_runs.sql` | Materialized views: project_answer_metrics, research_question_summary, decision_question_summary |
| **Mastra Tools (Reference Patterns)** | |
| `app/mastra/tools/manage-opportunities.ts` | Tool structure, dynamic imports, context extraction |
| `app/mastra/tools/manage-people.ts` | People CRUD operations with junction table handling |
| `app/mastra/tools/recommend-next-actions.ts` | **PRIMARY REFERENCE** - Recommendation tool pattern, calls getProjectResearchContext |
| `app/mastra/tools/fetch-pain-matrix-cache.ts` | Cached analysis pattern with freshness tracking |
| `app/mastra/tools/manage-annotations.ts` | Annotations CRUD for storing suggestions |
| **Project Status Agent** | |
| `app/mastra/agents/project-status-agent.ts` | **PRIMARY INTEGRATION POINT** - Agent that will call check-followups tool |
| **Research Context & Rules** | |
| `app/features/research-links/db.ts` | **KEY FILE** - getProjectResearchContext() function - fetches all coverage metrics |
| `app/features/research-links/utils/recommendation-rules.ts` | **KEY FILE** - Deterministic recommendation rules with thresholds |
| `app/lib/database/research-answers.server.ts` | Research Q&A rollup, question answeredness tracking |
| **Lens Architecture (PRIMARY PATTERN)** | |
| `app/features/lenses/services/generatePainMatrix.server.ts` | **PRIMARY REFERENCE** - Lens computation pattern, caching with freshness |
| `src/trigger/lens/applyLens.ts` | Lens application orchestration |
| `src/trigger/lens/synthesizeLensSummary.ts` | Lens summary generation |
| `supabase/schemas/47_lens_summaries.sql` | Lens summaries table schema (for storing lens results) |
| **Trigger.dev Tasks** | |
| `src/trigger/interview/v2/extractEvidenceCore.ts` | **PRIMARY REFERENCE** - BAML extraction, person enrichment pattern |
| `src/trigger/analytics/updateUserMetrics.ts` | Scheduled task pattern example |
| `src/trigger/interview/v2/facetProcessing.ts` | Facet resolution and persistence helpers |
| `src/trigger/interview/v2/peopleResolution.ts` | Person matching and resolution logic |
| **UI Components** | |
| `app/features/dashboard/components/AiInsightCard.tsx` | **PRIMARY REFERENCE** - AI insights card component |
| `app/components/chat/ProjectStatusVoiceChat.tsx` | LiveKit voice integration |
| **LiveKit Agent** | |
| `agents/livekit/agent.ts` | **PRIMARY INTEGRATION POINT** - Voice agent for quick capture |
| `agents/livekit/mastra-integration.ts` | Mastra tool invocation from LiveKit |

### Technical Decisions

1. **ICP Score Storage**:
   - Use `person_scale` table with `kind_slug='icp_match'` (score 0-1, includes confidence and source tracking)
   - Insert: `{ person_id, kind_slug: 'icp_match', score: 0.85, confidence: 0.9, source: 'computed', account_id, project_id }`
   - Query: Join `people` with `person_scale` WHERE `kind_slug='icp_match'` ORDER BY `score DESC`

2. **Suggestion Storage**:
   - Use `annotations` table with `annotation_type='suggestion'` on people (visible to users, queryable by AI)
   - Insert: `{ entity_type: 'person', entity_id: personId, annotation_type: 'suggestion', content: 'Update title to "Senior PM"', metadata: { field: 'title', suggested_value: 'Senior PM', evidence_id: '...' } }`
   - Query: `SELECT * FROM annotations WHERE entity_type='person' AND annotation_type='suggestion' AND entity_id = personId`

3. **Research Coverage Lens** (New lens type with evidence traceability):
   - Create new lens: `research-coverage` (follows existing lens architecture)
   - Lens structure stored in `lens_summaries` table (similar to sales BANT lens):
     ```typescript
     {
       lens_type: 'research-coverage',
       project_id: '...',
       coverage_data: {
         questionCoverage: {
           unansweredQuestions: [{
             id: string,
             question: string,
             decision_question_id: string,  // link to parent decision
             open_count: number,
             priority: number,
             evidence_refs: string[]  // CRITICAL: link to supporting evidence
           }],
           lowEvidenceQuestions: [{
             id: string,
             question: string,
             decision_question_id: string,
             evidence_count: number,
             target_count: number,
             evidence_refs: string[],  // CRITICAL: existing evidence
             evidence_quality: 'low' | 'medium' | 'high',  // based on confidence scores
             segments_represented: string[]  // which segments have answered
           }]
         },
         participantCoverage: {
           nonContributors: [{
             person_id: string,
             name: string,
             segment: string,
             added_date: string,
             icp_score: number  // if available from person_scale
           }],
           underRepresentedSegments: [{
             segment: string,
             target_count: number,
             actual_count: number,
             gap: number,
             questions_affected: string[],  // which questions lack this segment
             evidence_refs: string[]  // existing evidence from this segment
           }]
         },
         staleness: {
           staleContacts: [{
             person_id: string,
             name: string,
             last_contact: string,
             days_since: number,
             last_interview_id: string,  // link to last interaction
             last_evidence_refs: string[]  // their most recent contributions
           }]
         }
       },
       computed_at: timestamp,
       freshness_score: 0-1,  // recompute if < 0.9
       evidence_summary: {
         total_evidence_count: number,
         evidence_by_question: Record<string, number>,
         evidence_quality_distribution: { low: number, medium: number, high: number }
       }
     }
     ```
   - **Data sources**:
     - Question coverage: `research_question_summary` materialized view
     - Participant coverage: `interview_people` + `people_personas` direct queries
     - Staleness: Computed from `interview_people.created_at` timestamps
   - **Thresholds**: Min 3 responses per question, max 14 days staleness, min 2 people per persona
   - **Caching**: Recompute when evidence_count changes >10% (follow pain_matrix_cache pattern)

4. **Scheduled Task**:
   - Daily Trigger.dev task (`check-followups-daily`) runs at 9am
   - Calls `check-followups` tool with projectId (iterate over all active projects)
   - Returns top 3 recommendations per project
   - Store in cache table (optional: `follow_up_recommendations` with TTL) OR compute on-demand when AI panel loads
   - **Decision:** Compute on-demand for MVP (no cache), add caching if performance becomes issue

5. **Voice Integration**:
   - Extend LiveKit agent (`agents/livekit/agent.ts`) to recognize intent: "Add contact [name] from [company]"
   - Parse using simple regex OR call LLM to extract: `{ action: 'add_contact', name: '...', company: '...' }`
   - Invoke `manage-people` tool (already exists) via Mastra integration
   - Return confirmation: "Added Sarah Chen from Acme to your contacts"
   - **No UI changes needed** - works via voice command in existing ProjectStatusVoiceChat component

6. **B2B/B2C Support**:
   - All queries work without requiring `organization_id`
   - Person-centric: queries start from `people` table
   - Org relationship is optional via `people_organizations` junction (LEFT JOIN, not INNER JOIN)
   - ICP scoring works on person attributes (title, role, segment) without requiring company data

7. **Recommendation Priority**:
   - Follow existing pattern in `recommendation-rules.ts`: `priority` field (1=highest, 3=lowest)
   - Unanswered questions: priority 1 (critical for research goals)
   - Under-represented segments: priority 2 (important for coverage)
   - Stale contacts: priority 2 (re-engagement)
   - Non-contributors: priority 3 (nice-to-have)

8. **AI Agent Integration**:
   - Project Status Agent already calls `recommendNextActions` tool
   - Add `check-followups` and `fetch-research-coverage-lens` to `project_status_agent_tools` object
   - Agent instructions: "When user asks 'who should I talk to next?' or 'what's my research coverage?', call check-followups (which fetches the lens data)"
   - Return format matches existing recommendations schema for consistency

9. **Lens Architecture** (CRITICAL - Unifying all analysis):
   - Follow existing lens pattern from `app/features/lenses/services/generatePainMatrix.server.ts` and `src/trigger/lens/applyLens.ts`
   - Research Coverage Lens is a new lens type alongside: sales-bant, empathy-map, customer-discovery, product-insights
   - Lens data stored in `lens_summaries` table (or create `research_coverage_cache` if separate caching needed)
   - Lens computation flow:
     ```
     1. Trigger.dev task: applyResearchCoverageLens(projectId)
     2. Server function: generateResearchCoverageLens()
        → queries materialized views + direct tables
        → computes coverage metrics
        → returns structured lens data
     3. Store in lens_summaries with lens_type='research-coverage'
     4. check-followups tool: fetch lens data → generate recommendations
     ```
   - **Benefits of lens approach**:
     - Consistent with existing UpSight architecture
     - Cacheable and refreshable (tracks freshness like pain_matrix_cache)
     - Extensible: easy to add new coverage dimensions
     - Queryable: AI agents can fetch lens data directly
     - UI-friendly: can render lens visualization (not just recommendations)

## Implementation Plan

### Tasks

**Phase 0: Audit & Consolidation** (Foundation)

- [ ] Task 0.1: Audit existing conversation lenses
  - File: `app/features/lenses/` directory scan
  - Action: List all existing lenses, identify overlaps (customer-discovery vs Research Coverage, product-insights vs Value Priorities)
  - Notes: Create audit doc with recommendation to DELETE or CONSOLIDATE each lens

- [ ] Task 0.2: Delete/consolidate redundant lenses
  - Files: Lens service files, database migrations if needed
  - Action: Remove customer-discovery lens (replaced by Research Coverage), consolidate product-insights into Value Priorities lens
  - Notes: Ensure no breaking changes to existing lens consumers

**Phase 1: Research Coverage Lens** (Foundation)

- [ ] Task 1.1: Create Research Coverage Lens server function
  - File: `app/features/lenses/services/generateResearchCoverageLens.server.ts`
  - Action: Implement lens generator that queries:
    - `research_question_summary` materialized view for question coverage
    - `interview_people` + `people_personas` for participant/segment coverage
    - `interview_people.created_at` for staleness calculation (>14 days)
  - Notes: Follow `generatePainMatrix.server.ts` pattern, return structured lens data with evidence_refs

- [ ] Task 1.2: Create Trigger.dev task for Research Coverage Lens
  - File: `src/trigger/lens/applyResearchCoverageLens.ts`
  - Action: Implement scheduled task (daily 9am) that:
    - Calls `generateResearchCoverageLens()` for each active project
    - Stores result in `lens_summaries` table with `lens_type='research-coverage'`
    - Tracks freshness (recompute if evidence_count changes >10%)
  - Notes: Follow `applyLens.ts` pattern, use Supabase admin client

- [ ] Task 1.3: Create Mastra tool to fetch Research Coverage Lens
  - File: `app/mastra/tools/fetch-research-coverage-lens.ts`
  - Action: Implement tool that queries `lens_summaries` WHERE `lens_type='research-coverage'`
  - Notes: Follow `fetch-pain-matrix-cache.ts` pattern, return lens data with freshness score

**Phase 2: ICP Match Lens** (Differentiation)

- [ ] Task 2.1: Create ICP Match Lens server function
  - File: `app/features/lenses/services/generateICPMatchLens.server.ts`
  - Action: Implement lens generator that:
    - Fetches ICP definition from account settings (or prompt user to define)
    - Scores each person against ICP criteria (title, role, segment, company attributes)
    - Returns match breakdown (4/5 criteria met, missing: Use Case)
    - Stores scores in `person_scale` table with `kind_slug='icp_match'`
  - Notes: Include evidence_refs showing where criteria were validated (e.g., title from Interview #12)

- [ ] Task 2.2: Create Trigger.dev task for ICP Match Lens
  - File: `src/trigger/lens/applyICPMatchLens.ts`
  - Action: Implement task that runs after interviews complete, recomputes ICP scores for affected people
  - Notes: Trigger on interview completion + daily batch for all people

- [ ] Task 2.3: Create Mastra tool for ICP scoring
  - File: `app/mastra/tools/score-contact-icp.ts`
  - Action: Implement tool that fetches ICP scores from `person_scale` WHERE `kind_slug='icp_match'`
  - Notes: Return ranked list with match breakdown and evidence links

**Phase 3: Value Priorities Lens** (Consolidation)

- [ ] Task 3.1: Consolidate themes + product-insights into Value Priorities Lens
  - File: `app/features/lenses/services/generateValuePrioritiesLens.server.ts`
  - Action: Implement lens generator that:
    - Queries `themes` + `theme_evidence` junction for evidence counts
    - Calculates confidence scores based on evidence quality (avg of evidence.confidence)
    - Returns ranked themes with: evidence_count, confidence (🟢HIGH/🟡MEDIUM/🔴LOW), segment breakdown
  - Notes: Consolidate logic from existing product-insights lens, deprecate that lens

- [ ] Task 3.2: Update existing themes queries to use new lens
  - Files: Any components/tools that query themes directly
  - Action: Refactor to call Value Priorities Lens instead of direct theme queries
  - Notes: Ensure backward compatibility during transition

**Phase 4: Meta-Dashboard** (Composition)

- [ ] Task 4.1: Create Project Intelligence dashboard page
  - File: `app/features/dashboard/pages/projectIntelligence.tsx`
  - Action: Implement dashboard page that:
    - Fetches all 4 lenses (Research Coverage, ICP Match, Value Priorities, BANT)
    - Renders 4 widgets in 2x2 grid layout
    - Handles loading states and lens freshness indicators
  - Notes: Use React Router 7 loader pattern, fetch lenses in parallel

- [ ] Task 4.2: Create Research Coverage Widget component
  - File: `app/features/dashboard/components/ResearchCoverageWidget.tsx`
  - Action: Implement widget that displays:
    - Completion score (85% ✅)
    - Top 3 gaps: unanswered questions, under-represented segments, stale contacts
    - Clickable actions: [Interview person X] [Follow up with Y]
  - Notes: Evidence links on hover, color-coded confidence indicators

- [ ] Task 4.3: Create ICP Matches Widget component
  - File: `app/features/dashboard/components/ICPMatchesWidget.tsx`
  - Action: Implement widget that displays:
    - Top 3 ICP matches with scores (🥇 Sarah Chen 92%, 🥈 Mike Jones 88%, 🥉 Li Wang 84%)
    - Match breakdown on hover (4/5 criteria met, missing: Use Case)
    - Clickable actions: [View profile] [Evidence →]
  - Notes: Link to person detail page with ICP score visible

- [ ] Task 4.4: Create Value Priorities Widget component
  - File: `app/features/dashboard/components/ValuePrioritiesWidget.tsx`
  - Action: Implement widget that displays:
    - Top 3 priorities with evidence counts (Integration complexity: 8 mentions 🟢HIGH)
    - Confidence color-coding (green/yellow/red)
    - Clickable actions: [View evidence] [Validate]
  - Notes: Link to theme detail page with evidence list

**Phase 5: Mastra Tools** (Integration)

- [ ] Task 5.1: Create check-followups tool
  - File: `app/mastra/tools/check-followups.ts`
  - Action: Implement tool that:
    - Fetches Research Coverage Lens data via `fetch-research-coverage-lens`
    - Generates top 3 recommendations with priority (1=highest)
    - Returns recommendations with evidence_refs, question_ids, navigateTo paths
  - Notes: Follow `recommend-next-actions.ts` pattern, return same schema format

- [ ] Task 5.2: Update Project Status Agent with new tools
  - File: `app/mastra/agents/project-status-agent.ts`
  - Action: Add tools to agent: `fetch-research-coverage-lens`, `check-followups`, `score-contact-icp`
  - Notes: Update agent instructions to call these tools when user asks about coverage, ICP, or next steps

- [ ] Task 5.3: Create enrich-contact-from-conversation tool
  - File: `app/mastra/tools/enrich-contact-from-conversation.ts`
  - Action: Implement tool that:
    - Extracts person field updates from evidence after interview (title, company, pain points)
    - Creates annotations on person with `annotation_type='suggestion'`
    - Includes metadata: { field, suggested_value, evidence_id, confidence }
  - Notes: Triggered post-interview, users can accept/dismiss suggestions

**Phase 6: Voice Quick Capture** (Enhancement)

- [ ] Task 6.1: Add intent recognition to LiveKit agent
  - File: `agents/livekit/agent.ts`
  - Action: Add regex/LLM parsing for "Add contact [name] from [company]" commands
  - Notes: Parse name and company, invoke `manage-people` tool (already exists)

- [ ] Task 6.2: Test voice quick capture flow
  - Action: Manual testing - say "Add contact Sarah Chen from Acme", verify person created
  - Notes: Test edge cases: unclear names, company name variations

### Acceptance Criteria

**Research Coverage Lens**

- [ ] AC1: Given a project with 14 research questions (12 answered, 2 unanswered), when the Research Coverage Lens is generated, then it returns `questionCoverage.unansweredQuestions` with 2 entries containing question IDs, text, and priority
- [ ] AC2: Given a project with 5 people (3 interviewed, 2 never interviewed), when the lens is generated, then it returns `participantCoverage.nonContributors` with 2 entries containing person IDs and names
- [ ] AC3: Given a project where Sarah's last interview was 18 days ago, when the lens is generated, then Sarah appears in `staleness.staleContacts` with `days_since: 18` and her last interview ID
- [ ] AC4: Given Research Coverage Lens data with evidence_refs, when user hovers over a gap, then evidence preview shows quote snippet and timestamp
- [ ] AC5: Given a lens computation at 9am with evidence_count=47, when new evidence is added bringing count to 52 (+10.6%), then lens is marked stale and recomputes on next scheduled run

**ICP Match Lens**

- [ ] AC6: Given an ICP definition with 5 criteria (Title, Company Size, Industry, Budget, Use Case), when scoring Sarah Chen, then return match score 0.8 with breakdown showing 4/5 criteria met
- [ ] AC7: Given Sarah has Title="PM" (matches ICP), when scoring, then evidence_refs include the interview ID where title was extracted
- [ ] AC8: Given Sarah is missing "Use Case" criterion, when displaying match breakdown, then show "Missing: Use Case - last mentioned in Interview #12" with clickable link
- [ ] AC9: Given 23 people scored, when displaying ICP Matches widget, then top 3 are ranked by score descending with visual indicators (🥇🥈🥉)

**Value Priorities Lens**

- [ ] AC10: Given a theme "Integration complexity" with 8 evidence pieces (avg confidence 0.87), when generating Value Priorities Lens, then theme is marked 🟢 HIGH confidence
- [ ] AC11: Given a theme with confidence 0.55, when rendering, then it's color-coded 🟡 MEDIUM with validation status "needs validation"
- [ ] AC12: Given theme evidence from 3 Enterprise and 2 SMB interviews, when displaying segment breakdown, then show "Enterprise: 3, SMB: 2" with clickable segment filters

**Meta-Dashboard Composition**

- [ ] AC13: Given all 4 lenses are computed (Research Coverage, ICP Match, Value Priorities, BANT), when loading Project Intelligence dashboard, then 4 widgets render in 2x2 grid with no loading errors
- [ ] AC14: Given Research Coverage shows 85% complete, when clicking "view gaps →", then navigate to detailed Research Coverage lens page with full question list
- [ ] AC15: Given user clicks evidence link, then navigate to evidence detail page with highlighted quote and timestamp positioned correctly
- [ ] AC16: Given new evidence added 5 minutes ago, when dashboard loads, then show "New since last week: 2 Enterprise interviews, ICP score updated" in time-based insights section

**check-followups Tool**

- [ ] AC17: Given Research Coverage Lens shows 2 unanswered questions + 3 stale contacts, when calling `check-followups` tool, then return top 3 recommendations sorted by priority (1=highest)
- [ ] AC18: Given a recommendation for unanswered question, when returned, then include `evidence_refs` array, `question_id`, `reasoning` with quote coding details, and `navigateTo` path
- [ ] AC19: Given user asks "who should I talk to next?" in Project Status Agent, when agent calls `check-followups`, then agent responds with top 3 actionable recommendations with clickable links

**enrich-contact-from-conversation Tool**

- [ ] AC20: Given an interview where Sarah mentions "I'm now Senior PM at Acme", when post-interview enrichment runs, then create annotation on Sarah's person record suggesting title update with evidence link
- [ ] AC21: Given enrichment suggestion annotation, when user views Sarah's profile, then annotation appears as dismissible card with [Accept] [Dismiss] buttons
- [ ] AC22: Given user clicks [Accept] on title suggestion, when accepted, then update `people.title` field and mark annotation as resolved

**Voice Quick Capture**

- [ ] AC23: Given user says "Add contact Sarah Chen from Acme" in LiveKit voice chat, when intent is recognized, then create person record with firstname="Sarah", lastname="Chen", company="Acme"
- [ ] AC24: Given person created via voice, when creation succeeds, then respond with voice confirmation "Added Sarah Chen from Acme to your contacts"
- [ ] AC25: Given ambiguous voice command "Add John from... uh... TechCorp or something", when parsed, then ask clarifying question "Did you say TechCorp?" before creating record

**Error Handling**

- [ ] AC26: Given lens computation fails due to database error, when error occurs, then log error details and return cached lens data (if available) with staleness warning
- [ ] AC27: Given ICP definition is missing for a project, when attempting ICP Match Lens generation, then skip ICP scoring and show "Define your ICP to enable scoring" prompt in widget
- [ ] AC28: Given user has no interviews in project, when loading Research Coverage widget, then show "Upload your first interview to get started" with upload CTA button

## Additional Context

### Dependencies

**Database Tables (Existing):**
- `lens_summaries` - Store computed lens data (or create `research_coverage_cache` table if needed)
- `person_scale` - ICP scores with `kind_slug='icp_match'`
- `annotations` - Enrichment suggestions with `annotation_type='suggestion'`
- `people` - Contact records
- `project_answers`, `research_question_summary`, `project_answer_metrics` - Research coverage metrics
- `interview_people` - Participation tracking
- `people_personas` - Segment coverage tracking
- `themes`, `theme_evidence` - Value priorities data
- `sales_lens_summaries` - BANT data (for Budget Signals widget)

**External Services:**
- Trigger.dev v4 - Scheduled lens computation tasks
- LiveKit - Voice chat integration
- BAML - AI extraction (for enrichment suggestions)

**Code Dependencies:**
- Mastra tools infrastructure (already exists)
- React Router 7 loader pattern (already used)
- Shadcn UI components (already used)
- Project Status Agent (will be extended with new tools)

**Blockers:**
- **ICP Definition**: Need ICP criteria defined in account settings (or prompt user during onboarding)
- **Lens Audit**: Must complete Phase 0 (audit existing lenses) before building new ones to avoid conflicts

### Testing Strategy

1. **Mastra Tools Testing** (Vitest):
   - Unit tests for `check-followups` tool:
     - Mock Supabase client with test data (unanswered questions, stale contacts)
     - Assert correct recommendations returned with proper priority
     - Test edge cases: no data, all questions answered, fresh contacts
   - Unit tests for `score-contact-icp` tool:
     - Mock ICP definition + person records
     - Assert scores calculated correctly (0-1 range)
     - Test confidence calculation based on field completeness
   - Unit tests for `enrich-contact-from-conversation` tool:
     - Mock evidence extraction results
     - Assert annotations created with correct metadata
     - Test deduplication (don't suggest same field twice)

2. **Trigger.dev Task Testing** (Manual + Integration):
   - Manual: Run `check-followups-daily` task locally with test project
   - Integration: Verify task schedules correctly (cron at 9am)
   - Monitoring: Check Trigger.dev dashboard for task success/failure
   - Edge cases: Handle projects with no data gracefully

3. **UI Integration Testing**:
   - Manual: Verify AI insights panel shows recommendations from `check-followups`
   - Manual: Click recommendation navigateTo links, verify correct navigation
   - Manual: Verify annotations appear on person detail page
   - Manual: Test voice command "Add contact Sarah from Acme" in LiveKit

4. **End-to-End Scenarios**:
   - Scenario 1: New project with unanswered questions → check-followups surfaces question gaps
   - Scenario 2: Project with no recent interviews → check-followups surfaces stale contacts
   - Scenario 3: ICP scoring → scores appear on people list, sortable by ICP match
   - Scenario 4: Post-interview enrichment → annotations suggest title/company updates
   - Scenario 5: Voice quick capture → "Add Sarah Chen from Acme" creates person record

### Notes

**Party Mode Insights** (Winston, Mary, Sally):
- **Winston (Architect)**: Lens ecosystem enables composability - cross-reference lenses for power queries. Caching with freshness (pain_matrix pattern) is critical for performance. Evidence traceability is the moat - competitors can't match verifiable insights.
- **Mary (Analyst)**: Requirements traceability differentiates - show "Sarah matches 4/5 ICP criteria, here's the missing data." Create lens manifest to route natural language questions to right lens.
- **Sally (UX)**: Dashboard with 4 widgets (Research Coverage 85% ✅, ICP Matches, Top Priorities, Budget Signals). Every line clickable, every claim verifiable. Confidence indicators (color), evidence hover previews, time-based insights ("New since last week"), actions everywhere [Talk to] [Follow up] [Validate].

**Architectural Decision: Lens Ecosystem > Single Lens**
- One lens (Research Coverage) won't deliver all wow moments ("Who's in my ICP?", "What do users care about most?", "Willingness to pay?", "Next steps?")
- Need lens ecosystem: Research Coverage + ICP Match + Value Priorities + BANT (existing)
- Meta-dashboard composes lenses into unified "Project Intelligence" view
- Each lens is a composable widget with its own action types

**Implementation Priorities:**
1. **Audit existing lenses** (delete redundant, consolidate overlapping)
2. Build **Research Coverage Lens** (foundation - coverage gaps, staleness)
3. Build **ICP Match Lens** (extends person_scale scoring with match breakdown)
4. Build **Value Priorities Lens** (consolidate themes + product-insights)
5. Build **Meta-Dashboard** (4-widget composition: Research Coverage, ICP Matches, Top Priorities, Budget Signals)
6. Build **Mastra tools**: fetch-research-coverage-lens, check-followups, score-contact-icp
7. Build **enrich-contact-from-conversation** (post-interview automation)
8. Finally **voice quick capture** (convenience feature, lower priority)

**CRITICAL: Evidence Traceability** (per Rick's requirement):
- Advanced researchers need to see the linkage: **AI Recommendation → Decision Question → Evidence → Quote**
- Every recommendation must include:
  - `evidence_refs`: Array of evidence IDs that informed the recommendation
  - `question_id`: Which research/decision question this relates to
  - `reasoning`: Explicit explanation with quote coding details
- Research Coverage Lens must track:
  - Which evidence pieces support each question
  - Confidence scores based on evidence quality/quantity
  - Direct links to evidence records (with timestamps)
- Example recommendation format:
  ```json
  {
    "id": "rec-001",
    "title": "Interview 3 more Enterprise users for Question 2",
    "reasoning": "Question 'What's your biggest challenge?' has only 2 Enterprise responses (target: 5). Current evidence: 'Integration complexity' (coded as Pain/Technical, confidence: 0.8)",
    "question_id": "rq-abc",
    "evidence_refs": ["ev-123", "ev-456"],
    "navigateTo": "/evidence?question=rq-abc&segment=Enterprise",
    "metadata": {
      "current_count": 2,
      "target_count": 5,
      "segment": "Enterprise",
      "evidence_quality": "high"
    }
  }
  ```
- UI must render evidence links as clickable chips that jump to evidence detail with highlighted quote

**Key Architectural Insights:**
- AI recommender already uses deterministic rules (not LLM) - follow same pattern for consistency
- Materialized views provide pre-computed metrics - leverage these for performance
- Annotations pattern is well-established - use for suggestions (visible + AI-queryable)
- Person_scale table is designed for multiple scoring systems - ICP is a perfect fit

**Potential Gotchas:**
1. **Coverage metrics accuracy**: Ensure queries match the logic in `getProjectResearchContext()` to avoid inconsistencies
2. **RLS policies**: All queries must filter by `account_id` AND `project_id` (use Supabase admin client for tasks)
3. **Staleness calculation**: Use `interview_people.created_at` not `people.updated_at` (latter changes on any field edit)
4. **Voice intent parsing**: May need fuzzy matching for company names ("Acme Corp" vs "Acme Corporation")
5. **Recommendation deduplication**: If user dismisses a suggestion, don't reshowit next day (track dismissals in annotation metadata)

**Future Enhancements (Post-MVP):**
- Segment-aware cadences: Enterprise = 7 days, SMB = 14 days, B2C = 30 days
- Custom staleness thresholds per project
- Email/Slack notifications for critical follow-ups
- Cached recommendations table for faster loading
- Cross-project synthesis (portfolio-level insights)
- Integration with calendar for automatic follow-up scheduling
