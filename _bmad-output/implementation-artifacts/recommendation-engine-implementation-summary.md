# Recommendation Engine - Implementation Summary

**Date:** 2026-02-07
**Status:** ✅ Core engine built, ready for testing

---

## 🎯 North Star Achieved

**"Close the loop from evidence → insights → confidence → recommendation → action → verification"**

Built a cross-lens recommendation engine that synthesizes data from multiple sources to generate prioritized, actionable recommendations with full evidence traceability.

---

## ✅ What Was Built

### 1. Core Recommendation Engine

**File:** `app/mastra/tools/generate-research-recommendations.ts`

**What it does:**
- Queries data from multiple sources (research questions, ICP scores, themes, interview history)
- Applies 4 deterministic rules to generate recommendations
- Returns top 3 prioritized recommendations with evidence links
- Includes confidence scoring and action metadata

**Key Features:**
- ✅ Cross-lens synthesis (not just one data source)
- ✅ Evidence traceability (every recommendation links back to source data)
- ✅ Confidence tracking (current → target confidence scores)
- ✅ Action-oriented (schedule_interview, validate_theme, follow_up_contact, etc.)
- ✅ Prioritized (1 = critical, 2 = important, 3 = opportunity)

### 2. Four Deterministic Rules

**RULE 1: Unanswered Questions** (Priority 1 - Critical)
- Queries: `research_question_summary` WHERE `open_answer_count > 0`
- Generates: "Answer research question with N gaps"
- Why: Decision questions without answers block confident decisions

**RULE 2: Low-Confidence Themes** (Priority 2 - Important)
- Queries: `themes` WHERE `evidence_count < 5` AND `validation_status != 'validated'`
- Calculates confidence: <3 mentions = LOW (45%), 3-4 = MEDIUM (65%), 5+ = HIGH (85%)
- Generates: "Validate '[theme]' theme (MEDIUM confidence)"
- Why: Need 5+ evidence pieces to make confident decisions

**RULE 3: Stale High-ICP Contacts** (Priority 2 - Re-engagement)
- Queries: `interview_people` + `person_scale` (ICP scores 80%+)
- Calculates: Days since last interview (threshold: 14 days)
- Generates: "Follow up with [person] (18 days since last contact)"
- Why: High-value contacts should be engaged regularly

**RULE 4: High ICP Matches Never Interviewed** (Priority 3 - Opportunity)
- Queries: `person_scale` WHERE `score >= 0.8` AND no `interview_people` records
- Generates: "Interview [person] (92% ICP match)"
- Why: Validate ICP assumptions with high-fit people

### 3. Evidence Traceability

Every recommendation includes:
```typescript
{
  id: "rec-unanswered-abc123",
  priority: 1,
  category: "research_coverage",
  title: "Answer research question with 3 gaps",
  reasoning: "Decision questions without answers block confident decisions...",
  confidence_current: 0.45,  // Optional
  confidence_target: 0.85,
  evidence_refs: [           // Optional - for traceability
    {
      interview_id: "...",
      evidence_id: "...",
      quote_snippet: "...",
      timestamp: "..."
    }
  ],
  action_type: "schedule_interview",
  action_data: {
    question_id: "...",
    needed_responses: 3
  },
  navigateTo: "/questions/abc123"
}
```

### 4. Test Script

**File:** `scripts/test-recommendations-engine.ts`

**Run:** `npx tsx scripts/test-recommendations-engine.ts`

**What it does:**
- Calls recommendation engine with test project ID
- Validates output structure
- Checks for priority 1 recommendations
- Verifies category diversity
- Confirms detailed reasoning

---

## 🔗 Related Work Documented

### Evidence & Insight Validation UI (Separate Bead)

**Bead:** `Insights-3im` (Priority P2)
**File:** `_bmad-output/implementation-artifacts/evidence-validation-feature-notes.md`

**Features:**
- Manual evidence creation (highlight transcript → create evidence)
- Evidence editing (quote boundaries, coding, confidence)
- Evidence reassignment (drag evidence between themes)
- Manual theme creation and editing
- Theme merging and validation status marking

