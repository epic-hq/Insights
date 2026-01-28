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
- Complex multi-condition logic builders (SurveyMonkey-style)
- Visual drag-and-drop flowchart editors
- Piping/variables beyond basic branching

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

### Track A: Skip Logic for Form Mode

#### Data Model

Extend `ResearchLinkQuestionSchema` in `app/features/research-links/schemas.ts`:

```typescript
export const ResearchLinkQuestionSchema = z.object({
  // ... existing fields ...

  // NEW: Simple branching rules
  skipLogic: z.array(
    z.object({
      // Condition
      condition: z.enum(["equals", "not_equals", "contains", "selected", "not_selected"]),
      value: z.union([z.string(), z.array(z.string())]),

      // Action (one of)
      action: z.enum(["skip_to", "end_survey"]),
      skipToQuestionId: z.string().optional(),  // For skip_to action

      // Optional metadata
      label: z.string().optional(),  // "Skip B2B questions"
    })
  ).optional().nullable(),
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

### Track B: AI Dynamic Questioning (Chat Mode)

#### Current State

The chat agent (`app/mastra/agents/research-link-chat-agent.ts`) already:
- Receives full question list and progress
- Decides which question to ask next
- Calls tools to save responses

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

### Phase 1: Skip Logic MVP (1 week)

**Scope:**
- Add `skipLogic` field to question schema
- Implement `getNextQuestionIndex()` in form mode
- Basic UI: dropdown to configure skip rules
- No visual flow diagram

**Files to modify:**
- `app/features/research-links/schemas.ts` - Add skipLogic field
- `app/routes/research.$slug.tsx` - Branching in handleAnswerSubmit
- `app/features/research-links/pages/edit.$listId.tsx` - UI for skip config

### Phase 2: AI Dynamic Questioning (1 week)

**Scope:**
- Update chat agent instructions for segment awareness
- Add `detect-segment` tool
- Allow AI to skip/reorder questions
- Store segment metadata in responses

**Files to modify:**
- `app/mastra/agents/research-link-chat-agent.ts` - Updated instructions
- `app/mastra/tools/detect-segment.ts` - New tool
- `app/routes/api.research-links.$slug.chat.tsx` - Pass segment context

### Phase 3: Polish & Analytics (1 week)

**Scope:**
- Visual indicators for skip logic in builder
- Branch path tracking in responses
- Segment analytics dashboard
- Question skip validation

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
