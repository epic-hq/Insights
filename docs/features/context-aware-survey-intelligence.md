# Feature Spec: Context-Aware Survey Intelligence

## Overview

Make survey question generation and the Uppy assistant context-aware by leveraging project research data (themes, insights, evidence, goals) to generate strategic, personalized survey questions.

This should evolve into a broader **Smart Surveys** capability:
- not just generating a full draft survey
- but also recommending the **next most impactful questions** to ask a specific person, given:
  - what we already know about them
  - the current business intent
  - what evidence or qualification gaps remain

## Problem Statement

From user feedback:
- "Uppy should know more about questions answered"
- "Leverage insights from existing conversations"
- "Not just generic prompts"
- "Should know where I'm at, stage of company, users in product"
- "Suggest a survey be strategic - new users vs going deeper"
- "Tailor questions to the audience segment"
- Question generation got "stuck on scrapbooking" and couldn't redirect

## Current State

### Question Generation (`generate-questions.tsx`)
- **Input**: Survey name, description, existing questions to avoid
- **Context**: NONE from project
- **Output**: 3-5 generic questions

### Uppy Context
- Has `fetchProjectStatusContextTool` with 9 scopes (themes, insights, evidence, etc.)
- Has `semanticSearchEvidenceTool` for AI-powered search
- Has account context (company_description, customer_problem, offerings)
- **NOT connected to survey creation flow**

### Available Project Data (Unused)
| Source | Fields | Value for Surveys |
|--------|--------|-------------------|
| `themes` | jtbd, pain, desired_outcome, emotional_response, motivation | Validate/explore specific insights |
| `evidence` | pains[], gains[], journey_stage, says, does, thinks, feels | Ground questions in real quotes |
| `project_sections` | goal, target_roles, target_orgs, customer_problem | Tailor to audience |
| `decision_questions` | text, metrics, risks | Align with business decisions |
| `research_questions` | text, evidence_types | Match research methodology |
| `interview_prompts` | text, followups | Avoid duplication, leverage existing |
| `research_link_responses` | responses by question | Know what's been answered |

### Existing Building Blocks We Can Reuse

These are useful foundations, but they do not yet provide a reusable "next best question" service:

| Capability | Current file | What it already does | Gap |
|--------|--------|-------------------|-----|
| Generic survey draft questions | [app/features/research-links/api/generate-questions.tsx](/Users/richardmoy/Code/ai/Insights/app/features/research-links/api/generate-questions.tsx) | Generates 3-5 survey questions from name + description | No person context, no business intent model, no ordering rationale |
| Personalized campaign questions | [app/features/research-links/api/generate-campaign-questions.tsx](/Users/richardmoy/Code/ai/Insights/app/features/research-links/api/generate-campaign-questions.tsx) | Generates draft questions per person for campaign surveys | Only works inside campaign flow, not a reusable UI/agent/MCP capability |
| Person context enrichment | [app/features/research-links/lib/person-context.server.ts](/Users/richardmoy/Code/ai/Insights/app/features/research-links/lib/person-context.server.ts) | Fetches role, company, ICP band, themes, and facet-derived context | Not exposed as a survey decisioning or question-suggestion primitive |

## New Requirement: Smart Survey Question Suggestions

### JTBD

When a user is trying to qualify a lead, move a deal forward, validate a theme, or close a knowledge gap, the system should be able to say:

> "Given what we already know about John Doe and the current intent, here are the 3 highest-impact questions to ask next."

This should work for:
- the survey editor UI
- Uppy / Mastra agents
- the MCP server
- future sales, research, and qualification workflows

### What This Is

A reusable recommendation layer that proposes **ordered next-best questions** for a specific person and intent.

Inputs:
- `projectId`
- `personId` or person context payload
- `intent`
  - examples: `qualify`, `advance_deal`, `validate_theme`, `fill_profile_gap`, `segment`, `membership_followup`
- optional `goal`
- optional `existingSurveyId`
- optional `knownResponses`
- optional `questionBudget` (for example 3)

Outputs:
- ordered list of suggested questions
- why each question matters
- what known data or evidence it is using
- what gap it is trying to close
- suggested metadata:
  - `personFieldKey`
  - `taxonomyKey`
  - recommended answer type
  - whether it should be a screener, branch point, or follow-up

### Product Behaviors

