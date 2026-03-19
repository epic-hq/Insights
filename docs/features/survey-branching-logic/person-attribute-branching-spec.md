# Feature Spec: Person-Attribute-Aware Survey Branching

**Bead**: `Insights-nwzd`
**Status**: Draft
**Goal**: Let branching rules reference person/CRM data and in-session normalized answers, so respondents only see relevant questions.

---

## Context

Today the branching engine (`branching.ts`) only evaluates conditions against `ResponseRecord` (question ID -> answer). Person data is fetched in chat mode but only used by the AI agent for conversation -- deterministic branching ignores it. The start endpoint resolves `person_id` but returns no attributes. Post-answer person profile sync runs only at survey completion, too late for mid-survey branching.

This means: you can't skip "What's your role?" for someone whose role is already in the CRM, and you can't branch on seniority unless you ask a question about it first.

---

## System Flow

```mermaid
flowchart TD
    subgraph START["Survey Start"]
        S1[Respondent opens survey]
        S2[Start endpoint resolves person_id]
        S3{person_id found?}
        S4[Fetch person attributes from DB]
        S5[Return personAttributes in start response]
        S6[Return empty personAttributes]
        S1 --> S2 --> S3
        S3 -->|Yes| S4 --> S5
        S3 -->|No| S6
    end

    subgraph RUNTIME["Survey Runtime — Form + Chat"]
        R1[Build BranchingContext]
        R2[Merge: stored person attrs + in-session normalized answers + question responses]
        R3[evaluateCondition checks sourceType]
        R4{sourceType?}
        R5["Lookup context.responses[questionId]"]
        R6["Lookup context.personAttributes[attributeKey]"]
        R7[Apply operator + value comparison]
        R8[getNextQuestionId returns target]
        R1 --> R2 --> R3 --> R4
        R4 -->|question| R5 --> R7
        R4 -->|person_attribute| R6 --> R7
        R7 --> R8
    end

    subgraph NORMSYNC["In-Session Normalization"]
        N1[Respondent answers question with personFieldKey]
        N2[extractCanonicalSurveyAttributes normalizes value]
        N3[Mirror normalized value into personAttributes map]
        N4[Next branching evaluation sees the new attribute]
        N1 --> N2 --> N3 --> N4
    end

    subgraph EDITOR["Survey Editor"]
        E1[Condition source dropdown]
        E2{Source type?}
        E3[Show question list]
        E4[Show person attribute list]
        E5[Operator + value input]
        E6[Persist condition with sourceType + attributeKey]
        E1 --> E2
        E2 -->|Question| E3 --> E5
        E2 -->|Person Attribute| E4 --> E5
        E5 --> E6
    end

    S5 --> R1
    S6 --> R1
    R8 --> N1
```

---

## Data Flow: Form Mode vs Chat Mode

```mermaid
sequenceDiagram
    participant R as Respondent
    participant FE as Frontend (Form Mode)
    participant SE as Start Endpoint
    participant CE as Chat Endpoint
    participant DB as Supabase

    Note over R,DB: Form Mode Flow
    R->>SE: POST /start (email/phone)
    SE->>DB: Resolve person_id
    SE->>DB: Fetch person attributes
    SE-->>FE: { responseId, personId, personAttributes }
    FE->>FE: buildBranchingContext(responses, questions, personAttributes)
    FE->>FE: getNextQuestionIndex(idx, questions, context)

    Note over R,DB: Chat Mode Flow
    R->>CE: POST /chat (messages, responseId)
    CE->>DB: Fetch person from response.person_id
    CE->>CE: Convert personContext → PersonAttributeRecord
    CE->>CE: computeReachablePath(questions, context)
    CE-->>R: Streamed agent response
```

---

## Interface Contracts

### 1. Extended Condition Schema (`branching.ts`)

```typescript
/** Source of the condition value */
export const ConditionSourceTypeSchema = z.enum(["question", "person_attribute"]);
export type ConditionSourceType = z.infer<typeof ConditionSourceTypeSchema>;

/** Single condition to evaluate */
export const ConditionSchema = z.object({
  sourceType: ConditionSourceTypeSchema.default("question"),
  questionId: z.string().min(1),           // Used when sourceType = "question"
  attributeKey: z.string().optional(),      // Used when sourceType = "person_attribute"
  operator: ConditionOperatorSchema,
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;
```

**Backwards-compatible**: `.default("question")` means existing persisted JSON without `sourceType` parses as `"question"`. `attributeKey` is optional and ignored for question conditions.

### 2. Branching Context (`branching-context.ts` — new file)

