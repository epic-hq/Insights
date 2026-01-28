# PRD: Survey Conditional Logic & Branching

**Status:** Draft
**Author:** Claude (with Richard)
**Created:** 2026-01-28
**Priority:** P1

---

## Problem Statement

Currently, UpSight surveys present questions in a fixed linear order. All respondents see the same questions regardless of their segment, role, or previous answers. This creates friction:

- **Irrelevant questions**: A B2C founder sees B2B-focused questions
- **Missed depth**: We can't drill deeper when answers warrant follow-up
- **Manual workarounds**: Users create multiple surveys for different segments
- **Lost context**: Interviewers manually skip questions, losing structure

**User quote (Richard):** "If we determine the user is a sponsor, we want to ask different questions than an entrepreneur or member. If they're B2C, different questions than B2B."

---

## Goals

1. **Segment-aware questioning**: Route respondents to relevant question paths based on early answers
2. **Dynamic follow-ups**: Dig deeper on interesting responses without pre-configuring every branch
3. **Simple configuration**: No complex visual builders—leverage AI for the heavy lifting
4. **Works in both modes**: Form mode (structured) and chat mode (conversational)

**Non-goals:**
- Visual drag-and-drop flowchart editors
- Piping/variables beyond basic branching

---

## Decisions (from Richard)

1. **Target segments**: B2B/B2C, founders, small teams, non-professional researchers
2. **Condition complexity**: Need AND/OR (e.g., "if hasn't purchased OR hasn't considered")
3. **AI autonomy**: Flexible—AI can skip/reorder in chat mode
4. **Analytics**: Nice-to-have for QA/audit; responses are priority
5. **Priority**: Form mode first, but **shared system underneath** for both modes
6. **CRM Integration**: Leverage person data (job function, company, past interviews) during AI interviews
7. **Tiered access**: Simple branching for all; advanced AI features can be gated/premium

---

## Tiered Feature Architecture

### Why Tier?

Our CRM-powered AI interviewing is genuinely differentiated—we have rich person context (job function, company, past interviews, facets) that competitors don't. This justifies a premium tier while still providing value to all users.

### Feature Matrix

| Feature | Form Mode (All) | Chat Strict (All) | Chat Adaptive (Gated) |
|---------|----------------|-------------------|----------------------|
| Skip logic rules | ✓ | — | — |
| Conversational UI | — | ✓ | ✓ |
| Follows script exactly | ✓ | ✓ | — |
| Uses CRM person context | — | — | ✓ |
| Can probe deeper on interesting answers | — | — | ✓ |
| Can skip irrelevant questions | — | — | ✓ |
| References past interviews | — | — | ✓ |
| Research goals guide questioning | — | — | ✓ |
| Semantic search for similar respondents | — | — | ✓ |

### Tier Definitions

**Tier 1: Simple Branching (Form Mode) — All Users**
- Static skip logic configured in survey builder
- Deterministic: same inputs → same path
- No AI during survey
- What we built in Phase 1

**Tier 2: Conversational (Chat Strict) — All Users**
- AI makes questions conversational
- Follows question order exactly
- No improvisation or probing
- Current chat agent behavior

**Tier 3: AI Adaptive Interviewing (Chat Adaptive) — Gated/Premium**
- AI uses CRM context (person details, job function, company)
- Can probe deeper based on interesting responses
- Can skip questions irrelevant to this person's context
- Research goals/intentions guide improvisation
- References evidence from past interviews with similar people

---

## Competitive Analysis Summary

| Tool | Approach | Complexity | AI Integration |
|------|----------|------------|----------------|
| **Typeform** | Visual logic map + per-question rules | Medium | "Clarify" generates 2 follow-ups per open-ended |
| **SurveyMonkey** | Rules engine (conditions → actions) | High | Survey generation from prompt |
| **Dovetail** | None (analysis-focused) | N/A | Post-interview tagging |
| **UserTesting** | Screener branching only | Low | Auto-generate test plans from Figma |
| **Qualtrics** | Branch logic in survey flow | High | Limited |