1. **Editor support**
   - Show "Suggested questions to learn next" for the selected audience/person/segment.
   - Let users accept, edit, or ignore suggested questions.

2. **Agent support**
   - A Mastra tool can answer: "What 3 questions should I ask John Doe to qualify him for this deal?"
   - Agents can use this in chat without creating a full survey first.

3. **MCP support**
   - External clients can request strategic question suggestions using the same logic and evidence sources.

4. **Bridge to branching**
   - Branching remains the deterministic routing layer for a chosen question set.
   - Smart question suggestion decides **what should be in the question set in the first place**.

### Proposed Capability: `suggestSmartSurveyQuestions`

Create a shared service/tool rather than hard-coding this into one UI:

**Potential files**
- `app/features/research-links/lib/smart-survey-questioning.server.ts`
- `app/mastra/tools/suggest-smart-survey-questions.ts`
- MCP surface built on the same server helper

```typescript
interface SmartSurveyIntent =
  | "qualify"
  | "advance_deal"
  | "validate_theme"
  | "fill_profile_gap"
  | "segment"
  | "membership_followup";

interface SuggestSmartSurveyQuestionsInput {
  projectId: string;
  personId?: string;
  intent: SmartSurveyIntent;
  goal?: string;
  existingSurveyId?: string;
  knownResponses?: Record<string, unknown>;
  questionBudget?: number;
}

interface SuggestedQuestion {
  prompt: string;
  type: "select_one" | "select_many" | "long_text" | "likert" | "matrix";
  rationale: string;
  closesGap: string;
  usesAttributes: string[];
  evidenceSources: string[];
  taxonomyKey?: string | null;
  personFieldKey?: string | null;
  branchRole?: "screener" | "path_decision" | "follow_up" | "shared";
}

interface SuggestSmartSurveyQuestionsResult {
  suggestions: SuggestedQuestion[];
  missingCriticalData: string[];
  reasoningSummary: string;
}
```

### Decisioning Heuristic

The recommendation layer should rank questions using:
- **intent fit**: does this question help achieve the current business outcome?
- **knowledge gap**: do we already know the answer from CRM, facets, prior surveys, or evidence?
- **decision value**: will the answer change routing, qualification, prioritization, or next action?
- **respondent burden**: prefer the smallest number of highest-value questions
- **reuse**: prefer canonical fields/taxonomies when answers should feed profile or branching logic later

### Relationship To Person-Attribute Branching

Person-attribute branching is still the right immediate priority.

Why:
- branching reduces respondent friction inside an existing survey
- Smart Surveys decides which questions are worth asking at all

Recommended order:
1. Ship person-attribute-aware branching
2. Reuse that person/response context in `suggestSmartSurveyQuestions`
3. Add editor and agent surfaces for suggestion/acceptance

### Acceptance Criteria For This Capability

- The system can suggest 3-5 questions for a specific person and current intent, with rationale.
- Suggestions reuse known person, org, facet, and evidence context where available.
- Suggestions avoid asking for data we already know unless confirmation is strategically useful.
- Agents and MCP can call the same underlying capability.
- Suggested questions can carry canonical metadata (`personFieldKey`, `taxonomyKey`) for downstream branching/profile sync.

## Proposed Solution

### Phase 1: Smart Survey Recommendations

The key insight: **recommend what surveys to create**, don't ask users to configure options.

#### 1.1 New DB Helper: `getProjectResearchContext()`

**File**: `app/features/research-links/db.ts`

```typescript
export async function getProjectResearchContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectResearchContext> {
  const [projectSections, themes, interviewPrompts, previousSurveys, accountContext] =
    await Promise.all([
      // Goal, target roles, customer problem
      supabase.from('project_sections')
        .select('kind, content_md')
        .eq('project_id', projectId)
        .in('kind', ['goal', 'target_roles', 'target_orgs', 'customer_problem']),

      // Themes with evidence counts (for validation status)
      supabase.from('themes')
        .select('id, name, jtbd, pain, desired_outcome, motivation, evidence_count')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10),

      // Existing interview questions (to avoid duplication)
      supabase.from('interview_prompts')
        .select('text, category')
        .eq('project_id', projectId)
        .eq('is_selected', true),

      // Previous surveys with response counts
      supabase.from('research_links')
        .select('name, questions, research_link_responses(count)')
        .eq('project_id', projectId)
        .limit(5),

      // Account context
      supabase.from('projects')
        .select('accounts!inner(company_description, customer_problem, offerings, target_roles)')
        .eq('id', projectId)
        .single()
    ])

  return { projectSections, themes, interviewPrompts, previousSurveys, accountContext }
}
```

