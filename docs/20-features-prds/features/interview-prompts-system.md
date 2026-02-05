# Interview Prompts System

> **Confidence: 94%** - Analysis complete, Priority 1 fix implemented. Remaining: auto-generation and chat history fallback.

## Overview

The Interview Prompts System generates and manages conversation prompts for user research interviews. It integrates with the project setup flow and research structure to create contextually relevant questions.

---

## User Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        PROJECT SETUP                                 │
├─────────────────────────────────────────────────────────────────────┤
│  1. User creates project                                            │
│  2. User completes 8 setup questions via:                           │
│     - Form UI (ProjectGoalsScreen)                                  │
│     - Chat UI (projectSetupAgent)                                   │
│  3. Data saved to project_sections table                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   RESEARCH STRUCTURE GENERATION                      │
├─────────────────────────────────────────────────────────────────────┤
│  Triggered automatically when setup complete                        │
│  Uses BAML GenerateResearchStructure function                       │
│                                                                      │
│  Creates:                                                            │
│  • 2-3 Decision Questions (strategic business decisions)            │
│  • 2-4 Research Questions per DQ (investigative questions)          │
│  • 2-3 Interview Prompts per RQ (conversational questions)          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    INTERVIEW PROMPTS PAGE                            │
├─────────────────────────────────────────────────────────────────────┤
│  Route: /a/:accountId/:projectId/questions                          │
│  Component: InterviewQuestionsManager                               │
│                                                                      │
│  Features:                                                           │
│  • View/edit generated prompts                                       │
│  • Drag-and-drop reordering                                         │
│  • Generate more questions                                           │
│  • AI-powered contextual suggestions                                 │
│  • Quality flags and scoring                                         │
│  • Category-based organization                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Current Issues & Root Causes

### Issue 1: Prompts Not Showing

**Symptoms:** InterviewQuestionsManager shows empty state even when project has setup data.

**Root Causes:**

1. **Missing research_goal in loader** - The questions page loader only fetches `research_goal` from `project_sections`, but doesn't pass other required context (target_roles, assumptions, etc.)

2. **Research structure not generated** - The `generateResearchStructure` tool only runs when explicitly called by the agent or when all 8 setup questions are answered. If user skips questions or uses form UI without triggering generation, no prompts exist.

3. **Data source mismatch** - `InterviewQuestionsManager` loads from `interview_prompts` table, but generation saves to that table only after `GenerateResearchStructure` BAML function runs.

4. **Auto-generate condition too narrow** - The `autoGenerateOnEmpty` flag triggers `generateQuestions()` but requires `research_goal` prop to be passed, which may be empty if loader doesn't fetch it.

### Issue 2: Brittle Generation Flow

**Current Flow:**

```text
projectSetupAgent → saveProjectSectionsData → generateResearchStructure → /api/generate-research-structure → BAML → interview_prompts table
```

**Problems:**

- Tight coupling between agent and API
- No fallback if agent doesn't complete
- Form UI doesn't trigger generation automatically
- Chat history not used as fallback context

---

## Technical Implementation

### Data Sources

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `project_sections` | Stores setup data | `kind`, `meta`, `content_md` |
| `decision_questions` | Strategic decisions | `text`, `rationale`, `project_id` |
| `research_questions` | Investigative questions | `text`, `decision_question_id` |
| `interview_prompts` | Conversation prompts | `text`, `category`, `research_question_id` |

### Key Files

| File | Purpose |
|------|---------|
| `app/components/questions/InterviewQuestionsManager.tsx` | Main UI component |
| `app/features/questions/pages/index.tsx` | Route page with loader |
| `app/routes/api.generate-questions.tsx` | Question generation API |
| `app/routes/api.generate-research-structure.tsx` | Full structure generation |
| `app/mastra/tools/generate-research-structure.ts` | Agent tool wrapper |
| `app/mastra/agents/project-setup-agent.ts` | Setup chat agent |
| `baml_src/research_analysis.baml` | BAML functions |

### Generation Functions

1. **GenerateResearchStructure** (BAML) - Creates full hierarchy: DQs → RQs → Prompts
2. **GenerateQuestionSet** (BAML) - Creates standalone question set for interviews
3. **generateQuestions()** (client) - Calls `/api/generate-questions` for incremental generation

---

## Improvements

### ✅ Priority 1: Fix Data Loading (COMPLETED)

**Problem:** Questions page loader didn't pass sufficient context to InterviewQuestionsManager.

**Solution Applied:** Enhanced loader to fetch all project context using `getProjectContextGeneric()`:

- Now passes `research_goal`, `target_roles`, `target_orgs`, `assumptions`, `unknowns`
- Checks if `interview_prompts` exist and sets `needsGeneration` flag
- Component receives full context for question generation

**Files Modified:**

- `app/features/questions/pages/index.tsx` - Enhanced loader with full context

### Priority 2: Auto-Generate on Page Load (High Impact, Medium Effort)

**Problem:** User must manually trigger generation or complete agent flow.

**Solution:** Add automatic generation when prompts are missing but context exists:

```typescript
// In InterviewQuestionsManager or questions page
useEffect(() => {
  if (needsGeneration && !generating && !hasPrompts) {
    // Trigger research structure generation
    fetch('/api/generate-research-structure', {
      method: 'POST',
      body: new FormData().append('project_id', projectId)
    })
  }
}, [needsGeneration, generating, hasPrompts, projectId])
```

### Priority 3: Chat History Fallback (Medium Impact, Medium Effort)

**Problem:** If user provides context via chat but doesn't complete all 8 questions, that context is lost.

**Solution:** Extract context from agent chat history as fallback:

```typescript
// New utility: extractContextFromChatHistory
async function extractContextFromChatHistory(
  supabase: SupabaseClient,
  projectId: string
): Promise<Partial<ProjectContext>> {
  // Query mastra memory for recent messages
  const { data: messages } = await supabase
    .from("mastra_messages")
    .select("content, role")
    .eq("resource_id", `projectSetupAgent-${projectId}`)
    .order("created_at", { ascending: false })
    .limit(50)

  if (!messages?.length) return {}

  // Use BAML to extract structured data from conversation
  const extracted = await b.ExtractProjectContextFromChat(
    messages.map(m => `${m.role}: ${m.content}`).join('\n')
  )

  return extracted
}
```

### Priority 4: Unified Generation Trigger (Medium Impact, High Effort)

**Problem:** Multiple entry points (form, chat, API) with inconsistent behavior.

**Solution:** Create single generation service:

```typescript
// app/services/research-structure.server.ts
export async function ensureResearchStructure(
  supabase: SupabaseClient,
  projectId: string,
  options?: { force?: boolean }
): Promise<{ generated: boolean; error?: string }> {
  // 1. Check if structure already exists
  const { data: existing } = await supabase
    .from("interview_prompts")
    .select("id")
    .eq("project_id", projectId)
    .limit(1)

  if (existing?.length && !options?.force) {
    return { generated: false }
  }

  // 2. Load project context (with chat history fallback)
  let context = await getProjectContextGeneric(supabase, projectId)

  if (!context?.merged?.research_goal) {
    // Try chat history fallback
    const chatContext = await extractContextFromChatHistory(supabase, projectId)
    if (chatContext.research_goal) {
      context = { merged: { ...context?.merged, ...chatContext } }
    }
  }

  // 3. Validate minimum requirements
  if (!context?.merged?.research_goal) {
    return { generated: false, error: "Research goal required" }
  }

  // 4. Generate structure
  const result = await generateResearchStructure(context.merged, projectId)

  return { generated: true }
}
```

---

## Tech Debt to Eliminate

| Debt | Impact | Fix |
|------|--------|-----|
| Duplicate context loading | Performance | Use `getProjectContextGeneric` everywhere |
| Form vs Chat inconsistency | UX confusion | Unified generation trigger |
| Legacy `research_goal_details` | Code complexity | Migrate to single `research_goal` field |
| Hardcoded category IDs | Maintainability | Use category config from shared module |
| Multiple generation endpoints | Confusion | Consolidate to single service |

---

## Database Schema Reference

```sql
-- Decision Questions (strategic level)
CREATE TABLE decision_questions (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  text TEXT NOT NULL,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Research Questions (investigative level)
CREATE TABLE research_questions (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  decision_question_id UUID REFERENCES decision_questions(id),
  text TEXT NOT NULL,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview Prompts (conversation level)
CREATE TABLE interview_prompts (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  research_question_id UUID REFERENCES research_questions(id),
  text TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'proposed',
  is_must_have BOOLEAN DEFAULT FALSE,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Next Steps

1. **Immediate:** Fix loader to pass full project context to InterviewQuestionsManager
2. **Short-term:** Add auto-generation when prompts missing but context exists
3. **Medium-term:** Implement chat history fallback for partial setups
4. **Long-term:** Consolidate to unified research structure service

---

## Related Documentation

- [Research Analysis Hierarchy](./research-analysis-hierarchy.md) - DQ → RQ → Prompt structure
- [Onboarding Implementation](./onboarding/implementation.md) - Setup flow details
- [Project Chat](./project-chat.md) - Agent integration