**Key insight**: Typeform's "Formless" (GPT-4 conversational) and "Clarify" (AI follow-ups) are the future direction. Complex rule builders are being replaced by AI-driven dynamic questioning.

---

## Proposed Solution

### Two-Track Approach

**Track A: Simple Skip Logic (Form Mode)**
- Per-question rules: "If answer = X, skip to question Y"
- Covers 80% of use cases (segment routing, disqualification)
- Stored in question schema, evaluated client-side

**Track B: AI Dynamic Questioning (Chat Mode)**
- LLM decides when to probe deeper vs. move on
- Segment detection happens naturally in conversation
- Already have Mastra agent infrastructure—extend it

### Why This Approach?

1. **Speed**: Skip logic is 1-2 weeks; AI dynamic is additive to existing chat
2. **Differentiation**: Complex logic builders commoditized; AI questioning is our moat
3. **User experience**: No learning curve for "logic" configuration
4. **Flexibility**: AI adapts to unexpected segments without pre-configuration

---

## Detailed Design

### Shared Branching Engine (Core System)

A single evaluation engine used by both form and chat modes. This ensures consistent behavior and avoids logic divergence.

#### Data Model

**New file: `app/features/research-links/branching.ts`**

```typescript
// Condition types
type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "selected"      // For multi-select: value is in array
  | "not_selected"  // For multi-select: value not in array
  | "answered"      // Question has any response
  | "not_answered"  // Question has no response

// Single condition
interface Condition {
  questionId: string           // Which question to check
  operator: ConditionOperator
  value?: string | string[]    // Expected value(s)
}

// Condition group with AND/OR logic
interface ConditionGroup {
  logic: "and" | "or"
  conditions: Condition[]
}

// Branch rule
interface BranchRule {
  id: string
  conditions: ConditionGroup   // Supports AND/OR
  action: "skip_to" | "end_survey"
  targetQuestionId?: string    // For skip_to
  label?: string               // "Route B2C users"
}

// Attached to each question
interface QuestionBranching {
  rules: BranchRule[]          // Evaluated in order, first match wins
  defaultNext?: string         // Override linear order (optional)
}
```

**Example: "If hasn't purchased OR hasn't considered, skip to pricing questions"**

```json
{
  "rules": [{
    "id": "skip-to-pricing",
    "conditions": {
      "logic": "or",
      "conditions": [
        { "questionId": "q_purchased", "operator": "equals", "value": "no" },
        { "questionId": "q_considered", "operator": "equals", "value": "no" }
      ]
    },
    "action": "skip_to",
    "targetQuestionId": "q_pricing",
    "label": "Non-buyers → pricing questions"
  }]
}
```

#### Evaluation Function

```typescript
// app/features/research-links/branching.ts

export function evaluateCondition(
  condition: Condition,
  responses: Record<string, ResponseValue>
): boolean {
  const answer = responses[condition.questionId]

  switch (condition.operator) {
    case "equals":
      return answer === condition.value
    case "not_equals":
      return answer !== condition.value
    case "contains":
      return String(answer).toLowerCase().includes(String(condition.value).toLowerCase())
    case "selected":
      return Array.isArray(answer) && answer.includes(condition.value as string)
    case "not_selected":
      return !Array.isArray(answer) || !answer.includes(condition.value as string)
    case "answered":
      return answer !== undefined && answer !== null && answer !== ""
    case "not_answered":
      return answer === undefined || answer === null || answer === ""
    default:
      return false
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup,
  responses: Record<string, ResponseValue>
): boolean {
  if (group.logic === "and") {
    return group.conditions.every(c => evaluateCondition(c, responses))
  } else {
    return group.conditions.some(c => evaluateCondition(c, responses))
  }
}

export function getNextQuestionId(
  currentQuestion: ResearchLinkQuestion,
  questions: ResearchLinkQuestion[],
  responses: Record<string, ResponseValue>
): string | null {
  const branching = currentQuestion.branching

  if (branching?.rules) {
    for (const rule of branching.rules) {
      if (evaluateConditionGroup(rule.conditions, responses)) {
        if (rule.action === "end_survey") return null
        if (rule.action === "skip_to") return rule.targetQuestionId ?? null
      }
    }
  }

  // Default: next in order
  const currentIndex = questions.findIndex(q => q.id === currentQuestion.id)
  const nextQuestion = questions[currentIndex + 1]
  return nextQuestion?.id ?? null
}
```