**Why separate:** User trust and control are critical, but can be built AFTER recommendation engine is proven valuable.

---

## 📊 How It Works (Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│ Recommendation Engine (Pure Function)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ INPUTS (Read-only):                                         │
│  ├─ research_question_summary (materialized view)           │
│  ├─ interview_people (staleness calculation)                │
│  ├─ person_scale (ICP scores)                               │
│  ├─ themes (evidence counts, validation status)             │
│  └─ Project context                                         │
│                                                              │
│ RULES ENGINE (Deterministic):                               │
│  ├─ Rule 1: Unanswered questions                            │
│  ├─ Rule 2: Low-confidence themes                           │
│  ├─ Rule 3: Stale high-ICP contacts                         │
│  └─ Rule 4: Never-interviewed high-ICP matches              │
│                                                              │
│ OUTPUT:                                                      │
│  └─ Top 3 prioritized recommendations                       │
│     ├─ Evidence refs (traceability)                         │
│     ├─ Confidence scores (current → target)                 │
│     ├─ Action data (for execution)                          │
│     └─ Navigation paths (where to go)                       │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **No LLM calls** - Pure deterministic rules for consistency and speed
2. **No writes** - Read-only queries, no side effects
3. **Cross-lens synthesis** - Combines data from multiple sources
4. **Evidence traceability** - Every recommendation links back to source data
5. **Confidence tracking** - Shows current state + target state

---

## 🧪 Next Steps to Validate

### 1. Test with Real Data (Immediate)

```bash
# Edit test script with real project ID
vim scripts/test-recommendations-engine.ts

# Run test
npx tsx scripts/test-recommendations-engine.ts
```

**Expected output:**
- 1-3 recommendations
- Priority 1 for critical gaps (unanswered questions)
- Detailed reasoning for each recommendation
- Evidence refs where applicable

**Success criteria:** Rick looks at recommendations and says "Yes, I should do these things."

### 2. Integrate into Project Status Agent (Next)

**File to modify:** `app/mastra/agents/project-status-agent.ts`

**Add tool:**
```typescript
import { generateResearchRecommendationsTool } from "~/mastra/tools/generate-research-recommendations";

// Add to project_status_agent_tools
const project_status_agent_tools = {
  // ... existing tools
  generateResearchRecommendations: generateResearchRecommendationsTool,
};
```

**Update agent instructions:**
```
When user asks "who should I talk to next?", "what should I validate?", or "what are my research gaps?",
call generateResearchRecommendations tool to get 3 prioritized recommendations with evidence.
```

### 3. Build UI to Surface Recommendations (After validation)

**Option A: Extend existing AI Insights Panel**
- File: `app/features/dashboard/components/AiInsightCard.tsx`
- Show 3 recommendation cards instead of 1 insight
- Add [Take action] buttons that link to `navigateTo` path

**Option B: New "Insights & Recommendations" Page**
- File: `app/features/dashboard/pages/insightsRecommendations.tsx`
- Full-page layout with recommendations + insights
- As designed by Sally in party mode discussion

### 4. Add Evidence Validation UI (Later, after recommendations proven)

See `Insights-3im` bead for full spec.

---

## 🎯 Success Metrics (Simple, Not Pedantic)

**Usage:**
- Recommendation click-through rate: % acted on
- Time to insight: Upload → recommendation surfaced

**Outcome:**
- Research coverage improvement: % questions answered
- Interview efficiency: # interviews to reach sufficient evidence

**Target:**
- 30-second answer time for "who to talk to next" (vs 5-10 minutes manual)
- 50%+ weekly usage by researchers

---

## 🔍 Open Questions

1. **ICP scores:** Do we have `person_scale` records with `kind_slug='icp_match'` yet? Or does ICP Match Lens need to be built first?
2. **Themes validation_status:** Does `themes` table have `validation_status` column? Or should we use a different signal?
3. **Navigation paths:** Are the `navigateTo` paths correct for UpSight routing? Need to verify with actual route structure.
4. **Recommendation caching:** Should we cache recommendations (1 hour TTL) or compute on-demand? (Current: compute on-demand)