```typescript
import type { ResponseValue, ResponseRecord } from "./branching";
import type { ResearchLinkQuestion } from "./schemas";

/** Person attributes flattened for branching lookup */
export type PersonAttributeRecord = Record<string, ResponseValue>;

/** Unified context for branching evaluation */
export interface BranchingContext {
  responses: ResponseRecord;
  personAttributes: PersonAttributeRecord;
}

/** Well-known person attribute keys available for branching conditions */
export const PERSON_ATTRIBUTE_KEYS = [
  { key: "title",           label: "Job Title",       example: "VP of Engineering" },
  { key: "job_function",    label: "Job Function",     example: "Engineering" },
  { key: "seniority_level", label: "Seniority Level",  example: "Leadership" },
  { key: "role",            label: "Role Type",        example: "IC" },
  { key: "segment",         label: "Segment",          example: "Enterprise" },
  { key: "icp_band",        label: "ICP Band",         example: "Strong" },
  { key: "company",         label: "Company",          example: "Acme Inc" },
  { key: "persona",         label: "Persona",          example: "Decision Maker" },
  { key: "industry",        label: "Industry",         example: "SaaS" },
] as const;

export type PersonAttributeKey = (typeof PERSON_ATTRIBUTE_KEYS)[number]["key"];

/**
 * Build a BranchingContext merging:
 * 1. Stored person attributes (from CRM/DB)
 * 2. In-session normalized answers (questions with personFieldKey)
 * 3. Raw question responses
 */
export function buildBranchingContext(
  responses: ResponseRecord,
  questions: ResearchLinkQuestion[],
  personAttributes?: PersonAttributeRecord
): BranchingContext;

/** Create a minimal context from just responses (backwards-compat helper) */
export function responsesOnlyContext(responses: ResponseRecord): BranchingContext;
```

### 3. Start Endpoint Response Extension (`api.research-links.$slug.start.tsx`)

```typescript
// Added to all start response payloads
type StartSignupResult = {
  responseId: string;
  responses: ResponseRecord;
  completed: boolean;
  personId: string | null;
  personAttributes: Record<string, string | null>;  // NEW
};
```

### 4. Updated Engine Signatures (`branching.ts`)

```typescript
// Before (current)
evaluateCondition(condition: Condition, responses: ResponseRecord): boolean
evaluateConditionGroup(group: ConditionGroup, responses: ResponseRecord): boolean
evaluateBranchRules(branching, responses: ResponseRecord): BranchResult | null
getNextQuestionId(currentQuestion, questions, responses: ResponseRecord): string | null
getNextQuestionIndex(currentIndex, questions, responses: ResponseRecord): number

// After (new)
evaluateCondition(condition: Condition, context: BranchingContext): boolean
evaluateConditionGroup(group: ConditionGroup, context: BranchingContext): boolean
evaluateBranchRules(branching, context: BranchingContext): BranchResult | null
getNextQuestionId(currentQuestion, questions, context: BranchingContext): string | null
getNextQuestionIndex(currentIndex, questions, context: BranchingContext): number
```

### 5. NL Parser Extension (`parse-branch-rule.tsx`)

```typescript
// Extended ParsedRuleSchema output
const ParsedRuleSchema = z.object({
  sourceType: z.enum(["question", "person_attribute"]).default("question"),  // NEW
  attributeKey: z.string().optional(),  // NEW — e.g. "seniority_level"
  triggerValue: z.string(),
  operator: ConditionOperatorSchema,
  // ... rest unchanged
});
```

---

## Implementation Phases

### Phase 1: Engine + Types (Pure Logic, No UI)

**Files to modify:**
- `app/features/research-links/branching.ts` — extend ConditionSchema, update eval functions to accept BranchingContext
- `app/features/research-links/branching-context.ts` — **NEW** — `BranchingContext`, `buildBranchingContext()`, `responsesOnlyContext()`, `PERSON_ATTRIBUTE_KEYS`

**Files to update (callers):**
- `app/routes/research.$slug.tsx:1278` — `getNextQuestionIndex` call, wrap responses in context
- `app/routes/api.research-links.$slug.chat.tsx:53,317` — `getNextQuestionId` and `computeReachablePath`, build context from personContext
- `app/features/research-links/survey-flow.ts:84` — `getNextQuestionId` in `simulatePath`, use `responsesOnlyContext()`

**Key logic in `buildBranchingContext`:**
1. Start with `personAttributes` from DB (or `{}` if anonymous)
2. Walk `questions`, for each with a `personFieldKey` that has a response value, mirror it into `personAttributes` (in-session normalization)
3. Return `{ responses, personAttributes: merged }`

**Key logic in `evaluateCondition`:**
```typescript
const answer = condition.sourceType === "person_attribute"
  ? context.personAttributes[condition.attributeKey ?? ""]
  : context.responses[condition.questionId];
// ... existing operator logic unchanged
```

