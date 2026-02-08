# Recommendation Engine - Supported Questions & Roadmap

**Date:** 2026-02-07
**Status:** ✅ Live in Production

---

## ✅ Currently Supported Questions

The recommendation engine responds to these questions in the Project Status Agent (Uppy):

### Research Gap Analysis
- **"Where are my research gaps?"** ✅ WORKING
  - Identifies unanswered research questions
  - Finds low-confidence themes (< 5 evidence pieces)
  - Shows what's blocking confident decisions

- **"What insights need validation?"** ✅ WORKING
  - Lists themes with LOW or MEDIUM confidence
  - Calculates gap to reach HIGH confidence (85%+)
  - Provides evidence count: current → target

- **"What should I validate next?"** ✅ WORKING
  - Prioritizes themes by confidence level
  - Recommends specific number of interviews needed
  - Links directly to theme detail page

### Contact Intelligence
- **"Who should I talk to next?"** ⚠️ PARTIAL
  - ✅ Shows low-confidence themes to validate
  - ✅ Identifies research question gaps
  - ❌ High ICP matches (requires ICP Match Lens - not built)
  - ❌ Stale contacts (requires ICP scores - not built)

- **"Which contacts are getting stale?"** ❌ NOT YET
  - Requires ICP Match Lens to be built first
  - Would identify contacts not contacted in 14+ days
  - Would prioritize high-ICP matches

### General Guidance
- **"What should I do next?"** ✅ WORKING
  - Triggers recommendation engine in research context
  - Falls back to general project guidance if no research gaps
  - Provides 1-3 prioritized recommendations

---

## 🎯 Recommendation Rules (Current)

### Rule 1: Unanswered Questions (Priority 1 - Critical)
**Status:** ✅ WORKING

**Triggers when:**
- Research questions have `open_answer_count > 0`
- Decision questions lack sufficient evidence

**Example Output:**
> "Answer research question with 3 gaps. This question needs 3 more responses to be fully covered."

**Data Sources:**
- `research_question_summary` (materialized view)

**Action Type:** `schedule_interview`

---

### Rule 2: Low-Confidence Themes (Priority 2 - Important)
**Status:** ✅ WORKING

**Triggers when:**
- Theme has < 5 evidence pieces (LOW or MEDIUM confidence)
- Theme confidence < 80%
- Evidence count < 10 (allows for themes with some evidence)

**Confidence Scoring:**
- **LOW (45%)**: < 3 evidence pieces
- **MEDIUM (65%)**: 3-4 evidence pieces
- **HIGH (85%)**: 5+ evidence pieces

**Example Output:**
> "Validate 'Instill Confidence with Reliable Tools' theme (LOW confidence). This theme has only 2 mentions. Interview 3 more people to reach HIGH confidence (5+ mentions)."

**Data Sources:**
- `themes` table
- `theme_evidence` junction table (for evidence count)

**Action Type:** `validate_theme`

**Navigate To:** `/insights/{themeId}` (themes redirect to insights)

---

