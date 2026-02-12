# Personal Touch AI - Personalized Survey Feature Specification

**Feature Name:** Personal Touch AI - Context-Aware Personalized Surveys
**Status:** In Planning
**Date:** February 11, 2026
**Team:** BMad Party Mode (Sally, Winston, Mary, John, Barry)
**Priority:** P1 (PLG hook + differentiation moat)

---

## Executive Summary

"Personal Touch AI" transforms generic survey distribution into intelligent, personalized research conversations. Instead of "send this generic survey to everyone," users get "Ask Sarah these 5 questions because she's a high-value VP Engineering who mentioned pricing concerns last month, and we need more evidence on enterprise pricing pain."

### The Differentiation Moat

**Competitors:**
- Typeform: Generic templates
- SurveyMonkey: Basic logic branching
- Qualtrics: Complex manual setup

**UpSight (Personal Touch AI):**
- AI + Evidence + Person Intelligence = Adaptive Research on Autopilot
- 2-3x better response rates (personalization)
- 10x faster (auto-generate vs manual)
- Higher signal quality (evidence-driven questions)
- Compounding intelligence loop

### Strategic Alignment with Platform Vision

**Platform Vision:** "The same customer knowledge that powers strategic decisions should power daily operations."

**This Feature Delivers:**
- **CAPTURE:** Surveys generate evidence (not siloed survey data)
- **SYNTHESIZE:** AI extracts what matters (auto-theme linking)
- **ACT:** Intelligence powers daily work (recommended surveys per person)
- **COMMUNICATE:** Survey insights feed artifacts (reports, presentations)

---

## Complete User Journey - "The Magic Moment"

### 1. Discovery
**Where:** Person detail page
**What:** Yellow banner appears

```
┌────────────────────────────────────────────────────────────────┐
│ 💡 Recommended Survey                                          │
│                                                                 │
│ Sarah should answer our Enterprise Pricing validation survey   │
│ (5 questions, 3 min)                                           │
│                                                                 │
│ [Preview Questions]  [Send to Sarah]                           │
└────────────────────────────────────────────────────────────────┘
```

### 2. Preview Questions
**Action:** User clicks "Preview Questions"
**What:** Modal shows 5 AI-generated personalized questions with rationale

```
┌────────────────────────────────────────────────────────────────┐
│ Personalized Survey for Sarah Chen                      [✕]   │
│                                                                 │
│ ✨ This survey uses Sarah's profile (role, company size,      │
│    past conversations) to personalize questions                │
│                                                                 │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Q1: As a VP Engineering at a Series B company, what's your││
│ │     biggest challenge with research tools?                 ││
│ │                                                             ││
│ │ ℹ️ Rationale: High ICP match + role-specific pain         ││
│ │            discovery                                        ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Q2: You mentioned "budget concerns" in our last call.      ││
│ │     How does pricing factor into your research tool        ││
│ │     evaluation?                                             ││
│ │                                                             ││
│ │ ℹ️ Rationale: References past conversation evidence       ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
│ [+ Add Question]  [Regenerate]  [Edit Questions]               │
│                                                                 │
│ [Cancel]  [Send Survey]                                        │
└────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Personalization highlights:** Shows what data is being used
- **Rationale tooltips:** Explains why each question was generated
- **Edit capability:** User can adjust questions before sending
- **Regenerate button:** Try different questions
- **Add question:** Manual question addition

### 3. Send
**Action:** User clicks "Send Survey"
**What happens:**
- Unique personalized link generated
- Email sent via Gmail integration
- Survey appears on person timeline

```
Person Timeline:
┌────────────────────────────────────────────────────────────────┐
│ 📋 Enterprise Pricing Survey                     Sent 2h ago   │
│    Status: Opened 30min ago • Not completed                    │
│    [Resend] [View Questions]                                   │
└────────────────────────────────────────────────────────────────┘
```

### 4. Track
**Where:** Person detail page timeline
**Status flow:** sent → opened → completed

### 5. Auto-Extract Evidence
**When:** Survey completed
**What:** Banner updates

```
┌────────────────────────────────────────────────────────────────┐
│ ✅ Survey completed!                                           │
│                                                                 │
│ 3 new evidence pieces extracted and linked to 'Pricing Pain'   │
│ theme                                                           │
│                                                                 │
│ [View Evidence]                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Evidence View:** Sarah's responses appear as evidence cards
- Source: "Pricing Survey (Feb 10, 2026)"
- Automatically linked to relevant themes
- Confidence scores calculated
- Person attribution maintained