#### 1.2 Survey Recommendations Generator

**File**: `app/features/research-links/api/suggest-surveys.tsx` (NEW)

```typescript
interface SurveyRecommendation {
  id: string              // Unique ID for selection
  title: string           // "Validate Pricing Insights"
  description: string     // Why this survey matters
  goal: 'discover' | 'validate' | 'deep_dive' | 'pricing' | 'nps'
  focusTheme?: string     // Theme to explore
  targetSegment?: string  // Who to survey
  reasoning: string       // "You have 3 pricing themes with low evidence"
}

function generateRecommendations(context: ProjectResearchContext): SurveyRecommendation[] {
  const recommendations: SurveyRecommendation[] = []

  // Themes with low evidence → validation survey
  const lowEvidenceThemes = context.themes.filter(t => t.evidence_count < 3)
  if (lowEvidenceThemes.length > 0) {
    recommendations.push({
      id: 'validate-themes',
      title: `Validate: ${lowEvidenceThemes[0].name}`,
      description: 'Gather more evidence for emerging themes',
      goal: 'validate',
      focusTheme: lowEvidenceThemes[0].name,
      reasoning: `${lowEvidenceThemes.length} themes need more evidence`
    })
  }

  // Pricing themes → pricing survey
  const pricingThemes = context.themes.filter(t =>
    t.name.toLowerCase().includes('pricing') || t.pain?.includes('cost'))
  if (pricingThemes.length > 0) {
    recommendations.push({
      id: 'pricing',
      title: 'Pricing Validation Survey',
      description: 'Understand willingness to pay and pricing sensitivity',
      goal: 'pricing',
      focusTheme: pricingThemes[0].name,
      reasoning: 'Pricing-related themes detected'
    })
  }

  // No recent surveys → NPS check
  const recentSurveys = context.previousSurveys.filter(s => /* last 30 days */)
  if (recentSurveys.length === 0) {
    recommendations.push({
      id: 'nps',
      title: 'NPS & Satisfaction Check',
      description: 'Measure customer satisfaction and loyalty',
      goal: 'nps',
      reasoning: 'No recent satisfaction surveys'
    })
  }

  // New project → discovery survey
  if (context.themes.length === 0) {
    recommendations.push({
      id: 'discovery',
      title: 'Discovery Survey',
      description: 'Learn about customer pains and needs',
      goal: 'discover',
      reasoning: 'Start gathering initial insights'
    })
  }

  return recommendations.slice(0, 3) // Max 3 recommendations
}
```

#### 1.3 Update Create UI with Recommendations

**File**: `app/features/research-links/pages/create.tsx`

Show recommendation cards before the current Step 1:

```tsx
// New Step 0: Recommendations
{step === 0 && recommendations.length > 0 && (
  <motion.div>
    <Card>
      <CardHeader>
        <CardTitle>Suggested Surveys</CardTitle>
        <CardDescription>Based on your research progress</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {recommendations.map(rec => (
            <button
              key={rec.id}
              onClick={() => selectRecommendation(rec)}
              className="text-left p-4 border rounded-lg hover:border-primary"
            >
              <h3 className="font-semibold">{rec.title}</h3>
              <p className="text-sm text-muted-foreground">{rec.description}</p>
              <p className="text-xs text-muted-foreground mt-2">{rec.reasoning}</p>
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setStep(1)}>
          Or start from scratch...
        </Button>
      </CardContent>
    </Card>
  </motion.div>
)}

// When recommendation selected:
function selectRecommendation(rec: SurveyRecommendation) {
  setName(rec.title)
  setDescription(rec.description)
  setSelectedRecommendation(rec)
  setStep(2) // Skip to questions, auto-generate
}
```

### Phase 2: Uppy Integration (Chat-Based Survey Creation)

#### 2.1 Connect Uppy Tools to Survey Creation

The user can ask Uppy:
- "Create a survey to validate our pricing themes"
- "Generate questions for educators about onboarding"
- "What should I ask to learn more about the 'budget concerns' theme?"