**Tests** (new file `branching-context.test.ts`):
- Person attribute condition evaluates against `personAttributes`
- Question condition evaluates against `responses` (unchanged behavior)
- Mixed AND group: one person attr + one question condition
- In-session normalization: question with `personFieldKey: "title"` and answer `"VP"` makes `personAttributes.title === "VP"`
- Missing person attributes fail gracefully (treated as not answered)
- Backwards compat: condition without `sourceType` field defaults to `"question"`

### Phase 2: Data Delivery

**Files to modify:**
- `app/routes/api.research-links.$slug.start.tsx` — all 4 handlers add `personAttributes` fetch when `personId` is resolved
- `app/routes/research.$slug.tsx` — `StartSignupResult` type, store `personAttributes` in state, pass to `buildBranchingContext`
- `app/routes/api.research-links.$slug.chat.tsx` — convert existing `personContext` to `PersonAttributeRecord` and pass to `buildBranchingContext`

**Shared helper:**
```typescript
async function fetchPersonAttributesForBranching(
  supabase: AdminClient,
  personId: string
): Promise<Record<string, string | null>> {
  const { data: person } = await supabase
    .from("people")
    .select("title, job_function, seniority_level, role, segment")
    .eq("id", personId)
    .maybeSingle();

  if (!person) return {};

  return {
    title: person.title,
    job_function: person.job_function,
    seniority_level: person.seniority_level,
    role: person.role,
    segment: person.segment,
  };
}
```

### Phase 3: Editor UI

**Files to modify:**
- `app/features/research-links/components/QuestionBranchingEditor.tsx` — add person attribute source group to condition source dropdown, handle `sourceType` in rule CRUD
- `app/features/research-links/api/parse-branch-rule.tsx` — extend prompt with person attribute awareness, extend `ParsedRuleSchema` with `sourceType` + `attributeKey`

**Editor changes:**
- Condition source `<Select>` gets two `<SelectGroup>`s: "Person Attributes" (from `PERSON_ATTRIBUTE_KEYS`) and "Questions" (existing)
- When person attribute selected: set `sourceType: "person_attribute"`, `attributeKey`, clear `questionId` to placeholder
- Value input: free text for most attributes, select dropdown for `icp_band` (Strong/Moderate/Weak) and `seniority_level` (Leadership/Senior/Manager/Mid/Entry)
- Rule display: show attribute label instead of "Q3: ..." when `sourceType === "person_attribute"`

**NL parser changes:**
- Add person attribute list to the system prompt
- Map NL references like "if they're a VP" to `sourceType: "person_attribute", attributeKey: "seniority_level", triggerValue: "Leadership"`

### Phase 4: Polish (Deferred/P2)

- Pre-fill question answers from person attributes when `personFieldKey` matches
- Show "We have you as X" confirmation for pre-filled answers
- Badge in question editor showing which person field a question writes to
- Smart question skipping (auto-answer + skip when attribute already known)

---

## Verification Plan

1. **Unit tests**: `pnpm vitest run app/features/research-links/branching-context.test.ts`
2. **Existing tests pass**: `pnpm vitest run app/features/research-links/` — no regressions
3. **Form mode manual test**:
   - Create survey with rule: `seniority_level equals Leadership → skip to Q7`
   - Start as known person with `seniority_level = "Leadership"` in DB
   - Verify branch fires before answering any questions
   - Start as anonymous — verify branch does NOT fire (falls through)
4. **Chat mode manual test**:
   - Same survey in chat mode
   - Verify `computeReachablePath` skips correctly when person has matching attribute
5. **Editor manual test**:
   - Open branching editor, verify "Person Attributes" group appears in condition source
   - Create rule with Seniority Level equals Leadership, verify persists
6. **NL parser test**:
   - "If they're in leadership, skip to strategy section"
   - Verify parsed rule has `sourceType: "person_attribute"`, `attributeKey: "seniority_level"`

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Schema change breaks existing rules | `sourceType` defaults to `"question"`, `attributeKey` is optional — zero migration |
| Anonymous surveys break on person conditions | `personAttributes` is `{}`, conditions fail gracefully (undefined = not answered) |
| Form mode bundle size | `BranchingContext` + `buildBranchingContext` are ~30 lines, trivial |
| Stale person attributes | Fetched at survey start — correct behavior, branch on current data |
| `questionId` meaningless for person conditions | Use sentinel `"__person__"` to satisfy `.min(1)`, or discriminated union |

---

## Design Decision: `questionId` handling

**Recommendation**: Keep `questionId` required with default `"__person__"` sentinel for person attribute conditions. This is simpler than a discriminated union, avoids a complex Zod schema, and the sentinel is only an internal detail — the editor UI and NL parser abstract it away. The `evaluateCondition` function ignores `questionId` when `sourceType === "person_attribute"`.