---

## UX Components

### 1. PersonSurveyRecommendation (Banner Component)
**File:** `app/features/people/components/PersonSurveyRecommendation.tsx`

**Props:**
```typescript
interface PersonSurveyRecommendationProps {
  personId: string
  recommendation: {
    surveyTitle: string
    questionCount: number
    estimatedMinutes: number
    goal: 'validate' | 'discover' | 'deep_dive' | 'pricing'
    focusTheme?: string
    reasoning: string
  }
  status?: 'recommended' | 'sent' | 'opened' | 'completed'
}
```

**Visual:**
- Yellow/blue gradient background
- Icon: sparkles + clipboard
- CTA: "Preview" + "Send Survey"
- Status states with color coding

### 2. PersonalizedQuestionPreview (Modal Component)
**File:** `app/features/research-links/components/PersonalizedQuestionPreview.tsx`

**Features:**
- Question list with rationale tooltips
- Personalization highlights (e.g., "Uses: Role, Company Size, Past Answers")
- Edit capability (adjust questions before sending)
- Regenerate questions button
- Send button with confirmation

### 3. SurveyTimelineEvent (Person Timeline Item)
**File:** `app/features/people/components/SurveyTimelineEvent.tsx`

**Features:**
- Status badge (sent/opened/completed)
- Evidence extraction summary
- Link to survey responses
- Re-send option if incomplete

---

## Technical Architecture

### BAML Question Generation

**File:** `baml_src/personalized_survey.baml`

```typescript
class PersonContext {
  name string
  title string?
  company string?
  role string?
  seniority_level string?
  icp_band string? // "Strong", "Moderate", "Weak"
  icp_score float?
  facets PersonFacets
  missing_fields string[] // Fields we don't have data for
  conversation_themes string[] // Key themes from past interviews
  last_interaction_date string?
}

class PersonFacets {
  pains string[]
  goals string[]
  workflows string[]
  tools string[]
}

class ProjectContext {
  research_goals string[]
  themes_needing_validation ThemeValidation[]
  decision_questions string[]
}

class ThemeValidation {
  theme_name string
  evidence_count int
  target_count int
  confidence string // "low", "medium", "high"
}

class SurveyGoal {
  goal "validate" | "discover" | "deep_dive" | "pricing"
  focus_theme string?
  target_segment string?
}

class PersonalizedQuestion {
  text string
  rationale string // Why this question for this person
  uses_attributes string[] // Which person attributes influenced this
  evidence_type string // "pain", "goal", "workflow", etc.
  order int
}

function GeneratePersonalizedQuestions(
  person_context: PersonContext,
  project_context: ProjectContext,
  survey_goal: SurveyGoal,
  question_count: int
) -> PersonalizedQuestion[] {
  client GPT4
  prompt #"
    You are a research expert generating personalized survey questions.

    PERSON CONTEXT:
    - Name: {{person_context.name}}
    - Title: {{person_context.title}} at {{person_context.company}}
    - Role/Seniority: {{person_context.role}}, {{person_context.seniority_level}}
    - ICP Match: {{person_context.icp_band}} (Score: {{person_context.icp_score}})

    Known Attributes:
    - Pains: {{person_context.facets.pains}}
    - Goals: {{person_context.facets.goals}}
    - Workflows: {{person_context.facets.workflows}}
    - Tools: {{person_context.facets.tools}}

    Missing Data: {{person_context.missing_fields}}
    Past Themes: {{person_context.conversation_themes}}
    Last Contact: {{person_context.last_interaction_date}}

    PROJECT CONTEXT:
    Research Goals: {{project_context.research_goals}}

    Themes Needing Validation:
    {% for theme in project_context.themes_needing_validation %}
    - {{theme.theme_name}}: {{theme.evidence_count}}/{{theme.target_count}} evidence ({{theme.confidence}} confidence)
    {% endfor %}

    SURVEY GOAL: {{survey_goal.goal}}
    {% if survey_goal.focus_theme %}Focus Theme: {{survey_goal.focus_theme}}{% endif %}
    {% if survey_goal.target_segment %}Target Segment: {{survey_goal.target_segment}}{% endif %}

    TASK:
    Generate {{question_count}} personalized survey questions that:

    1. LEVERAGE WHAT WE KNOW:
       - Reference their specific role/context naturally
       - Build on past conversations (if any)
       - Address their known pains/goals

    2. FILL KNOWLEDGE GAPS:
       - Ask about missing fields when relevant
       - Validate low-evidence themes
       - Support research goals

    3. FEEL PERSONAL, NOT CREEPY:
       - Use conversational tone
       - Reference attributes naturally (not "Based on your profile...")
       - Ask open-ended questions

    4. STRATEGIC VALUE:
       - Each question should generate evidence for themes
       - Prioritize high-ICP person insights
       - Support decision-making

    Return {{question_count}} questions with:
    - Question text (conversational, personalized)
    - Rationale (why this question for this person)
    - Uses attributes (which data informed this)
    - Evidence type (pain/goal/workflow/tool/context)
    - Order (priority ranking)

    Example good question:
    "As a VP Engineering at a Series B company, what's your biggest challenge with research tools?"
    Rationale: High ICP match + role-specific pain discovery
    Uses: [title, company_stage, role]
    Evidence type: pain
  "#
}
```