Uppy already has all the context tools - we need a new tool to create surveys.

**New Tool**: `createResearchLinkTool`

```typescript
export const createResearchLinkTool = createTool({
  id: "createResearchLink",
  description: `Create a survey/research link with AI-generated questions.

Use when user wants to:
- Create a survey for specific audience
- Generate questions about a theme
- Validate specific insights
- Collect structured feedback`,

  inputSchema: z.object({
    name: z.string(),
    description: z.string().optional(),
    surveyGoal: z.enum(['discover', 'validate', 'deep_dive', 'pricing', 'nps']),
    targetSegment: z.string().optional(),
    focusTheme: z.string().optional(),
    questionCount: z.number().min(1).max(10).default(5),
    autoGenerateQuestions: z.boolean().default(true),
  }),

  execute: async (input, context) => {
    // 1. Get project context
    const projectId = context.requestContext.get('project_id')
    const researchContext = await getProjectResearchContext(supabase, projectId)

    // 2. Generate questions if requested
    let questions = []
    if (input.autoGenerateQuestions) {
      questions = await generateContextAwareQuestions({
        ...input,
        researchContext
      })
    }

    // 3. Create the research link
    const { data: link } = await supabase.from('research_links').insert({
      project_id: projectId,
      account_id: accountId,
      name: input.name,
      slug: generateSlug(),
      description: input.description,
      questions,
      is_live: false // Draft until user reviews
    }).select().single()

    // 4. Return with edit URL
    return {
      success: true,
      surveyId: link.id,
      editUrl: `/a/${accountId}/${projectId}/ask/${link.id}/edit`,
      questionCount: questions.length,
      message: `Created survey "${input.name}" with ${questions.length} questions. Review and publish when ready.`
    }
  }
})
```

### Phase 3: Suggested Surveys (Proactive Intelligence)

Based on project state, Uppy suggests what surveys to create:

```typescript
// In fetchProjectStatusContextTool - add new scope: 'suggestedSurveys'

if (scopes.includes('suggestedSurveys')) {
  const suggestions = await generateSurveySuggestions(projectId)
  // Returns:
  // - "Validate pricing theme" (if pricing theme has low evidence)
  // - "Deeper dive on onboarding pain" (if high-confidence theme needs more)
  // - "NPS check" (if no recent satisfaction data)
  // - "Segment comparison" (if multiple personas but no segment-specific surveys)
}
```

## Implementation Plan

### Phase 1: Core Context Integration (3-4 days)

1. **Create `getProjectResearchContext()` helper**
   - File: `app/features/research-links/db.ts`
   - Queries: project_sections, themes, interview_prompts, previous surveys

2. **Enhance `generate-questions.tsx`**
   - Accept: surveyGoal, targetSegment, focusTheme
   - Fetch: project context automatically
   - Build: enriched prompt with context

3. **Update `create.tsx` UI**
   - Add: Survey strategy section (optional)
   - Show: Available themes to focus on
   - Pass: Strategy options to generation endpoint

### Phase 2: Uppy Integration (2-3 days)

4. **Create `createResearchLinkTool`**
   - File: `app/mastra/tools/create-research-link.ts`
   - Uses: `getProjectResearchContext()` + question generation

5. **Add tool to project-status-agent**
   - Register in tools array
   - Update instructions for survey creation use cases

### Phase 3: Proactive Suggestions (Future)

6. **Add `suggestedSurveys` scope to context tool**
7. **Create suggestion generation logic**
8. **Display suggestions in project dashboard**

## Files to Modify

| File | Change |
|------|--------|
| `app/features/research-links/db.ts` | Add `getProjectResearchContext()` |
| `app/features/research-links/api/generate-questions.tsx` | Enhance with context |
| `app/features/research-links/pages/create.tsx` | Add strategy UI |
| `app/mastra/tools/create-research-link.ts` | NEW - Uppy tool |
| `app/mastra/agents/project-status-agent.ts` | Register new tool |

## Success Metrics

- Generated questions reference project themes
- Questions don't duplicate interview prompts
- Users can create surveys via Uppy chat
- Surveys align with research goals

## Open Questions

1. Should survey strategy be a required step or optional?
2. How to handle projects with no themes/research yet?
3. Should Uppy auto-suggest surveys or wait for user request?
