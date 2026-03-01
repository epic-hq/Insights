# Survey Agent Enhancement Plan

## Current State

### What exists today

**`surveyAgent`** (`app/mastra/agents/survey-agent.ts`)
- Model: Claude Sonnet 4
- Tools: `create-survey`, `fetch-surveys`, `delete-survey`, `update-survey-guidelines`, `navigate-to-page`, `generate-project-routes`
- Has its own `/chat/survey` endpoint but is NOT wired as a sub-agent of `projectStatusAgent`
- Can: create surveys, list surveys, delete surveys, parse NL branching rules
- Cannot: edit individual questions, update survey settings, analyze question quality, reorder/hide questions

**`researchAgent`** handles survey work delegated from `projectStatusAgent`:
- Has `createSurvey`, `fetchSurveys`, `deleteSurvey`, `searchSurveyResponses`
- Focused on creation and response analysis, not question editing

**`projectStatusAgent`** routes all survey work to `researchAgent` (not `surveyAgent`):
- Line 287: "Survey and interview data are handled by the ResearchAgent sub-agent"
- Line 327: "Survey creation is handled by the ResearchAgent sub-agent"
- `surveyAgent` is registered in Mastra but orphaned from the agent network

### Gap analysis

| Use case | Current capability | Gap |
|---|---|---|
| "Evaluate my questions for bias" | None | Need AI question analysis tool |
| "Rephrase question 3" | `create-survey` can do full overwrites | Need per-question update tool |
| "Keep 10 of 20, hide the rest" | No hidden/status field on questions | Need schema change + tool |
| "Make questions non-leading" | None | Need AI review + update tool |
| General question CRUD | Only full-survey create/update | Need granular question operations |
| Survey settings update | Only via `create-survey` update mode | Need dedicated settings tool |

---

## Schema Change: Add `hidden` field to questions

### Why `hidden` instead of delete
- User may want to bring questions back later
- "Of the 20, keep the 10 best" is safer as hide than delete
- Branching rules reference question IDs — deleting breaks them

### Change

**File: `app/features/research-links/schemas.ts`**
Add `hidden` field to `ResearchLinkQuestionSchema`:
```ts
hidden: z.boolean().optional().default(false),
```

**File: `app/features/research-links/components/QuestionListEditor.tsx`**
- Show hidden questions with a dimmed/strikethrough style and an "eye-off" icon
- Add toggle to show/hide hidden questions in the list
- Add "Hide" / "Unhide" action in the question edit drawer

**File: Survey respondent flow (public form rendering)**
- Filter out questions where `hidden === true` when building the question sequence
- The branching engine should skip hidden questions

**File: `app/mastra/tools/create-survey.ts`**
- Add `hidden: false` to `normalizeSurveyQuestion()` output so new questions always start visible

No database migration needed — `questions` is a JSONB column, and new `hidden` fields simply default to `false`/undefined for existing records.

---

## New Tools

### 1. `update-survey-questions` tool
**File: `app/mastra/tools/update-survey-questions.ts`**

Granular question operations within a survey. Supports these actions:

| Action | Description |
|---|---|
| `update` | Update prompt, type, options, helperText, required, hidden on specific questions by ID |
| `reorder` | Reorder questions by providing an array of question IDs in the desired order |
| `hide` | Set `hidden: true` on specific question IDs |
| `unhide` | Set `hidden: false` on specific question IDs |
| `delete` | Permanently remove questions by ID |
| `add` | Add new questions at a specific position |

```ts
inputSchema: z.object({
  surveyId: z.string(),
  action: z.enum(["update", "reorder", "hide", "unhide", "delete", "add"]),
  questionIds: z.array(z.string()).nullish(),       // For hide/unhide/delete/reorder
  updates: z.array(z.object({                       // For update action
    questionId: z.string(),
    prompt: z.string().nullish(),
    type: z.string().nullish(),
    options: z.array(z.string()).nullish(),
    required: z.boolean().nullish(),
    helperText: z.string().nullish(),
    hidden: z.boolean().nullish(),
  })).nullish(),
  newQuestions: z.array(z.record(z.unknown())).nullish(),  // For add action
  position: z.number().nullish(),                          // For add action
})
```

### 2. `review-survey-questions` tool
**File: `app/mastra/tools/review-survey-questions.ts`**

AI-powered question quality analysis. Uses an LLM call (not BAML — inline Anthropic call like `generate-questions.tsx`) to evaluate questions against research best practices.