### Mastra Tool: Create Personalized Survey

**File:** `app/mastra/tools/create-personalized-survey.ts`

```typescript
export const createPersonalizedSurveyTool = createTool({
  id: "createPersonalizedSurvey",
  description: `Generate and create a personalized survey for a specific person based on their context, project research goals, and evidence gaps.`,

  inputSchema: z.object({
    personId: z.string().uuid(),
    surveyGoal: z.enum(['validate', 'discover', 'deep_dive', 'pricing']),
    focusTheme: z.string().optional(),
    questionCount: z.number().min(3).max(10).default(5),
    autoSend: z.boolean().default(false),
  }),

  execute: async (input, context) => {
    const { supabase, accountId, projectId } = await getContext(context)

    // 1. Fetch person context
    const personContext = await fetchPersonContext(supabase, input.personId)

    // 2. Fetch project context
    const projectContext = await fetchProjectContext(supabase, projectId)

    // 3. Generate personalized questions via BAML
    const questions = await GeneratePersonalizedQuestions({
      person_context: personContext,
      project_context: projectContext,
      survey_goal: {
        goal: input.surveyGoal,
        focus_theme: input.focusTheme,
      },
      question_count: input.questionCount,
    })

    // 4. Create research link (survey)
    const { data: survey } = await supabase
      .from('research_links')
      .insert({
        account_id: accountId,
        project_id: projectId,
        name: `Personalized Survey for ${personContext.name}`,
        questions: questions.map(q => ({
          text: q.text,
          type: 'open_ended',
          metadata: {
            rationale: q.rationale,
            uses_attributes: q.uses_attributes,
            evidence_type: q.evidence_type,
          }
        })),
        is_live: true,
        personalized_for: input.personId,
        survey_goal: input.surveyGoal,
      })
      .select()
      .single()

    // 5. Optionally send
    if (input.autoSend) {
      // TODO: Integrate with Gmail sending
    }

    return {
      success: true,
      surveyId: survey.id,
      questionCount: questions.length,
      questions,
    }
  }
})
```

### Helper Functions

**File:** `app/features/research-links/utils/personalization.server.ts`