### Rule 3: Stale High-ICP Contacts (Priority 2 - Re-engagement)
**Status:** ❌ NOT WORKING (ICP scores don't exist)

**Triggers when:**
- Person has ICP score >= 80%
- Last interview was 14+ days ago

**Example Output:**
> "Follow up with Sarah Chen (18 days since last contact). She's a high ICP match (92%) but conversation has gone stale."

**Data Sources:**
- `interview_people` (last interview date calculation)
- `person_scale` WHERE `kind_slug='icp_match'` (❌ no data exists)

**Blockers:**
1. ICP Match Lens not built
2. No ICP scores in `person_scale` table
3. No ICP definition UI

**Action Type:** `follow_up_contact`

---

### Rule 4: High ICP Matches Never Interviewed (Priority 3 - Opportunity)
**Status:** ❌ NOT WORKING (ICP scores don't exist)

**Triggers when:**
- Person has ICP score >= 80%
- Person has NO records in `interview_people`

**Example Output:**
> "Interview Mike Johnson (92% ICP match). This person is a strong ICP match but hasn't been interviewed yet. Great opportunity to validate your assumptions."

**Data Sources:**
- `person_scale` WHERE `kind_slug='icp_match'` (❌ no data exists)
- `interview_people` (to check if never interviewed)

**Blockers:**
1. ICP Match Lens not built
2. No ICP scores in `person_scale` table

**Action Type:** `schedule_interview`

---

## 🚀 Recommended Build Order

### Phase 1: Enable ICP-Based Recommendations (NEXT)
**Goal:** Make Rules 3 & 4 work

**Tasks:**
1. **ICP Definition UI** (`app/features/projects/components/ICPDefinitionCard.tsx`)
   - Surface existing `target_orgs`, `target_roles`, `target_company_sizes` from `accounts.accounts`
   - Allow project-level overrides via `project_sections` (kind='target_orgs', 'target_roles')
   - Add match threshold slider (default: 60%)

2. **ICP Match Lens** (`app/features/lenses/services/generateICPMatchLens.server.ts`)
   - Read ICP criteria from account + project
   - Score all people (1-395 in Rick's project)
   - Store in `person_scale` with `kind_slug='icp_match'`, `score=0.0-1.0`

3. **Trigger.dev Task** (`src/trigger/lens/applyICPMatchLens.ts`)
   - Schedule: Run daily or on-demand
   - Re-score all people when ICP definition changes

**Impact:**
- Enables "Which contacts are getting stale?" question
- Enables "Who should I talk to next?" (high-ICP matches)
- Makes 4/4 recommendation rules work
- Provides 2-3 additional recommendations per query

**Estimated Effort:** 1-2 days

---

### Phase 2: UI for Recommendations (AFTER Phase 1)
**Goal:** Make recommendations visible proactively

**Option A: AI Insights Panel Cards**
- File: `app/features/dashboard/components/AiInsightCard.tsx`
- Show 3 recommendation cards instead of 1 insight
- Add [Take action] buttons linking to `navigateTo` path
- Auto-refresh daily

**Option B: Dedicated Insights & Recommendations Page**
- File: `app/features/dashboard/pages/insightsRecommendations.tsx`
- Full-page layout with recommendations + insights
- Filterable by category (research_coverage, icp_validation, insight_validation, follow_up)
- Sortable by priority

**Impact:**
- Users see recommendations without asking
- Proactive research guidance
- Higher recommendation click-through rate

**Estimated Effort:** 2-3 days

---

### Phase 3: Research Plan UI (AFTER Phase 2)
**Goal:** Expose decision → question → evidence hierarchy

**Tasks:**
1. **Research Plan Page** (`app/features/research-plan/pages/index.tsx`)
   - Collapsible hierarchy: Decisions → Questions → Answers → Evidence
   - Visual status: ✅ Well-supported (10+ evidence), 🟡 Needs validation (5-9), ⚠️ Needs research (<5)
   - Quick navigation to evidence detail

2. **Data Queries** (`app/features/research-plan/services/loadResearchPlanData.server.ts`)
   - Fetch `decision_questions` → `research_questions` → `project_answers` → `evidence`
   - Use materialized views (`research_question_summary`, `decision_question_summary`)

**Impact:**
- Users understand research structure
- Easy to see which decisions are well-supported
- Navigate from decision → all supporting evidence
- Identify gaps visually

**Estimated Effort:** 3-4 days

---

### Phase 4: Evidence Validation UI (LATER)
**Goal:** User trust and control

**Features:**
- Manual evidence creation (highlight transcript → create evidence)
- Evidence editing (quote boundaries, coding, confidence)
- Evidence reassignment (drag between themes)
- Manual theme creation and editing
- Theme merging and validation status marking

**Reference:** Bead `Insights-3im`, documented in `_bmad-output/implementation-artifacts/evidence-validation-feature-notes.md`

**Impact:**
- Users can correct AI mistakes
- Builds trust in recommendation engine
- Allows for edge cases and nuance

**Estimated Effort:** 5-7 days

---

## 🎯 Next Questions to Support

### After Phase 1 (ICP Match Lens)
- **"Who are my best ICP matches?"** - List people sorted by ICP score
- **"Which high-value contacts should I re-engage?"** - Filter by ICP + staleness
- **"Show me people I haven't talked to yet"** - Filter by no interview records

### After Phase 2 (UI)
- **"Show me my recommendations"** - Open recommendations page directly
- **"What's my research status?"** - Dashboard with coverage + confidence metrics

### After Phase 3 (Research Plan UI)
- **"Which decisions are well-supported?"** - Filter by evidence count
- **"What questions need more data?"** - Highlight gaps in research plan
- **"Show me all evidence for decision X"** - Navigate decision → evidence chain

---

## 📊 Current Coverage (Rick's Project)

**Working:**
- ✅ 8 themes found (2-22 evidence pieces each)
- ✅ 1 low-confidence theme identified
- ✅ 0 research gaps (all questions fully answered)
- ✅ Evidence traceability works

**Not Working (need ICP Lens):**
- ❌ 0 ICP scores (no person_scale records)
- ❌ 0 stale contact recommendations
- ❌ 0 high-ICP match recommendations

**Success Rate:** 2/4 rules working (50%)
**After Phase 1:** 4/4 rules working (100%)

---

## 🔍 Testing Checklist

### Phase 1 (ICP Lens) Testing
- [ ] ICP definition UI shows existing target_orgs/roles
- [ ] ICP scoring algorithm runs and populates person_scale
- [ ] Recommendation engine generates "stale contact" recommendations
- [ ] Recommendation engine generates "high-ICP match" recommendations
- [ ] Links navigate to correct people detail pages

### Phase 2 (UI) Testing
- [ ] Recommendations appear on dashboard without asking
- [ ] [Take action] buttons navigate to correct pages
- [ ] Recommendations refresh daily
- [ ] Filtering by category works
- [ ] Sorting by priority works

### Phase 3 (Research Plan) Testing
- [ ] Hierarchy displays correctly (decisions → questions → answers)
- [ ] Status indicators show correct confidence levels
- [ ] Collapsible sections expand/collapse smoothly
- [ ] Navigation links work (decision → evidence detail)
- [ ] Gap identification is accurate

---

**End of Documentation**