#### Schema Extension

Extend `ResearchLinkQuestionSchema` in `app/features/research-links/schemas.ts`:

```typescript
const ConditionSchema = z.object({
  questionId: z.string(),
  operator: z.enum([
    "equals", "not_equals", "contains", "not_contains",
    "selected", "not_selected", "answered", "not_answered"
  ]),
  value: z.union([z.string(), z.array(z.string())]).optional(),
})

const ConditionGroupSchema = z.object({
  logic: z.enum(["and", "or"]),
  conditions: z.array(ConditionSchema),
})

const BranchRuleSchema = z.object({
  id: z.string(),
  conditions: ConditionGroupSchema,
  action: z.enum(["skip_to", "end_survey"]),
  targetQuestionId: z.string().optional(),
  label: z.string().optional(),
})

export const ResearchLinkQuestionSchema = z.object({
  // ... existing fields ...

  // NEW: Branching rules
  branching: z.object({
    rules: z.array(BranchRuleSchema),
    defaultNext: z.string().optional(),
  }).optional().nullable(),
})
```

#### Form Flow Changes

In `app/routes/research.$slug.tsx`, modify `handleAnswerSubmit()`:

```typescript
function getNextQuestionIndex(
  currentIndex: number,
  questions: ResearchLinkQuestion[],
  currentAnswer: ResponseValue,
  currentQuestion: ResearchLinkQuestion
): number {
  // Check skip logic rules
  if (currentQuestion.skipLogic?.length) {
    for (const rule of currentQuestion.skipLogic) {
      if (evaluateCondition(rule.condition, rule.value, currentAnswer)) {
        if (rule.action === "end_survey") {
          return questions.length  // Triggers completion
        }
        if (rule.action === "skip_to" && rule.skipToQuestionId) {
          const targetIndex = questions.findIndex(q => q.id === rule.skipToQuestionId)
          if (targetIndex > currentIndex) return targetIndex
        }
      }
    }
  }

  // Default: next question
  return currentIndex + 1
}
```

#### UI: Configure Skip Logic

In survey editor, add per-question skip logic:

```
┌─────────────────────────────────────────────────────────┐
│ Question 2: What type of business are you?              │
│ ○ B2B (business customers)                              │
│ ○ B2C (consumers)                                       │
│ ○ Both                                                  │
│                                                         │
│ ┌─ Skip Logic ──────────────────────────────────────┐   │
│ │ If answer equals "B2C"                            │   │
│ │ → Skip to: "What's your primary sales channel?"   │   │
│ │                                          [+ Add]  │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

Simple dropdown UI—no visual flowchart needed.

---

### Track B: CRM-Powered AI Interviewing (Chat Mode)

#### Current State

The chat agent (`app/mastra/agents/research-link-chat-agent.ts`) currently:
- Receives full question list and progress
- Decides which question to ask next
- Calls tools to save responses
- **Does NOT** have access to person CRM data
- **Does NOT** know research goals/intentions
- Has only 2 tools: `save-research-response`, `mark-survey-complete`

#### Available CRM Data (Not Yet Used)

We have rich tools that could power smarter interviews:

| Tool | Data Available | Use Case |
|------|---------------|----------|
| `fetch-people-details` | Name, title, job function, company, seniority, industry, facets, personas, past interviews | Personalize questions, skip irrelevant topics |
| `semantic-search-people` | Find similar people by traits | "Others in your role said X, do you agree?" |
| `fetch-evidence` | Past quotes/observations | Reference specific pain points they mentioned before |
| `fetch-interview-context` | Full interview history with themes | "Last time you mentioned Y—has that changed?" |
| `fetch-personas` | Assigned persona archetypes | Adjust tone and depth based on user type |

#### New Setting: AI Autonomy Level

Add `ai_autonomy` column to `research_links` table:

```sql
ALTER TABLE research_links
ADD COLUMN ai_autonomy TEXT
DEFAULT 'strict'
CHECK (ai_autonomy IN ('strict', 'moderate', 'adaptive'));
```

| Level | Behavior | Use Case |
|-------|----------|----------|
| `strict` | Follow questions exactly, just conversational | Compliance surveys, structured research |
| `moderate` | Can ask 1 follow-up per topic, respects question order | Standard interviews |
| `adaptive` | Can skip, reorder, probe deeply based on context | Discovery research, user interviews |

#### New Setting: Research Goals

Add research goals/intentions to guide AI improvisation:

```typescript
// In research_links table or survey settings
interface ResearchGoals {
  objectives: string[]           // "Understand pricing sensitivity", "Identify pain points"
  targetSegments: string[]       // "B2B founders", "Enterprise buyers"
  mustAskQuestions: string[]     // Question IDs that can never be skipped
  probeTopics: string[]          // "competitor mentions", "budget constraints"
  avoidTopics: string[]          // "pricing" (too early), "competitor names"
}
```

#### Enhanced Agent Instructions (Adaptive Mode)

```typescript
instructions: async ({ requestContext }) => {
  // Existing context
  const questions = requestContext?.get("questions")
  const answered = requestContext?.get("answered_questions")

  // NEW: Person context (if known)
  const personContext = requestContext?.get("person_context") // From CRM
  const personName = personContext?.name
  const personRole = personContext?.title
  const personCompany = personContext?.company
  const personSegment = personContext?.segment
  const pastInterviews = personContext?.past_interviews
  const personFacets = personContext?.facets

  // NEW: Research goals
  const researchGoals = requestContext?.get("research_goals")
  const objectives = researchGoals?.objectives
  const mustAskQuestions = researchGoals?.mustAskQuestions
  const probeTopics = researchGoals?.probeTopics

  // NEW: Autonomy level
  const autonomyLevel = requestContext?.get("ai_autonomy") ?? "strict"

  return `You are conducting a research interview for ${accountName}.

## RESPONDENT CONTEXT
${personName ? `Name: ${personName}` : ""}
${personRole ? `Role: ${personRole}` : ""}
${personCompany ? `Company: ${personCompany}` : ""}
${personSegment ? `Segment: ${personSegment}` : ""}
${pastInterviews?.length ? `Previous interviews: ${pastInterviews.length} (they're familiar with us)` : "First-time respondent"}

${personFacets?.length ? `
## KNOWN TRAITS (from past conversations)
${personFacets.map(f => `- ${f.label}: ${f.value}`).join("\n")}
` : ""}

## RESEARCH OBJECTIVES
${objectives?.map(o => `• ${o}`).join("\n") || "General discovery"}

## AUTONOMY LEVEL: ${autonomyLevel.toUpperCase()}
${autonomyLevel === "strict" ? `
- Ask questions EXACTLY in order
- Do NOT skip any questions
- Do NOT ask follow-ups beyond the script
- Keep responses brief and move to next question` : ""}
${autonomyLevel === "moderate" ? `
- Follow question order generally
- You may ask ONE brief follow-up if answer is interesting
- Do NOT skip required questions (marked with *)
- Skip questions clearly irrelevant to their segment` : ""}
${autonomyLevel === "adaptive" ? `
- Use your judgment on question order and depth
- Probe deeper when responses touch on research objectives
- Skip questions clearly irrelevant to this respondent
- Reference their past interviews/traits when relevant
- NEVER skip questions marked as required (*)
- Topics to probe: ${probeTopics?.join(", ") || "interesting responses"}` : ""}

## QUESTIONS
${questions.map((q, i) => `${i + 1}. ${mustAskQuestions?.includes(q.id) ? "*" : ""}[${q.id}] ${q.prompt}`).join("\n")}

${autonomyLevel === "adaptive" ? `
## TOOLS AVAILABLE
- Use fetch-people-details to get more context if needed
- Use semantic-search-people to find similar respondents
- Use save-research-response to save answers (ALWAYS include questionId, responseId, slug)
` : ""}
`
}
```

#### Enhancement: Segment-Aware Instructions

Update agent instructions to include segment detection:

```typescript
instructions: async ({ requestContext }) => {
  // ... existing context ...

  return `You are a research assistant conducting an interview.

## SEGMENT DETECTION
As you interview, identify the respondent's segment based on their answers:
- Business type: B2B, B2C, or hybrid
- Role: Founder, Product Manager, Researcher, etc.
- Company stage: Pre-revenue, growth, enterprise
- Use case: Customer research, sales enablement, product validation

When you detect a segment, adjust your questioning:
- Skip questions irrelevant to their segment
- Probe deeper on topics relevant to their context
- Note segment detection in your responses for the system

## QUESTION FLEXIBILITY
You have these questions to cover:
${questions.map((q, i) => `${i + 1}. ${q.prompt}`).join("\n")}

You do NOT need to ask them in order. Based on the conversation:
- Skip questions that don't apply (e.g., B2B pricing for a B2C company)
- Ask natural follow-ups when answers are interesting
- Combine related questions if the flow is better
- End early if you've covered the core topics

## FOLLOW-UP PROBING
When a response is:
- Vague → Ask for a specific example
- Surprising → Ask "Tell me more about that"
- Emotional → Acknowledge and explore the feeling
- Technical → Clarify for understanding

Limit to 1-2 follow-ups per topic to avoid interview fatigue.
`
}
```

#### New Tool: Segment Detection

Add a tool for explicit segment tracking:

```typescript
// app/mastra/tools/detect-segment.ts
export const detectSegmentTool = createTool({
  id: "detect-segment",
  description: "Record detected respondent segment for analytics",
  inputSchema: z.object({
    responseId: z.string(),
    segmentType: z.enum(["business_type", "role", "company_stage", "use_case"]),
    segmentValue: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    sourceQuestionId: z.string().optional(),
  }),
  execute: async (input) => {
    // Store in research_link_responses.metadata or dedicated column
    await saveSegmentDetection(input)
    return { success: true }
  }
})
```

---

## UI/UX Considerations

### Survey Builder

**For Skip Logic (Form Mode):**
- Inline configuration per question (not a separate "logic" tab)
- Dropdown: "If answer equals [value] → Skip to [question]"
- Visual indicator on questions that have logic attached
- Validation: Warn about unreachable questions

**For AI Mode:**
- No additional configuration needed
- Toggle: "Allow AI to adapt question order" (default: on)
- Post-survey: Show which questions were skipped/added by AI

### Respondent Experience

**Form Mode:**
- Questions appear/disappear seamlessly
- Progress bar adjusts dynamically
- No indication that questions were skipped

**Chat Mode:**
- Natural conversation flow
- AI acknowledges context: "Since you mentioned you're B2C..."
- Feels personalized, not robotic

---

## Questions for Richard

1. **Segment taxonomy**: What are the key segments you want to route on?
   - Business type (B2B/B2C/hybrid)?
   - Role (founder/PM/researcher/sales)?
   - Industry verticals?
   - Something else?

2. **Skip logic complexity**: Is "If X, skip to Y" sufficient, or do you need:
   - Multiple conditions (If X AND Y, then...)?
   - Score-based routing (If NPS < 7, ask why)?

3. **Chat mode priority**: Should AI dynamic questioning be:
   - Fully autonomous (AI decides what to skip)?
   - Guided (AI suggests, but follows question order)?
   - Hybrid (required questions + AI flexibility)?

4. **Analytics needs**: Do you need to track:
   - Which branches were taken?
   - AI-generated follow-ups?
   - Detected segments per response?

5. **Migration**: Existing surveys—should they:
   - Keep linear behavior (no changes)?
   - Get a migration to add optional skip logic?

---

## Implementation Phases

### Phase 1: Skip Logic MVP ✅ COMPLETE

**Delivered:**
- `branching.ts` - Core evaluation engine with AND/OR conditions
- `ResearchLinkQuestionSchema` - Added `branching` field
- `research.$slug.tsx` - Integrated branching in form flow
- `QuestionBranchingEditor.tsx` - UI for configuring skip rules

**Commits:**
- `6d6af4b7` feat: implement survey branching engine v1
- `5b2a6c07` feat: add skip logic UI to survey question editor

### Phase 2: AI Autonomy Setting

**Scope:**
- Add `ai_autonomy` column to `research_links` table
- Add UI in survey builder to select autonomy level (strict/moderate/adaptive)
- Update chat agent instructions based on autonomy level
- Gate "adaptive" mode to premium accounts

**Files to modify:**
- `supabase/schemas/research_links.sql` - Add column
- `app/features/research-links/pages/edit.$listId.tsx` - Autonomy selector UI
- `app/mastra/agents/research-link-chat-agent.ts` - Autonomy-aware instructions
- `app/routes/api.research-links.$slug.chat.tsx` - Pass autonomy to agent

### Phase 3: CRM Context Integration

**Scope:**
- Pass person context to chat agent (when person_id known)
- Add research goals/objectives field to research_links
- Enable `fetch-people-details` tool in adaptive mode
- Reference past interviews when available

**Files to modify:**
- `app/routes/api.research-links.$slug.chat.tsx` - Fetch and pass person context
- `app/mastra/agents/research-link-chat-agent.ts` - Person-aware instructions
- `supabase/schemas/research_links.sql` - Add `research_goals` JSONB column
- `app/features/research-links/pages/edit.$listId.tsx` - Goals editor UI

### Phase 4: Advanced AI Tools (Gated)

**Scope:**
- Enable semantic search tools in adaptive mode
- "Others in your role said X" patterns
- Segment detection and tracking
- Branch path analytics

**Files to modify:**
- `app/mastra/agents/research-link-chat-agent.ts` - Add more tools
- `app/mastra/tools/detect-segment.ts` - New tool
- Analytics dashboard for branch paths

---

## Success Metrics

1. **Adoption**: % of surveys using skip logic within 30 days
2. **Completion rates**: Compare branched vs. linear surveys
3. **Respondent satisfaction**: Survey length perception
4. **AI accuracy**: Segment detection precision (manual review)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Complex logic confuses users | Medium | High | Keep UI simple; AI handles complexity |
| AI skips important questions | Medium | Medium | Required question flags; review transcripts |
| Form/chat logic divergence | Low | Medium | Shared evaluation function |
| Breaking existing surveys | Low | High | Additive schema changes only |

---

## Appendix: Competitor Deep Dive

### Typeform Logic Map
- Visual flowchart showing all question connections
- Click to edit logic inline
- Took significant engineering investment
- **Recommendation**: Skip for now; not worth complexity

### SurveyMonkey Advanced Branching
- Conditions: answer values, contact data, hidden variables
- Actions: skip, end survey, set data
- AND/OR operators for complex logic
- **Recommendation**: Too complex; our users want simplicity

### Typeform Clarify (AI)
- Generates 1-2 follow-up questions for open-ended responses
- Uses Claude, private instance
- No pre-configuration needed
- **Recommendation**: This is our direction—AI-driven, not rule-driven

---

## References

- [Typeform Logic Jumps API](https://www.typeform.com/developers/create/logic-jumps/)
- [SurveyMonkey Advanced Branching](https://help.surveymonkey.com/en/surveymonkey/create/advanced-branching/)
- [Typeform AI Features](https://www.typeform.com/ai)
- Current codebase: `app/routes/research.$slug.tsx`, `app/mastra/agents/research-link-chat-agent.ts`