```ts
inputSchema: z.object({
  surveyId: z.string(),
  goals: z.string().nullish(),           // What the survey is trying to learn
  reviewType: z.enum([
    "bias_check",          // Check for leading, loaded, double-barreled questions
    "quality_review",      // General quality: clarity, specificity, actionability
    "prioritize",          // Rank questions by importance given goals, suggest which to keep/hide
    "rephrase",            // Suggest improved phrasings for all or specific questions
  ]),
  questionIds: z.array(z.string()).nullish(),  // Limit review to specific questions
  targetCount: z.number().nullish(),           // For "prioritize": how many to keep
})

outputSchema: z.object({
  success: z.boolean(),
  message: z.string(),
  reviews: z.array(z.object({
    questionId: z.string(),
    originalPrompt: z.string(),
    issues: z.array(z.object({
      type: z.enum(["leading", "loaded", "double_barreled", "vague", "jargon", "redundant", "low_priority"]),
      explanation: z.string(),
      severity: z.enum(["high", "medium", "low"]),
    })).nullish(),
    suggestedPrompt: z.string().nullish(),
    priority: z.number().nullish(),          // 1-10, for prioritize mode
    recommendation: z.enum(["keep", "hide", "rephrase", "delete"]).nullish(),
  })),
  summary: z.string(),
  suggestedActions: z.array(z.object({
    action: z.string(),
    description: z.string(),
  })).nullish(),
})
```

### 3. `update-survey-settings` tool
**File: `app/mastra/tools/update-survey-settings.ts`**

Update survey configuration without touching questions.

```ts
inputSchema: z.object({
  surveyId: z.string(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  isLive: z.boolean().nullish(),
  allowChat: z.boolean().nullish(),
  allowVoice: z.boolean().nullish(),
  allowVideo: z.boolean().nullish(),
  defaultResponseMode: z.enum(["form", "chat", "voice"]).nullish(),
  aiAutonomy: z.enum(["strict", "moderate", "adaptive"]).nullish(),
  identityType: z.enum(["anonymous", "email", "phone"]).nullish(),
  respondentFields: z.array(z.string()).nullish(),
  heroTitle: z.string().nullish(),
  heroSubtitle: z.string().nullish(),
  heroCtaLabel: z.string().nullish(),
  calendarUrl: z.string().nullish(),
  redirectUrl: z.string().nullish(),
})
```

---

## Agent Wiring Changes

### 1. Upgrade `surveyAgent` to be the survey specialist sub-agent

**File: `app/mastra/agents/survey-agent.ts`**

Add new tools:
```ts
tools: {
  "create-survey": createSurveyTool,
  "fetch-surveys": fetchSurveysTool,
  "delete-survey": deleteSurveyTool,
  "update-survey-questions": updateSurveyQuestionsTool,    // NEW
  "review-survey-questions": reviewSurveyQuestionsTool,    // NEW
  "update-survey-settings": updateSurveySettingsTool,      // NEW
  "update-survey-guidelines": updateSurveyGuidelinesTool,
  "search-survey-responses": searchSurveyResponsesTool,    // MOVE from researchAgent
  "navigate-to-page": navigateToPageTool,
  "generate-project-routes": generateProjectRoutesTool,
}
```

Update instructions to cover the new use cases:
- Question quality review ("check for bias", "make non-leading")
- Question editing ("rephrase question 3", "make it shorter")
- Question curation ("keep the 10 best", "hide questions about X")
- Settings management ("make it anonymous", "enable voice mode")
- Response analysis (moved from researchAgent)

### 2. Wire `surveyAgent` into `projectStatusAgent` as a sub-agent

**File: `app/mastra/agents/project-status-agent.ts`**

Add to `agents` map:
```ts
agents: {
  taskAgent,
  peopleAgent,
  researchAgent,
  opsAgent,
  feedbackAgent,
  chiefOfStaffAgent,
  howtoAgent,
  surveyAgent,          // ADD
},
```

Update instructions to delegate survey work to `surveyAgent` instead of `researchAgent`:
```
**Surveys/Ask Links**:
- ALL survey operations are handled by the surveyAgent sub-agent:
  - Creating, editing, deleting surveys
  - Question quality review and bias checking
  - Question rephrasing and curation
  - Survey settings and configuration
  - Response analysis and reporting
```

### 3. Remove survey tools from `researchAgent`

**File: `app/mastra/agents/research-agent.ts`**

Remove: `createSurvey`, `deleteSurvey`, `fetchSurveys`, `searchSurveyResponses`

Update instructions: "Survey operations are handled by the surveyAgent. I focus on interviews, documents, and web research."

Keep `fetchSurveys` only if needed for interview context cross-referencing; otherwise remove entirely.

---

## UI Context Awareness (CRITICAL)

The frontend already passes UI context to the agent via `describeCurrentProjectView()` in `ProjectStatusAgentChat.tsx`, which builds a `Current UI Context:` block from the user's current route. This is how the agent knows the user is viewing a specific interview, person, etc.

**Problem**: The `ask` resource has NO dedicated case in `describeResourceContext()` (line 2191). It falls to the generic `default` case, producing vague output like:
```
View: ask (context=0ffdc963-4c2f-4fdb-b439-d0cfe2f82b03)
```
When the user is on `/a/:accountId/:projectId/ask/:listId/edit`, the agent should know they're **editing a specific survey**.

