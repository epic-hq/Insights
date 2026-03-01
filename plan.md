# Survey Agent Enhancement Plan (v2)

## Current State

### What exists today

**`surveyAgent`** (`app/mastra/agents/survey-agent.ts`)
- Model: Claude Sonnet 4
- Tools: `create-survey`, `fetch-surveys`, `delete-survey`, `update-survey-guidelines`, `navigate-to-page`, `generate-project-routes`
- Has its own `/chat/survey` Mastra endpoint but is NOT wired into the main chat flow
- Can: create surveys, list surveys, delete surveys, parse NL branching rules
- Cannot: edit individual questions, update survey settings, analyze question quality, reorder/hide questions
- Has no `Memory`, no `outputProcessors` — unlike agents in the main chat flow

**`researchAgent`** handles survey work in the main chat flow:
- Has `createSurvey`, `fetchSurveys`, `deleteSurvey`, `searchSurveyResponses`
- Does NOT have `updateSurveyGuidelinesTool` (that's only on `surveyAgent`)
- Focused on creation and response analysis, not question editing

**`projectStatusAgent`** routes survey work to `researchAgent`:
- Line 287: "Survey and interview data are handled by the ResearchAgent sub-agent"
- Line 324: "Interview prompts and surveys are handled by the ResearchAgent sub-agent"
- `surveyAgent` is NOT in its `agents` map — completely disconnected

**Routing layer** (`api.chat.project-status.tsx`) — this is the actual traffic director:
- Deterministic routing (line 746): "create/build/generate survey" → `researchAgent` with `survey_quick_create` mode
- `survey_quick_create` (line 973): Fast path that bypasses agents entirely — uses `generateObject` + `createSurveyTool` directly
- LLM classifier prompt (line 121): tells classifier `researchAgent` handles surveys
- Survey-mentioning requests get routed to `researchAgent` directly, never through `projectStatusAgent`'s agent network

**`researchLinkChatAgent`** — handles respondent-facing conversational survey experience
- Receives questions via `requestContext.get("questions")`
- Hidden questions would need to be filtered before reaching this agent

### Architecture insight: how routing actually works

```
User message
  → routeByDeterministicPrompt()     ← keyword matching
  → routeAgentByIntent()             ← LLM classifier
  → targetAgentId selected

  If targetAgentId === "projectStatusAgent":
    → handleNetworkStream()          ← agent network, can delegate to sub-agents
    → sub-agents get requestContext ✅ but NOT context system messages ❌

  If targetAgentId === anything else:
    → handleChatStream()             ← direct to that agent
    → agent gets requestContext ✅ AND context system messages ✅
```

**Key finding**: Sub-agents in the network do NOT receive the `context` system messages (the "Current UI Context" block). They only get `requestContext` key-value pairs. This means making `surveyAgent` a sub-agent of `projectStatusAgent` would leave it blind to the UI context text — which breaks the entire context-awareness design.

### Gap analysis

| Use case | Current capability | Gap |
|---|---|---|
| "Evaluate my questions for bias" | None | Need AI question analysis tool |
| "Rephrase question 3" | `create-survey` can do full overwrites | Need per-question update tool |
| "Keep 10 of 20, hide the rest" | No hidden/status field on questions | Need schema change + tool |
| "Make questions non-leading" | None | Need AI review + update tool |
| General question CRUD | Only full-survey create/update | Need granular question operations |
| Survey settings update | Only via `create-survey` update mode | Need dedicated settings tool |
| Agent is aware user is editing a survey | No `ask` case in `describeResourceContext` | Need UI context + routing |
| Survey requests reach surveyAgent | Routed to researchAgent | Need routing layer update |

---

## Architecture Decision: Direct Routing (not sub-agent)

**Decision**: Make `surveyAgent` a **first-class routing target** in `api.chat.project-status.tsx`, not a sub-agent of `projectStatusAgent`.

**Why**:
1. All specialized agents (`researchAgent`, `chiefOfStaffAgent`, `howtoAgent`, `opsAgent`) are direct routing targets — this is the established pattern
2. Sub-agents don't receive `context` system messages, so `surveyAgent` wouldn't see the "Survey editor (surveyId=...)" UI context if called via network
3. Direct routing means one less hop (no `projectStatusAgent` → network → `surveyAgent`)
4. Direct routing gives `surveyAgent` the full `context` array including UI context

**What changes**:
- Add `surveyAgent` to the routing layer's agent map (like `researchAgent`)
- Add `"surveyAgent"` to `RoutingTargetAgent` type
- Add `MAX_STEPS_BY_AGENT` and `BILLING_MODEL_BY_AGENT` entries
- Add deterministic routing rules for survey-editing intents
- Update the LLM classifier prompt to route survey operations to `surveyAgent`
- Keep `survey_quick_create` fast path on `researchAgent` (it's a creation fast-path, no need to change)
- Also add `surveyAgent` to `projectStatusAgent.agents` as a fallback delegation path

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

**File: `app/mastra/tools/create-survey.ts`**
- Add `hidden: false` to `normalizeSurveyQuestion()` output so new questions always start visible

No database migration needed — `questions` is a JSONB column, and new `hidden` fields simply default to `false`/undefined for existing records.

### Branching + hidden questions strategy

**Approach: Filter hidden questions from the array before rendering, re-resolve broken branch targets.**

When building the question sequence for respondents:

1. Filter: `const visibleQuestions = questions.filter(q => !q.hidden)`
2. The branching engine uses `targetQuestionId` (UUID), not array index, for skip_to targets
3. `getNextQuestionIndex` resolves `targetQuestionId` to an index in the current array
4. If a `skip_to` target points to a hidden question (not in `visibleQuestions`), it won't be found → falls through to linear advance (existing behavior, line in `branching.ts`)
5. If a hidden question's branching conditions reference it as a `questionId`, those conditions can never be met (question was never asked) → rule doesn't fire → linear advance

**Edge case handling**:
- When hiding questions via the tool, emit a warning if any visible question's branching `targetQuestionId` points to the hidden question
- When the AI review tool suggests hiding questions, it should check for branch dependency conflicts

**Where to apply the filter**:
- `app/routes/research.$slug.tsx` — loader: filter before passing to client
- `researchLinkChatAgent` context building — filter before setting `requestContext.questions`

---

## New Tools

### 1. `update-survey-questions` tool
**File: `app/mastra/tools/update-survey-questions.ts`**

Granular question editing. Keeps the schema flat and focused — the LLM picks one operation per call.

```ts
inputSchema: z.object({
  surveyId: z.string(),
  action: z.enum(["update", "reorder", "hide", "unhide", "delete", "add"]),
  // For update: array of partial question updates
  updates: z.array(z.object({
    questionId: z.string(),
    prompt: z.string().nullish(),
    type: z.string().nullish(),
    options: z.array(z.string()).nullish(),
    required: z.boolean().nullish(),
    helperText: z.string().nullish(),
    hidden: z.boolean().nullish(),
  })).nullish(),
  // For hide/unhide/delete: which questions
  questionIds: z.array(z.string()).nullish(),
  // For reorder: full ordered list of question IDs
  orderedIds: z.array(z.string()).nullish(),
  // For add: new questions + insertion point
  newQuestions: z.array(z.object({
    prompt: z.string(),
    type: z.string().optional(),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    helperText: z.string().optional(),
  })).nullish(),
  insertAfterQuestionId: z.string().nullish(),  // null = append at end
})
```

**Output includes branch dependency warnings:**
```ts
outputSchema: z.object({
  success: z.boolean(),
  message: z.string(),
  updatedCount: z.number(),
  warnings: z.array(z.string()).nullish(),  // e.g. "Question 'X' is a branch target for question 'Y'"
})
```

### 2. `review-survey-questions` tool
**File: `app/mastra/tools/review-survey-questions.ts`**

AI-powered question quality analysis. Uses `generateObject` (fast structured output, like the existing `generate-questions` API route) — NOT a conversational LLM call.

```ts
inputSchema: z.object({
  surveyId: z.string(),
  goals: z.string().nullish(),
  reviewType: z.enum([
    "bias_check",
    "quality_review",
    "prioritize",
    "rephrase",
  ]),
  questionIds: z.array(z.string()).nullish(),
  targetCount: z.number().nullish(),
})

// Uses generateObject internally:
// const result = await generateObject({
//   model: anthropic("claude-sonnet-4-20250514"),
//   schema: reviewResultSchema,
//   prompt: buildReviewPrompt(questions, reviewType, goals),
// })

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
    priority: z.number().nullish(),
    recommendation: z.enum(["keep", "hide", "rephrase", "delete"]).nullish(),
  })),
  summary: z.string(),
})
```

### 3. `update-survey-settings` tool
**File: `app/mastra/tools/update-survey-settings.ts`**

Update survey configuration without touching questions. (Same as v1 — this was solid.)

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

## Routing Layer Changes (CRITICAL — this is what makes the agent reachable)

**File: `app/routes/api.chat.project-status.tsx`**

### 1. Add `surveyAgent` to routing infrastructure

```ts
// Add to RoutingTargetAgent type
type RoutingTargetAgent = "projectStatusAgent" | "researchAgent" | ... | "surveyAgent";

// Add to MAX_STEPS_BY_AGENT
surveyAgent: 8,

// Add to BILLING_MODEL_BY_AGENT
surveyAgent: "claude-sonnet-4-20250514",
```

### 2. Add `extractSurveyIdFromSystemContext`

Following the `extractInterviewIdFromSystemContext` pattern (line 303):

```ts
function extractSurveyIdFromSystemContext(systemContext: string): string | null {
  if (!systemContext) return null;
  const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

  // Match: /ask/<uuid>
  const routeMatch = systemContext.match(
    new RegExp(`/ask/(${UUID_PATTERN})\\b`, "i"),
  );
  if (routeMatch?.[1]) return routeMatch[1];

  // Match: "View: Survey editor (surveyId=<uuid>..."
  const viewMatch = systemContext.match(
    new RegExp(`surveyId=(${UUID_PATTERN})`, "i"),
  );
  if (viewMatch?.[1]) return viewMatch[1];

  return null;
}
```

Add to requestContext population (after interview_id block, ~line 1347):
```ts
const surveyIdFromSystemContext = extractSurveyIdFromSystemContext(
  typeof system === "string" ? system : "",
);
if (surveyIdFromSystemContext) {
  requestContext.set("survey_id", surveyIdFromSystemContext);
}
```

### 3. Update deterministic routing

```ts
// EXISTING: Survey creation stays on researchAgent fast path (line 746-756)
// (No change — survey_quick_create is efficient and doesn't need surveyAgent)

// NEW: Survey editing/review routes to surveyAgent
const asksForSurveyEdit =
  hasAny("survey", "ask link", "question", "questionnaire") &&
  hasAny("edit", "rephrase", "rewrite", "update", "change", "hide", "unhide",
         "evaluate", "review", "bias", "improve", "shorten", "simplify",
         "reorder", "prioritize", "keep", "remove");
if (asksForSurveyEdit) {
  return {
    targetAgentId: "surveyAgent",
    confidence: 1,
    responseMode: "normal",
    rationale: "deterministic routing for survey editing/review",
  };
}

// NEW: When user is on survey editor page and asks about "my questions" / "the questions"
const onSurveyPage = surveyIdFromSystemContext != null;
const asksAboutQuestions = hasAny("question", "questions", "my survey", "this survey");
if (onSurveyPage && asksAboutQuestions) {
  return {
    targetAgentId: "surveyAgent",
    confidence: 1,
    responseMode: "normal",
    rationale: "deterministic routing: user on survey page asking about questions",
  };
}
```

### 4. Update LLM classifier prompt

Change line 121 from:
```
- researchAgent: create/manage surveys, interview prompts, interview operations
```
To:
```
- researchAgent: interview prompts, interview operations (NOT surveys - those go to surveyAgent).
- surveyAgent: survey editing, question review/rephrase, survey settings, response analysis. NOT survey creation (that uses researchAgent fast path).
```

### 5. Add surveyAgent to handleChatStream path

The existing code (line 1711-1724) routes `projectStatusAgent` → `handleNetworkStream`, everything else → `handleChatStream`. `surveyAgent` goes through `handleChatStream` (direct), same as `researchAgent`, `howtoAgent`, etc:

```ts
// No structural change needed — the existing else branch handles all non-projectStatusAgent agents
stream = targetAgentId === "projectStatusAgent"
  ? await handleNetworkStream({ ... })
  : await handleChatStream({ ... });  // surveyAgent lands here naturally
```

---

## Agent Changes

### 1. Upgrade `surveyAgent`

**File: `app/mastra/agents/survey-agent.ts`**

Add new tools + memory + output processor:
```ts
import { Memory } from "@mastra/memory";

export const surveyAgent = new Agent({
  tools: {
    "create-survey": createSurveyTool,
    "fetch-surveys": fetchSurveysTool,
    "delete-survey": deleteSurveyTool,
    "update-survey-questions": updateSurveyQuestionsTool,
    "review-survey-questions": reviewSurveyQuestionsTool,
    "update-survey-settings": updateSurveySettingsTool,
    "update-survey-guidelines": updateSurveyGuidelinesTool,
    "search-survey-responses": searchSurveyResponsesTool,
    "navigate-to-page": navigateToPageTool,
    "generate-project-routes": generateProjectRoutesTool,
  },
  memory: new Memory({ storage: getSharedPostgresStore() }),
  outputProcessors: [new TokenLimiterProcessor(45_000)],
  instructions: async ({ requestContext }) => {
    const projectId = requestContext?.get("project_id") ?? "";
    const accountId = requestContext?.get("account_id") ?? "";
    const surveyId = requestContext?.get("survey_id") ?? "";
    // surveyId comes from extractSurveyIdFromSystemContext in the routing layer

    return `You are a survey design assistant...

PROJECT CONTEXT:
- Project ID: ${projectId}
- Account ID: ${accountId}
${surveyId ? `- Active Survey ID: ${surveyId} (user is currently viewing/editing this survey)` : ""}

CONTEXT-AWARE BEHAVIOR:
${surveyId ? `- The user is currently viewing survey ${surveyId}. Use this surveyId for ALL operations by default.
- Do NOT ask "which survey?" — the user is already looking at it.
- For "my questions", "the questions", "this survey" — use surveyId ${surveyId}.` : `- No active survey detected. If the user refers to "my survey" without context, use fetch-surveys to list options.`}

YOUR CAPABILITIES:
1. **Edit Questions**: Update, hide, unhide, delete, add, reorder individual questions
2. **Review Questions**: AI-powered bias check, quality review, prioritization, rephrasing
3. **Manage Settings**: Update survey name, mode, identity, hero section, etc.
4. **Create Surveys**: Generate well-structured surveys from descriptions
5. **Branching Logic**: Parse natural language guidelines into skip logic
6. **Analyze Responses**: Search and summarize survey response data
...`
  },
});
```

### 2. Also add `surveyAgent` to `projectStatusAgent.agents` (fallback path)

Even though direct routing is primary, some ambiguous requests may land on `projectStatusAgent` and it should be able to delegate:

```ts
agents: {
  taskAgent,
  peopleAgent,
  researchAgent,
  opsAgent,
  feedbackAgent,
  chiefOfStaffAgent,
  howtoAgent,
  surveyAgent,          // ADD — fallback delegation path
},
```

Update instructions to delegate survey work to `surveyAgent`:
```
**Surveys/Ask Links**:
- ALL survey operations are handled by the surveyAgent sub-agent:
  - Editing questions, reviewing for bias, rephrasing
  - Survey settings and configuration
  - Response analysis and reporting
  - Survey creation (unless it hit the fast-create path)
```

### 3. Clean up `researchAgent`

**File: `app/mastra/agents/research-agent.ts`**

Remove: `createSurvey`, `deleteSurvey`, `fetchSurveys`, `searchSurveyResponses`

Keep `fetchSurveys` only if cross-referencing is needed (e.g., "what surveys exist for this project" during interview analysis).

Update instructions: Remove all "Survey/Waitlist Creation" sections. Add: "Survey operations are handled by the surveyAgent. I focus on interviews, documents, and web research."

---

## UI Context Awareness

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

### Fix 2: `extractSurveyIdFromSystemContext` + `requestContext.set("survey_id")`

(Covered in Routing Layer Changes above)

This is the key mechanism that makes context work for direct-routed agents — the surveyId is extracted from the system context text and placed into `requestContext` as a structured key. The `surveyAgent` then reads it via `requestContext.get("survey_id")` in its instructions function, just like `researchAgent` reads `interview_id`.

---

## Implementation Phases

### Phase 1: UI context + routing (unblocks everything)
1. Add `ask` case to `describeResourceContext()` in `ProjectStatusAgentChat.tsx`
2. Add `extractSurveyIdFromSystemContext` in `api.chat.project-status.tsx`
3. Add `surveyAgent` to routing infrastructure (type, max steps, billing model)
4. Add deterministic routing rules for survey editing intents
5. Update LLM classifier prompt to route survey ops to `surveyAgent`
6. Add `requestContext.set("survey_id", ...)` to the request context population

### Phase 2: Schema + tools
1. Add `hidden` field to `ResearchLinkQuestionSchema`
2. Create `update-survey-questions` tool
3. Create `update-survey-settings` tool
4. Update `normalizeSurveyQuestion()` in `create-survey.ts` to include `hidden: false`
5. Update respondent-facing question flow to filter hidden questions (`research.$slug.tsx` loader)
6. Update `researchLinkChatAgent` question passing to filter hidden questions
7. Update `QuestionListEditor` UI to support hidden state

### Phase 3: AI review tool
1. Create `review-survey-questions` tool with `generateObject` (NOT conversational LLM)
2. Include branch-dependency warnings when recommending hide/delete

### Phase 4: Agent wiring
1. Add new tools + memory + outputProcessors to `surveyAgent`
2. Update `surveyAgent` instructions for new capabilities + context awareness + `survey_id`
3. Add `surveyAgent` to `projectStatusAgent.agents` (fallback delegation)
4. Update `projectStatusAgent` instructions to delegate surveys to `surveyAgent`
5. Remove survey tools from `researchAgent`
6. Update `researchAgent` instructions

### Phase 5: Testing
1. Test deterministic routing: "evaluate my questions" on survey page → `surveyAgent`
2. Test context-awareness: `survey_id` arrives in `requestContext` when on survey editor
3. Test question CRUD operations via `update-survey-questions` tool
4. Test AI review tool with various question sets via `generateObject`
5. Test hidden question filtering in respondent form + chat mode
6. Test branching engine behavior when hidden questions are branch targets
7. Test `survey_quick_create` fast path still works for creation
8. Test fallback: ambiguous survey request via `projectStatusAgent` → `surveyAgent` delegation

---

## Coexistence with `survey_quick_create`

The existing fast path (line 746-756, 973+) handles "create a survey" requests:
- Uses `generateObject` + `createSurveyTool` directly
- Bypasses all agents — very fast
- Returns a pre-filled survey with questions

**Decision**: Keep this path as-is. It's optimized for creation and doesn't conflict.
- `survey_quick_create` handles: "create a survey about onboarding"
- `surveyAgent` handles: "evaluate my questions", "rephrase question 3", "make it anonymous"
- The deterministic routing distinguishes these by keywords (create/build/generate vs edit/review/rephrase)

---

## Additional Use Cases the New Architecture Supports

1. **"Evaluate my questions for bias"** — routing detects survey edit intent → `surveyAgent` → `review-survey-questions` (bias_check) with `survey_id` from context
2. **"Rephrase question 3"** — `surveyAgent` fetches survey, finds question at position 3, calls `review-survey-questions` (rephrase) then `update-survey-questions` (update)
3. **"Keep the 10 best, hide the rest"** — `review-survey-questions` (prioritize, targetCount=10) → `update-survey-questions` (hide) on the low-priority ones
4. **"Make questions non-leading"** — `review-survey-questions` (quality_review) → present findings → `update-survey-questions` (update) with suggested prompts
5. **"Add a follow-up question after question 5"** — `update-survey-questions` with `action: "add"` and `insertAfterQuestionId`
6. **"Make all questions required"** — `update-survey-questions` with `action: "update"` on all IDs
7. **"Switch to voice mode"** — `update-survey-settings` with `allowVoice: true, defaultResponseMode: "voice"`
8. **"How are people responding to the pricing question?"** — `search-survey-responses` with query
9. **"Generate 5 more questions about onboarding"** — `surveyAgent` uses inline `generateObject` call, then `update-survey-questions` with `action: "add"`
10. **"Make this survey anonymous"** — `update-survey-settings` with `identityType: "anonymous"`
