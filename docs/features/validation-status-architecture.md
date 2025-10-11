# Validation Status Page - Data Architecture

## Current Issues

The ValidationStatus page is currently using:
1. **Mock data** (`mockParticipants`) instead of real database queries
2. **JSONB contact_info field** to store validation data (not normalized)
3. **No connection** to the actual research analysis tables

## Proper Database Tables

Based on the schema analysis, validation data should come from:

### 1. **`project_question_analysis`** (Primary Source)
- Stores AI-generated analysis per research/decision question
- Fields:
  - `question_type`: 'decision' | 'research'
  - `question_id`: UUID reference to decision_questions or research_questions
  - `summary`: Text summary of findings
  - `confidence`: 0-1 numeric confidence score
  - `next_steps`: Recommended actions
  - `goal_achievement_summary`: How well the goal is being met

### 2. **`project_answers`** (Interview Responses)
- Stores actual interview question/answer pairs
- Links to:
  - `interview_id`: Which interview
  - `respondent_person_id`: Which person answered
  - `research_question_id` or `decision_question_id`: Which question
- Fields:
  - `question_text`: The question asked
  - `answer_text`: The response
  - `confidence`: How confident the answer is
  - `analysis_summary`: AI analysis of the answer
  - `status`: 'planned' | 'asked' | 'answered' | 'skipped'

### 3. **`project_answers_evidence`** (Supporting Evidence)
- Links answers to evidence from interviews
- Provides traceability from answer → evidence → interview

### 4. **`people`** (Participants)
- Basic participant info (name, company, etc.)
- Should NOT store validation outcomes in contact_info JSONB
- Validation outcomes should be derived from their answers

## Correct Data Flow

```
Interview → project_answers (per person) → project_question_analysis (aggregated)
                ↓
         evidence (supporting quotes)
```

## Validation Outcome Derivation

The "outcome" (1-5 scale) should be **computed** from:
- **Outcome 1 (Not Target)**: No answers to key questions, or answers indicate no pain
- **Outcome 2 (Unaware)**: Answers show they're in target market but unaware of pain
- **Outcome 3 (Aware, Inactive)**: Acknowledges pain but no quantification
- **Outcome 4 (Quantified, Inactive)**: Has quantified pain but not acting
- **Outcome 5 (Opportunities)**: Has quantified pain AND is actively solving

This should be derived from:
- `project_answers.analysis_summary` - Does it mention pain awareness?
- `project_answers.confidence` - How confident are we in the answer?
- Presence of quantification keywords in answers
- Evidence of current solutions/spending in answers

## Recommended Implementation

### Step 1: Query Real Data
```typescript
// Get people with their interview answers
const { data: people } = await supabase
  .from("people")
  .select(`
    id,
    name,
    company,
    interview_people (
      interviews (
        id,
        title,
        project_answers!respondent_person_id (
          id,
          question_text,
          answer_text,
          analysis_summary,
          confidence,
          research_question_id,
          decision_question_id
        )
      )
    )
  `)
  .eq("project_id", projectId)
```

### Step 2: Compute Validation Outcomes
```typescript
function computeValidationOutcome(person, answers) {
  // Analyze answers to determine outcome 1-5
  // Look for keywords, pain indicators, quantification, action
}
```

### Step 3: Use project_question_analysis for Summaries
```typescript
// Get AI-generated analysis per question
const { data: questionAnalysis } = await supabase
  .from("project_question_analysis")
  .select("*")
  .eq("project_id", projectId)
  .order("created_at", { ascending: false })
```

## Migration Path

1. ✅ **Phase 1**: Fix crashes by adding null checks
2. ✅ **Phase 2**: Query real `project_answers` data instead of mock sources
3. ✅ **Phase 3**: Implement outcome computation logic tied to validation gates
4. ✅ **Phase 4**: Integrate with `project_question_analysis` for gate-level insights
5. ⏳ **Phase 5**: Retire legacy contact_info fallbacks once backfill is complete

## Next Steps

- Backfill `validation_gate_map` metadata for existing validation-mode projects and re-run `GenerateResearchStructure` so older workspaces participate in the new flow.
- Remove the temporary JSONB overrides (`contact_info.validation_*`) in the loader once the backfill is verified.
- Keep the newly added integration test (`app/test/integration/validation-flow.integration.test.ts`) green to guarantee the whole flow—from evidence analysis through the dashboard—stays wired together.