### Fix 1: Add `ask` case to `describeResourceContext()`

**File: `app/components/chat/ProjectStatusAgentChat.tsx`** (line ~2196)

```ts
case "ask": {
  if (!id) return "View: Surveys list (Ask Links)";
  if (id === "new") return "View: Creating new survey";
  const subpage = remainder[1];
  if (subpage === "edit") return `View: Survey editor (surveyId=${id}, editing questions & settings)`;
  if (subpage === "responses") {
    const responseId = remainder[2];
    if (responseId) return `View: Survey response detail (surveyId=${id}, responseId=${responseId})`;
    return `View: Survey responses (surveyId=${id})`;
  }
  return `View: Survey detail (surveyId=${id})`;
}
```

This gives the agent rich, structured context:
- `View: Survey editor (surveyId=0ffdc963-..., editing questions & settings)` — when editing
- `View: Survey responses (surveyId=0ffdc963-...)` — when viewing responses
- `View: Surveys list (Ask Links)` — when browsing all surveys

### Fix 2: Add "Survey Editor Mode" to `projectStatusAgent` instructions

**File: `app/mastra/agents/project-status-agent.ts`**

Add a section similar to "Interview Detail Mode (No Generic Advice)" (line 302):

```
**Survey Editor Mode (Context-Aware):**
- If the system context shows you're on a survey editor page (e.g., "View: Survey editor (surveyId=...)"),
  treat ALL survey-related requests as scoped to that survey automatically.
- The user should NOT need to specify which survey — extract the surveyId from the UI context.
- Delegate to surveyAgent with the surveyId pre-filled.
- For prompts like "evaluate my questions", "rephrase question 3", "make it shorter":
  1. Delegate to surveyAgent with the surveyId from context.
  2. surveyAgent should fetch the survey's questions first, then operate on them.
  3. Do NOT ask the user which survey — they're already looking at it.
```

### Fix 3: Make `surveyAgent` instructions consume UI context

**File: `app/mastra/agents/survey-agent.ts`**

Add to the instructions:

```
UI CONTEXT AWARENESS:
- When called from projectStatusAgent, you may receive the user's current view context.
- If the context says "Survey editor (surveyId=<id>)", use that surveyId as the default
  for ALL operations — do NOT ask the user to specify a survey.
- If a user says "evaluate my questions" while on the survey editor, fetch that survey's
  questions and review them immediately.
- If the user says "this survey" or "my survey" or "the questions", resolve it from context.
```

---

## Implementation Phases

### Phase 1: Schema + Question CRUD tool (foundation)
1. Add `hidden` field to `ResearchLinkQuestionSchema`
2. Create `update-survey-questions` tool
3. Create `update-survey-settings` tool
4. Update `normalizeSurveyQuestion()` in `create-survey.ts` to include `hidden: false`
5. Update respondent-facing question flow to skip hidden questions
6. Update `QuestionListEditor` UI to support hidden state

### Phase 2: AI question review tool
1. Create `review-survey-questions` tool with Anthropic LLM call
2. Integrate with `update-survey-questions` for apply-suggestions workflow

### Phase 3: Agent wiring + UI context
1. Add `ask` case to `describeResourceContext()` in `ProjectStatusAgentChat.tsx`
2. Add new tools to `surveyAgent`
3. Update `surveyAgent` instructions for new capabilities + UI context awareness
4. Add `surveyAgent` to `projectStatusAgent.agents`
5. Add "Survey Editor Mode" to `projectStatusAgent` instructions (like Interview Detail Mode)
6. Update `projectStatusAgent` instructions to route surveys to `surveyAgent`
7. Remove survey tools from `researchAgent`
8. Update `researchAgent` instructions

### Phase 4: Testing
1. Test the full agent delegation flow: user → projectStatusAgent → surveyAgent
2. Test question CRUD operations
3. Test AI review tool with various question sets
4. Test hidden question behavior in respondent flow
5. Test branching engine with hidden questions

---

## Additional Use Cases the New Architecture Supports

Beyond the four listed:

5. **"Add a follow-up question after question 5"** — `update-survey-questions` with `action: "add"` and `position: 5`
6. **"Make all questions required"** — `update-survey-questions` with `action: "update"` on all IDs
7. **"Switch to voice mode"** — `update-survey-settings` with `allowVoice: true, defaultResponseMode: "voice"`
8. **"How are people responding to the pricing question?"** — `search-survey-responses` with questionTypes filter
9. **"Generate 5 more questions about onboarding"** — surveyAgent calls the existing `generate-questions` API route or uses an inline LLM call, then `update-survey-questions` with `action: "add"`
10. **"Make this survey anonymous"** — `update-survey-settings` with `identityType: "anonymous"`