```typescript
export async function fetchPersonContext(
  supabase: SupabaseClient,
  personId: string
): Promise<PersonContext> {
  // Fetch person with facets, ICP score, themes
  const person = await supabase
    .from('people')
    .select(`
      *,
      person_facet(*),
      person_scale!inner(score, confidence),
      evidence!person_attribution(themes(*))
    `)
    .eq('id', personId)
    .single()

  // Build context object
  return {
    name: `${person.firstname} ${person.lastname}`,
    title: person.title,
    company: person.organizations?.[0]?.name,
    role: person.job_function,
    seniority_level: person.seniority_level,
    icp_band: person.person_scale?.icp_match,
    icp_score: person.person_scale?.score,
    facets: extractFacets(person.person_facet),
    missing_fields: identifyMissingFields(person),
    conversation_themes: extractThemes(person.evidence),
    last_interaction_date: person.last_interview_date,
  }
}

export async function fetchProjectContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectContext> {
  // Fetch research goals and themes needing validation
  const [projectSections, themes] = await Promise.all([
    supabase
      .from('project_sections')
      .select('kind, content_md')
      .eq('project_id', projectId)
      .in('kind', ['goal', 'research_unknowns']),

    supabase
      .from('themes')
      .select('name, evidence_count')
      .eq('project_id', projectId)
      .order('evidence_count', { ascending: true })
      .limit(10),
  ])

  return {
    research_goals: extractGoals(projectSections),
    themes_needing_validation: themes.map(t => ({
      theme_name: t.name,
      evidence_count: t.evidence_count,
      target_count: 5, // Configurable threshold
      confidence: t.evidence_count < 3 ? 'low' : t.evidence_count < 5 ? 'medium' : 'high',
    })),
    decision_questions: [], // TODO: Fetch from decision_questions table
  }
}
```

---

## Survey-to-Evidence Pipeline

### Post-Survey Completion Processing

**File:** `src/trigger/research-links/processSurveyCompletion.ts`

```typescript
export const processSurveyCompletionTask = task({
  id: 'process-survey-completion',
  run: async ({ responseId }) => {
    // 1. Fetch survey response
    const response = await supabase
      .from('research_link_responses')
      .select(`
        *,
        research_links(questions, personalized_for)
      `)
      .eq('id', responseId)
      .single()

    // 2. Extract evidence from each answer
    const evidencePieces = []

    for (const [idx, answer] of response.responses.entries()) {
      const question = response.research_links.questions[idx]

      // Use BAML to extract structured evidence
      const extracted = await ExtractEvidenceFromAnswer({
        question_text: question.text,
        answer_text: answer,
        person_id: response.person_id,
        question_metadata: question.metadata,
      })

      // Create evidence record
      const evidence = await supabase
        .from('evidence')
        .insert({
          gist: extracted.gist,
          verbatim: answer,
          category: extracted.category,
          confidence: extracted.confidence,
          source_type: 'survey',
          source_id: responseId,
          project_id: response.project_id,
          account_id: response.account_id,
        })
        .select()
        .single()

      // Link to person
      await supabase
        .from('person_attribution')
        .insert({
          evidence_id: evidence.id,
          person_id: response.person_id,
        })

      // Link to themes
      if (extracted.theme_matches?.length > 0) {
        await linkEvidenceToThemes(evidence.id, extracted.theme_matches)
      }

      evidencePieces.push(evidence)
    }

    // 3. Update survey response with extraction status
    await supabase
      .from('research_link_responses')
      .update({
        evidence_extracted: true,
        evidence_count: evidencePieces.length,
      })
      .eq('id', responseId)

    return {
      evidenceCount: evidencePieces.length,
      themesUpdated: [...new Set(evidencePieces.flatMap(e => e.themes))],
    }
  }
})
```

---

## Database Schema Changes

```sql
-- Add personalization fields to research_links
ALTER TABLE research_links
  ADD COLUMN personalized_for UUID REFERENCES people(id),
  ADD COLUMN survey_goal TEXT CHECK (survey_goal IN ('validate', 'discover', 'deep_dive', 'pricing')),
  ADD COLUMN focus_theme TEXT;

-- Track survey recommendations
CREATE TABLE survey_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  person_id UUID NOT NULL REFERENCES people(id),

  survey_goal TEXT NOT NULL,
  focus_theme TEXT,
  reasoning TEXT NOT NULL,
  question_count INT DEFAULT 5,

  status TEXT DEFAULT 'recommended' CHECK (status IN ('recommended', 'dismissed', 'sent', 'completed')),

  -- Link to created survey if sent
  research_link_id UUID REFERENCES research_links(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Track evidence extraction from surveys
ALTER TABLE research_link_responses
  ADD COLUMN evidence_extracted BOOLEAN DEFAULT FALSE,
  ADD COLUMN evidence_count INT DEFAULT 0;
```

---

## Implementation Estimate

**Total:** ~750 lines of code for MVP

