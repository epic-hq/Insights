# Codebase Findings: Themes, ICP, and Research Plan

**Date:** 2026-02-07
**Project:** 6dbcbb68-0662-4ebc-9f84-dd13b8ff758d (Rick's UpSight)

---

## 🎯 **Summary of Findings**

### ✅ **THEMES/INSIGHTS EXIST** (Data Located!)

**Two tables:**
1. **`insights`** (legacy) - Per-interview insights, older system
2. **`themes`** (canonical, current) - Cross-interview grouped themes

**Rick's project has:**
- 8 themes in `themes` table
- Evidence counts via `theme_evidence` junction table (2-22 pieces per theme)
- NO data in legacy `insights` table

**Schema:**
```sql
-- themes table
CREATE TABLE themes (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  project_id uuid,
  name text NOT NULL,
  statement text,
  category text,
  jtbd text,  -- Jobs To Be Done
  pain text,
  desired_outcome text,
  confidence smallint,  -- NOTE: mostly NULL in Rick's data
  priority integer DEFAULT 3,  -- 1=High, 2=Medium, 3=Low
  -- ... other fields
);

-- theme_evidence junction (for evidence count)
CREATE TABLE theme_evidence (
  id uuid PRIMARY KEY,
  theme_id uuid REFERENCES themes(id),
  evidence_id uuid REFERENCES evidence(id),
  confidence numeric,
  rationale text,
  UNIQUE(theme_id, evidence_id, account_id)
);
```

**Rick's 8 Themes:**
| Theme | Evidence Count | Priority | Confidence |
|-------|----------------|----------|------------|
| Enhance Integration with Existing Tools | 22 | 3 | null |
| Enhance Survey and Interview Customization | 18 | 3 | null |
| Ensure Seamless Knowledge Transfer | 15 | 3 | null |
| Streamline Workflow for Effective Research | 10 | 3 | null |
| Foster Emotionally Engaging Experiences | 10 | 3 | null |
| Improve Intuitive UI Navigation | 9 | 3 | null |
| Build Trust with Clear Evidence | 6 | 3 | null |
| Instill Confidence with Reliable Tools | 2 | 3 | null |

**Key Insights:**
- Evidence count ranges from 2-22 (good distribution for recommendations)
- All have priority=3 (default, not prioritized yet)
- All have confidence=null (not computed/set)
- **"Instill Confidence with Reliable Tools" has only 2 mentions** → LOW confidence, perfect candidate for "validate this theme" recommendation!

---

## 🎯 **ICP Definition** (Found but Not Exposed)

### Where ICP is Stored

**Account-Level Defaults:**
```sql
-- accounts.accounts table
target_orgs text[]          -- Target organizations/industries
target_roles text[]         -- Target buyer roles/titles
target_company_sizes text[] -- Company sizes (Startup, SMB, Enterprise)
competitors text[]          -- Known competitors
industry text               -- Company's industry
```

**Project-Level Overrides:**
```sql
-- project_sections table
kind = 'target_orgs'   -- Overrides account target_orgs
kind = 'target_roles'  -- Overrides account target_roles
```

### UI Status: ❌ NOT Exposed as "ICP"

**Current state:**
- Data exists in database (account + project levels)
- NOT surfaced in UI with "ICP" terminology
- Likely set during onboarding but not visible/editable as "ICP Profile"

**Where it should be exposed:**
1. **Project Settings** - "ICP Definition" section showing target_orgs, target_roles, company sizes
2. **People List** - "ICP Match" column/badge showing match %
3. **Recommendations** - "Talk to high-ICP contacts" suggestions

### Scoring Algorithm: ❌ DOES NOT EXIST

**What's needed:**
1. **ICP Match Lens** (from tech spec) - reads ICP criteria, scores people
2. **Scoring logic:**
   ```typescript
   function scoreICPMatch(person, icpCriteria) {
     let matches = 0;
     let total = 0;

     // Check role match
     if (icpCriteria.target_roles.includes(person.title)) matches++;
     total++;

     // Check company size match
     if (person.company_size && icpCriteria.target_company_sizes.includes(person.company_size)) matches++;
     total++;

     // Check industry match
     if (person.company_industry && icpCriteria.target_orgs.includes(person.company_industry)) matches++;
     total++;

     return matches / total;  // Score 0-1
   }
   ```
3. **Storage:** `person_scale` table with `kind_slug='icp_match'`, `score=0.85`

---

## 📋 **Research Plan Structure** (Data Exists, UI Doesn't Show It)

### Current Data Model

**The flow:**
```
Decision Questions (Decisions to make)
    ↓
Research Questions (Questions to ask users)
    ↓
Project Answers (Answers collected)
    ↓
Evidence (Real quotes with timestamps)
```

**Tables:**
```sql
-- Decision questions (high-level decisions)
decision_questions table
  ├─ question_text: "Which feature should we build first?"
  └─ rationale: "Need to prioritize MVP scope"

-- Research questions (what to ask users)
research_questions table
  ├─ decision_question_id (FK)
  ├─ text: "What features are most important to you?"
  └─ rationale: "Understand user priorities"

-- Answers (collected from interviews)
project_answers table
  ├─ research_question_id (FK)
  ├─ answer_text: "Integration with CRM is critical"
  └─ status: 'answered' | 'planned' | 'skipped'

-- Evidence (quotes proving answers)
evidence table
  ├─ quote_text: "We need CRM integration ASAP"
  ├─ timestamp_sec: 142
  ├─ interview_id (FK)
  └─ confidence: 0.87
```

**Materialized Views (Pre-computed):**
```sql
-- research_question_summary
- Aggregates per research question
- Fields: answered_answer_count, open_answer_count, evidence_count, interview_count

-- project_answer_metrics
- Aggregates per answer
- Fields: evidence_count, interview_count, persona_count

-- decision_question_summary
- Aggregates per decision question
- Rolled-up metrics from child research questions
```

### Rick's Project Data

- **3 decision questions** defined
- **3 research questions** (all with `open_answer_count: 0` - fully answered!)
- **Strong evidence:** 12-36 pieces per question
- **62 interviews** completed
- **395 people** tracked

**The problem:** No UI to see this flow! Users can't easily:
1. View their decisions → questions → answers → evidence chain
2. See which decisions are well-supported vs. need more data
3. Navigate from a decision → see all supporting evidence
4. Identify gaps in research coverage visually

---

## 🛠️ **Fixes Needed**

### 1. **Update Recommendation Engine** (Immediate)

**Problem:** Recommendation engine queries `themes.evidence_count` which doesn't exist.

**Fix:** Update query to use `theme_evidence` junction:
```typescript
// OLD (broken):
const { data: themes } = await supabase
  .from("themes")
  .select("id, name, evidence_count")  // ❌ evidence_count doesn't exist

// NEW (works):
const { data: themes } = await supabase
  .from("themes")
  .select(`
    id,
    name,
    priority,
    confidence,
    theme_evidence (
      evidence_id
    )
  `)

// Then calculate count:
const themesWithCount = themes.map(t => ({
  ...t,
  evidence_count: t.theme_evidence?.length || 0
}));
```

**Result:** Recommendation engine will now generate recommendations like:
> "Validate 'Instill Confidence with Reliable Tools' theme (only 2 mentions, need 5+ for HIGH confidence)"

### 2. **Build ICP Match Lens** (New Feature - As Specced)

**Tasks:**
- [ ] Create ICP Definition UI in Project Settings
  - Surface `target_orgs`, `target_roles`, `target_company_sizes` as editable "ICP Profile"
  - Show match threshold slider (60% = show contacts matching 60%+ of criteria)
- [ ] Build ICP scoring algorithm
  - Read ICP from account/project
  - Score all people against criteria
  - Store in `person_scale` with `kind_slug='icp_match'`
- [ ] Create `generateICPMatchLens.server.ts`
- [ ] Create `applyICPMatchLens.ts` Trigger.dev task
- [ ] Update recommendation engine to use ICP scores

**Files to create:**
- `app/features/lenses/services/generateICPMatchLens.server.ts`
- `src/trigger/lens/applyICPMatchLens.ts`
- `app/features/projects/components/ICPDefinitionCard.tsx` (UI)

### 3. **Research Plan UI** (New UX Feature)

**Goal:** Make the research plan visible and navigable.

**Proposed UI:** New "/research-plan" page with collapsible hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Research Plan                              [Edit Plan ↗] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 🎯 Decision Questions (3)                                   │
│                                                              │
│ ▼ 1. Which feature should we build first?                  │
│    Status: ✅ Well-Supported (26 evidence, 9 interviews)    │
│                                                              │
│    ❓ Research Questions (2):                               │
│       ├─ What features are most important to you?           │
│       │  ✅ Answered (36 evidence, 9 interviews)            │
│       │  💡 Top answers: "Integration" (22), "Customization" (18)│
│       │  [View all evidence →]                              │
│       │                                                      │
│       └─ How do you prioritize features?                    │
│          ✅ Answered (31 evidence, 9 interviews)            │
│          💡 Top answers: "Time savings" (15), "Ease of use" (10)│
│          [View all evidence →]                              │
│                                                              │
│ ▼ 2. What is our differentiation?                          │
│    Status: 🟡 Needs Validation (12 evidence, 8 interviews) │
│                                                              │
│    ❓ Research Questions (1):                               │
│       └─ How do you prioritize between guidance & clarity?  │
│          ✅ Answered (12 evidence, 8 interviews)            │
│          ⚠️  Only 8 interviews - need 2 more for HIGH       │
│          [Interview more people →]                          │
│                                                              │
│ ▶ 3. What pricing will customers accept?                   │
│    Status: ⏳ Needs Research (0 evidence)                   │
│    [Add research questions →]                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key UX Features:**
- **Collapsible hierarchy:** Expand/collapse decisions and questions
- **Visual status:** ✅ Well-supported (10+ evidence), 🟡 Needs validation (5-9), ⚠️ Needs research (<5), ⏳ No data
- **Evidence counts:** Show at every level (decision, question, answer)
- **Quick actions:** [View evidence], [Interview more], [Add questions]
- **Navigation:** Click through to evidence detail with highlighted quotes

**Files to create:**
- `app/features/research-plan/pages/index.tsx` (Research Plan page)
- `app/features/research-plan/components/DecisionQuestionCard.tsx`
- `app/features/research-plan/components/ResearchQuestionItem.tsx`
- `app/features/research-plan/services/loadResearchPlanData.server.ts`

**Data queries:**
```typescript
// Fetch full hierarchy with counts
const { data } = await supabase
  .from("decision_questions")
  .select(`
    id,
    question_text,
    rationale,
    research_questions (
      id,
      text,
      rationale,
      project_answers (
        id,
        answer_text,
        evidence_count
      )
    )
  `)
  .eq("project_id", projectId);
```

---

## 🎯 **Next Steps** (Priority Order)

### IMMEDIATE (Today)

1. ✅ **Fix Recommendation Engine** - COMPLETED
   - Updated themes query to use `theme_evidence` junction
   - Fixed validation_status check (removed non-existent field)
   - File: `app/mastra/tools/generate-research-recommendations.ts`

2. ✅ **Test with Real Data** - COMPLETED
   - Generated 1 recommendation: "Validate 'Instill Confidence with Reliable Tools' theme (2 mentions, LOW confidence)"
   - Correctly identified lowest-confidence theme from 8 total themes
   - No ICP recommendations (ICP Match Lens not yet built)
   - Test output: `npx tsx scripts/test-recommendations-engine.ts`

### SOON (This Sprint)

3. **ICP Definition UI** - Create Project Settings card to define/edit ICP
   - Show `target_orgs`, `target_roles`, `target_company_sizes`
   - Add match threshold slider

4. **ICP Match Lens** - Build scoring algorithm and lens
   - Read ICP criteria
   - Score 395 people
   - Store in `person_scale`

5. **Research Plan Page** - New UI to show decisions → questions → evidence flow
   - Collapsible hierarchy
   - Status indicators
   - Quick navigation to evidence

### LATER (Next Sprint)

6. **Meta-Dashboard** - "Insights & Recommendations" page (from party mode discussion)
7. **Evidence Validation UI** - Manual evidence editing (Bead Insights-3im)

---

## 📊 **Updated Tech Spec Status**

| Component | Status | Notes |
|-----------|--------|-------|
| Recommendation Engine | 🟡 Needs Fix | Query pattern wrong, easy fix |
| Themes/Insights | ✅ Data Found | 8 themes, 2-22 evidence each |
| ICP Definition | 🟡 Exists but Hidden | In DB, not in UI |
| ICP Scoring Algorithm | ❌ Doesn't Exist | Need to build |
| Research Plan Data | ✅ Exists | decision_questions → research_questions → answers → evidence |
| Research Plan UI | ❌ Doesn't Exist | Need to build |
| Evidence Traceability | ✅ Works | Existing feature, no issues |

---

## 🔍 **Traditional Research Plan Structure** (For Reference)

**Standard research planning flow:**

1. **Business Objectives** → What decisions do we need to make?
2. **Research Questions** → What do we need to learn from users?
3. **Method & Sampling** → How will we collect data? (interviews, surveys)
4. **Data Collection** → Execute research, gather evidence
5. **Analysis** → Identify themes/insights from evidence
6. **Synthesis** → Roll up findings to answer research questions
7. **Recommendations** → Inform business decisions with evidence

**UpSight captures ALL of this:**
- ✅ Objectives = `decision_questions`
- ✅ Research Questions = `research_questions`
- ✅ Method = Interviews (`interviews` table)
- ✅ Data = Evidence (`evidence` table with quotes + timestamps)
- ✅ Analysis = Themes (`themes` + `theme_evidence` junction)
- ✅ Synthesis = Materialized views (`research_question_summary`, etc.)
- 🟡 Recommendations = Exists but needs fixing (recommendation engine)

**The gap:** No UI that shows this structure clearly! Users can't see:
- "Here are your 3 decisions"
- "For decision #1, you asked 2 questions"
- "Those questions are 100% answered with 36 pieces of evidence"
- "Click here to see all the evidence"

This is the **Research Plan UI** we need to build.

---

## 📁 **Files to Update/Create**

### Update (Fix):
- `app/mastra/tools/generate-research-recommendations.ts` - Fix themes query

### Create (ICP):
- `app/features/projects/components/ICPDefinitionCard.tsx` - ICP settings UI
- `app/features/lenses/services/generateICPMatchLens.server.ts` - ICP scoring
- `src/trigger/lens/applyICPMatchLens.ts` - ICP lens task

### Create (Research Plan UI):
- `app/features/research-plan/pages/index.tsx` - Research plan page
- `app/features/research-plan/components/DecisionQuestionCard.tsx`
- `app/features/research-plan/components/ResearchQuestionItem.tsx`
- `app/features/research-plan/services/loadResearchPlanData.server.ts`

---

**End of Findings Document**