---

## 📝 Files Created/Modified

**Created:**
- ✅ `app/mastra/tools/generate-research-recommendations.ts` - Core recommendation engine
- ✅ `scripts/test-recommendations-engine.ts` - Test script
- ✅ `_bmad-output/implementation-artifacts/evidence-validation-feature-notes.md` - Validation UI spec
- ✅ `_bmad-output/implementation-artifacts/recommendation-engine-implementation-summary.md` - This file

**Modified:**
- ✅ `_bmad-output/implementation-artifacts/tech-spec-wip.md` - Added reference to validation UI as related work

**To Modify Next:**
- ⏳ `app/mastra/agents/project-status-agent.ts` - Add recommendation tool
- ⏳ `app/features/dashboard/` - UI to surface recommendations

---

## 🎉 What Makes This a "WOW" Experience

**Traditional tools:** "Here's a dashboard with your data."

**UpSight recommendations:** "Your 'Pricing' insight has HIGH confidence but only from Enterprise segment. Interview 3 more SMB users ([Sarah], [Mike], [Li]) to validate pricing doesn't vary by segment. [Evidence: Interview #12, #18]. [Schedule interviews →]"

**Differentiation:**
1. **Cross-lens synthesis** - Not just one lens, combines coverage + ICP + confidence
2. **Evidence traceability** - Every claim links back to source quotes with timestamps
3. **Confidence progression** - Shows current state + target state + gap
4. **Actionable** - Clear next steps with pre-filled context (person IDs, theme IDs)
5. **Verifiable** - User can click through to validate AI's reasoning

**This is the moat.** No other tool closes the loop from evidence to confident action.

---

## ✅ TESTED & VALIDATED

**Date:** 2026-02-07
**Status:** ✅ Working with real project data

### Test Results (Rick's Project: 6dbcbb68-0662-4ebc-9f84-dd13b8ff758d)

**Data Found:**
- ✅ 8 themes with evidence (2-22 pieces each)
- ✅ 0 research gaps (all questions fully answered)
- ❌ 0 ICP scores (ICP Match Lens not yet built)

**Generated Recommendation:**
```
[Priority 2] Validate "Instill Confidence with Reliable Tools" theme (LOW confidence)

Why: Theme confidence is LOW (45%). Need 3 more evidence pieces to reach HIGH confidence.
Current: 2 mentions (45%) → Target: 5+ mentions (85%)
Action: validate_theme
Navigate to: /themes/e7859913-d311-4d4a-b48c-edb2419487f9
```

**Validation:**
- ✅ Correctly identified lowest-confidence theme
- ✅ Accurate evidence count from junction table
- ✅ Sensible action recommendation
- ✅ Evidence traceability with theme ID

### Issues Fixed During Testing

1. **Theme Query Pattern** - Changed from looking for non-existent `evidence_count` column to using `theme_evidence` junction:
   ```typescript
   // Before (broken):
   .select("id, name, evidence_count")

   // After (working):
   .select(`id, name, priority, confidence, theme_evidence (evidence_id)`)
   const evidence_count = theme.theme_evidence?.length || 0;
   ```

2. **Removed Invalid Field Check** - Removed check for non-existent `validation_status` column:
   ```typescript
   // Before:
   .filter((t) => t.confidence < 0.8 && t.validation_status !== "validated")

   // After:
   .filter((t) => t.confidence < 0.8 && t.evidence_count < 10)
   ```

3. **Test Script Alignment** - Updated test script to match tool implementation

### Next Steps

**Immediate (Next):**
1. ✅ Document progress ← YOU ARE HERE
2. ✅ Commit working recommendation engine
3. 🔄 Integrate into Project Status Agent
4. 🔄 Test agent integration

**Soon:**
1. Build UI to surface recommendations
2. Add to AI Insights panel or create dedicated page

**Later:**
1. Build ICP Match Lens
2. Build Research Plan UI
3. Add Evidence Validation UI (Bead Insights-3im)