### Week 1 Breakdown

**Day 1-2: BAML Question Generation**
- `baml_src/personalized_survey.baml` - 150 lines
- Test with sample person contexts
- Validate output quality

**Day 3-4: Mastra Tool + Survey Creation**
- `app/mastra/tools/create-personalized-survey.ts` - 100 lines
- `app/features/research-links/utils/personalization.server.ts` - 150 lines
- Database migrations - 50 lines

**Day 5: UX Components**
- `PersonSurveyRecommendation.tsx` - 120 lines
- `PersonalizedQuestionPreview.tsx` - 150 lines
- `SurveyTimelineEvent.tsx` - 80 lines

### Week 2: Evidence Pipeline + Polish

**Day 6-7: Survey-to-Evidence Processing**
- `src/trigger/research-links/processSurveyCompletion.ts` - 100 lines
- BAML evidence extraction
- Theme linking logic

**Day 8-10: Integration + Testing**
- Integrate components into person detail page
- End-to-end testing
- Polish and edge case handling

---

## Technical Risks & Mitigations

### Risk 1: AI-Generated Question Quality (MEDIUM)
**Risk:** AI generates weird/inappropriate questions
**Mitigation:**
- Preview with edit capability (users can fix)
- Regenerate button (try different questions)
- Manual question override
- Quality validation in BAML prompt
- Initial review by team before launch

### Risk 2: Survey-to-Evidence Pipeline Quality (MEDIUM)
**Risk:** Evidence extraction from survey answers is low quality
**Mitigation:**
- Start with manual review/approval of extracted evidence
- Confidence scores on all evidence
- User can edit/reject extracted evidence
- Improve extraction prompts iteratively

### Risk 3: Cross-Survey Memory Complexity (HIGH)
**Risk:** Managing state across multiple surveys per person is complex
**Mitigation:**
- Phase 1: Treat each survey independently
- Phase 2: Add cross-survey memory
- Store all past responses, but don't over-reference in Phase 1

### Risk 4: Personalization Creep (LOW)
**Risk:** Users feel it's "too personal" or creepy
**Mitigation:**
- Transparency label showing what data is used
- Preview before sending (users see personalization)
- Opt-out per person
- Clear privacy policy

### Risk 5: Rate Limits on AI Generation (LOW)
**Risk:** BAML calls could get expensive with large contact lists
**Mitigation:**
- Generate questions on-demand (not batch)
- Cache generated questions per person+goal
- Consider template-based fallback for high volume

---

## Success Metrics

### Phase 1 (MVP - Weeks 1-2)
- ✅ Users can generate personalized survey for a person
- ✅ 5 questions created using person context
- ✅ Preview shows rationale for each question
- ✅ Survey responses auto-extract as evidence
- ✅ Evidence links to themes automatically

### Business Metrics (Post-Launch)
- **Response Rate:** Target 2x improvement vs generic surveys
- **Evidence Quality:** 80%+ of extracted evidence rated "useful" by users
- **Adoption:** 50%+ of active users try personalized surveys in first month
- **Retention:** Users who send personalized surveys have 2x higher retention

---

## Open Questions for Roundup Discussion

1. **Pricing Strategy:** Is this core platform or paid add-on?
2. **Send Mechanism:** Email vs in-app vs both?
3. **Recommendation Trigger:** When/how do we suggest surveys?
4. **Edit vs Trust:** Should users always review before sending, or "auto-send with approval rules"?
5. **Evidence Review:** Manual approval needed or auto-accept with confidence scores?

---

## Product Narrative (For Demo)

> "Most tools make you choose: broad generic surveys or manual personalization. UpSight does both. Our AI knows Sarah is a high-value VP Engineering who mentioned pricing concerns. So instead of sending her the same 20 questions as everyone else, we ask her 5 targeted questions about enterprise pricing - and her answers automatically become evidence that powers your product roadmap."

---

## Next Steps (After Dinner Review)

1. **Team Roundup:** PM + Scrum Master facilitate
2. **Gap Analysis:** Check for missing requirements
3. **Risk De-risking:** Validate architecture decisions
4. **Story Creation:** Break into implementable stories (beads)
5. **Implementation:** Start with PersonSurveyRecommendation component
