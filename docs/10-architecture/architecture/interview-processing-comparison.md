# Interview Processing: Current vs. Proposed Architecture

## Current Architecture (Monolithic Chain)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ uploadMediaAndTranscribeTask                                           │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Transcribe audio (if needed)                                    │ │
│ │ 2. Create interview record                                         │ │
│ │ 3. Trigger extractEvidenceAndPeopleTask ──┐                        │ │
│ └────────────────────────────────────────────┼────────────────────────┘ │
└──────────────────────────────────────────────┼──────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ extractEvidenceAndPeopleTask                                           │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Extract evidence units via BAML                                 │ │
│ │ 2. Extract people and link to interview                            │ │
│ │ 3. Trigger generateSalesLensTask (side effect)                     │ │
│ │ 4. Return evidence result                                          │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ analyzeThemesAndPersonaTask                                            │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Trigger generateInterviewInsightsTask ──┐                        │ │
│ │ 2. Wait for insights                       │                        │ │
│ │ 3. Call analyzeThemesAndPersonaCore ───────┼──┐                     │ │
│ │ 4. Trigger attributeAnswersTask ───────────┼──┼──┐                  │ │
│ └────────────────────────────────────────────┼──┼──┼──────────────────┘ │
└──────────────────────────────────────────────┼──┼──┼────────────────────┘
                                               │  │  │
                    ┌──────────────────────────┘  │  │
                    ▼                             │  │
      ┌──────────────────────────────┐            │  │
      │ generateInterviewInsightsTask│            │  │
      │ - Generate insights via BAML │            │  │
      │ - Return insights            │            │  │
      └──────────────────────────────┘            │  │
                                                  │  │
                              ┌───────────────────┘  │
                              ▼                      │
              ┌─────────────────────────────────┐    │
              │ analyzeThemesAndPersonaCore     │    │
              │ - Auto-group themes             │    │
              │ - Create theme records          │    │
              │ - Assign personas               │    │
              └─────────────────────────────────┘    │
                                                     │
                                ┌────────────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │ attributeAnswersTask    │
                    │ - Run evidence analysis │
                    │ - Update interview      │
                    │ - Send analytics        │
                    └─────────────────────────┘
```

### Problems with Current Architecture

❌ **Cannot retry individual steps** - Theme generation failure requires re-running entire chain
❌ **Mixed responsibilities** - Tasks both execute work AND orchestrate other tasks
❌ **Implicit dependencies** - Data passed through task results, not stored persistently
❌ **No resume capability** - Cannot resume from failure point
❌ **Tight coupling** - Modifying one task affects all downstream tasks
❌ **Hidden side effects** - Tasks trigger other tasks (e.g., generateSalesLensTask)

---

## Proposed Architecture (Modular + Orchestrator)

```
                    ┌────────────────────────────────┐
                    │ processInterviewOrchestrator   │
                    │ - Manages workflow             │
                    │ - Stores state in DB           │
                    │ - Enables resume               │
                    │ - NO business logic            │
                    └────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
         ┌─────────────────────────────────────────────────────┐
         │             Atomic Tasks (Independent)              │
         └─────────────────────────────────────────────────────┘

┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Step 1:        │  │ Step 2:        │  │ Step 3:        │
│ Upload &       │─▶│ Extract        │─▶│ Generate       │
│ Transcribe     │  │ Evidence       │  │ Insights       │
│                │  │                │  │                │
│ Input:         │  │ Input:         │  │ Input:         │
│ - mediaUrl     │  │ - interviewId  │  │ - interviewId  │
│ - metadata     │  │ - transcript   │  │ - evidence[]   │
│                │  │                │  │ - customs      │
│ Output:        │  │ Output:        │  │                │
│ - interviewId  │  │ - evidenceIds  │  │ Output:        │
│ - transcript   │  │ - personId     │  │ - insightIds   │
│                │  │ - evidence[]   │  │                │
│ Stores:        │  │                │  │ Stores:        │
│ - interview    │  │ Stores:        │  │ - themes tbl   │
│ - planned_ans  │  │ - evidence     │  │ - insights vw  │
│                │  │ - people       │  │ - theme_evid   │
│ ✅ Idempotent  │  │ - timestamps   │  │   (links)      │
│ ✅ Retryable   │  │                │  │                │
└────────────────┘  │ ✅ Idempotent  │  │ ✅ Idempotent  │
                    │ ✅ Retryable   │  │ ✅ Retryable   │
                    └────────────────┘  └────────────────┘
                                                │
                           ┌────────────────────┼────────────────────┐
                           │                    │                    │
                           ▼                    ▼                    ▼
                  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
                  │ Step 4:        │  │ Step 5:        │  │ Step 6:        │
                  │ Assign         │  │ Attribute      │  │ Finalize       │
                  │ Personas       │  │ Answers        │  │ Interview      │
                  │                │  │                │  │                │
                  │ Input:         │  │ Input:         │  │ Input:         │
                  │ - interviewId  │  │ - interviewId  │  │ - interviewId  │
                  │ - personId     │  │ - evidenceIds  │  │                │
                  │ - evidence[]   │  │                │  │                │
                  │                │  │                │  │                │
                  │ Output:        │  │ Output:        │  │ Output:        │
                  │ - personaIds   │  │ - attrCount    │  │ - success      │
                  │                │  │                │  │                │
                  │ Stores:        │  │ Stores:        │  │ Stores:        │
                  │ - personas     │  │ - analyses     │  │ - status       │
                  │ - assignments  │  │ - attributions │  │ - analytics    │
                  │                │  │                │  │                │
                  │ ✅ Idempotent  │  │ ✅ Idempotent  │  │ ✅ Idempotent  │
                  │ ✅ Retryable   │  │ ✅ Retryable   │  │ ✅ Retryable   │
                  └────────────────┘  └────────────────┘  └────────────────┘

                  Note: Steps 4 and 5 can run in parallel after Step 2

**Key Insight**: Step 3 generates insights via BAML and stores them in the `themes`
table. The `insights` view exposes themes as "insights" (they're synonymous).
Evidence → Insights/Themes linkage via `theme_evidence` enables traceability to
original audio/video timestamps.
```

### Benefits of Proposed Architecture

✅ **Independent retry** - Retry any step without re-running previous steps
✅ **Resume from failure** - Orchestrator resumes from last completed step
✅ **Clear separation** - Orchestrator coordinates, tasks execute
✅ **Explicit dependencies** - State stored in DB, clear data contracts
✅ **Parallel execution** - Steps 5 and 6 can run in parallel after Step 2
✅ **Easy testing** - Each task can be tested independently
✅ **Better monitoring** - Clear metrics per step
✅ **Cost visibility** - Track LLM costs per step

---

## Workflow State Management

### State Storage (analysis_jobs table)

```typescript
interface WorkflowState {
  // Core data
  interviewId: string
  fullTranscript?: string
  language?: string
  transcriptData?: Record<string, unknown>

  // Step outputs
  evidenceIds?: string[]
  evidenceUnits?: EvidenceUnit[]
  personId?: string
  insightIds?: string[]  // IDs from themes table (exposed via insights view)
  personaIds?: string[]

  // Progress tracking
  completedSteps: string[]
  currentStep: string
  lastUpdated: string
}
```

Stored in: `analysis_jobs.workflow_state` (JSONB column)

**Note on Insights/Themes**: These are synonymous. Data is stored in `themes` table and exposed to users via `insights` view. Future plan: rename `themes` → `insights` table once the legacy insights table is fully deprecated.

### Resume Example

```typescript
// Initial run fails at theme creation
await processInterviewOrchestrator.trigger({
  metadata: { accountId, projectId },
  mediaUrl: "https://...",
})

// Workflow completes Step 1 (upload), Step 2 (evidence)
// Fails at Step 3 (insights/themes) due to BAML timeout

// User clicks "Retry" in UI
await processInterviewOrchestrator.trigger({
  analysisJobId: "job-123",  // Contains saved state
  resumeFrom: 'insights',    // Skip completed steps
})

// Orchestrator:
// 1. Loads state from analysis_jobs.workflow_state
// 2. Sees Steps 1-2 completed
// 3. Resumes from Step 3
// 4. Re-runs insight generation (BAML) + stores as themes + creates theme_evidence links
// 5. Continues to Steps 4-6
```

---

## Migration Path

### Phase 1: Build in Parallel
- Create new v2 tasks without removing old tasks
- Old workflow continues unchanged
- New workflow available but not used in production

### Phase 2: Feature Flag Rollout
- Add `ENABLE_MODULAR_WORKFLOW` flag
- Route 10% of new interviews to v2 orchestrator
- Monitor metrics: latency, errors, costs
- Gradually increase to 100%

### Phase 3: Deprecation
- All new interviews use v2 orchestrator
- Old tasks marked deprecated
- Remove old tasks after 30 days

---

## Code Examples: Atomic Tasks

### Example 1: Extract Evidence Task

```typescript
// src/trigger/interview/v2/extractEvidence.ts

export const extractEvidenceTask = task({
  id: "interview.v2.extract-evidence",
  retry: workflowRetryConfig,
  run: async (payload: ExtractEvidencePayload) => {
    const { interviewId, fullTranscript, language, analysisJobId } = payload
    const client = createSupabaseAdminClient()

    try {
      // Update progress
      await updateAnalysisJobProgress(client, analysisJobId, {
        currentStep: 'evidence',
        progress: 40,
        statusDetail: 'Extracting evidence from transcript',
      })

      // Load interview data
      const { data: interview } = await client
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single()

      if (!interview) {
        throw new Error(`Interview ${interviewId} not found`)
      }

      // Delete existing evidence (for idempotency)
      await client
        .from('evidence')
        .delete()
        .eq('interview_id', interviewId)

      // Extract evidence with timestamps (reuse existing core function)
      const evidenceResult = await extractEvidenceAndPeopleCore({
        db: client,
        metadata: {
          accountId: interview.account_id,
          projectId: interview.project_id,
        },
        interviewRecord: interview,
        transcriptData: interview.transcript_data,
        language,
        fullTranscript,
      })

      // Update state
      await updateWorkflowState(client, analysisJobId, {
        evidenceIds: evidenceResult.insertedEvidenceIds,
        evidenceUnits: evidenceResult.evidenceUnits,  // Includes timestamps
        personId: evidenceResult.personData.id,
        completedSteps: ['upload', 'evidence'],
        currentStep: 'evidence',
      })

      return {
        evidenceIds: evidenceResult.insertedEvidenceIds,
        evidenceUnits: evidenceResult.evidenceUnits,
        personId: evidenceResult.personData.id,
      }
    } catch (error) {
      await updateAnalysisJobError(client, analysisJobId, {
        currentStep: 'evidence',
        error: errorMessage(error),
      })

      throw error
    }
  },
})
```

### Example 2: Generate Insights Task (Key Design Pattern)

```typescript
// src/trigger/interview/v2/generateInsights.ts

export const generateInsightsTask = task({
  id: "interview.v2.generate-insights",
  retry: workflowRetryConfig,
  run: async (payload: GenerateInsightsPayload) => {
    const { interviewId, evidenceUnits, userCustomInstructions, analysisJobId } = payload
    const client = createSupabaseAdminClient()

    try {
      await updateAnalysisJobProgress(client, analysisJobId, {
        currentStep: 'insights',
        progress: 65,
        statusDetail: 'Generating insights from evidence',
      })

      const { data: interview } = await client
        .from('interviews')
        .select('account_id, project_id')
        .eq('id', interviewId)
        .single()

      if (!interview?.project_id) {
        throw new Error(`Interview ${interviewId} not found or missing project`)
      }

      // Step 1: Call BAML to generate insights from evidence
      const insights = await generateInterviewInsightsFromEvidenceCore({
        evidenceUnits,
        userCustomInstructions,
      })

      // Step 2: Delete existing themes/insights for idempotency
      await client
        .from('themes')
        .delete()
        .eq('interview_id', interviewId)

      // Step 3: Store insights as theme records
      const themeRows = insights.insights.map(i => ({
        account_id: interview.account_id,
        project_id: interview.project_id,
        interview_id: interviewId,  // Link to interview
        name: i.name,
        statement: i.details ?? null,
        inclusion_criteria: i.evidence ?? null,
        exclusion_criteria: null,
        created_by: payload.metadata?.userId,
        updated_by: payload.metadata?.userId,
      }))

      const { data: createdThemes, error: themeError } = await client
        .from('themes')
        .insert(themeRows)
        .select('id')

      if (themeError || !createdThemes) {
        throw new Error(`Failed to create themes: ${themeError?.message}`)
      }

      // Step 4: Create theme_evidence links for traceability
      // This enables users to trace insights back to evidence with timestamps
      const themeEvidenceLinks = createdThemes.flatMap(theme =>
        evidenceUnits.map(evidence => ({
          theme_id: theme.id,
          evidence_id: evidence.id,
          project_id: interview.project_id,
          account_id: interview.account_id,
        }))
      )

      await client
        .from('theme_evidence')
        .insert(themeEvidenceLinks)

      // Update state
      await updateWorkflowState(client, analysisJobId, {
        insightIds: createdThemes.map(t => t.id),
        completedSteps: ['upload', 'evidence', 'insights'],
        currentStep: 'insights',
      })

      return {
        insightIds: createdThemes.map(t => t.id),
      }
    } catch (error) {
      await updateAnalysisJobError(client, analysisJobId, {
        currentStep: 'insights',
        error: errorMessage(error),
      })

      throw error
    }
  },
})
```

**Why This Design?**

The `generateInsightsTask` combines three operations into one atomic task:
1. **BAML Generation**: Call AI to generate insights from evidence
2. **Theme Storage**: Store insights in `themes` table (exposed via `insights` view)
3. **Traceability Links**: Create `theme_evidence` links so users can trace insights → evidence → timestamps

This ensures:
- ✅ **Atomic**: All three operations succeed or fail together
- ✅ **Idempotent**: Can be safely retried (deletes old themes first)
- ✅ **Traceable**: Every insight links back to supporting evidence with timestamps
- ✅ **User-friendly**: Users see "insights" (via view) but we store as "themes" (simpler schema)

---

## Comparison Table

| Feature | Current Architecture | Proposed Architecture |
|---------|---------------------|----------------------|
| **Retry granularity** | Entire pipeline | Individual step |
| **Resume capability** | ❌ No | ✅ Yes |
| **State management** | ❌ Implicit (task results) | ✅ Explicit (DB) |
| **Parallel execution** | ❌ Sequential only | ✅ Configurable |
| **Testing** | ⚠️ Must mock entire chain | ✅ Test each step independently |
| **Debugging** | ⚠️ Hard to isolate failures | ✅ Clear step boundaries |
| **Cost tracking** | ⚠️ Aggregated | ✅ Per-step |
| **Monitoring** | ⚠️ Black box | ✅ Per-step metrics |
| **Flexibility** | ❌ Rigid chain | ✅ Skip/reorder steps |
| **Maintainability** | ⚠️ Tight coupling | ✅ Loose coupling |

---

## Next Steps

1. **Review** this design with the team
2. **Prototype** one atomic task (e.g., `extractEvidenceTask`) to validate approach
3. **Implement** all atomic tasks in `src/trigger/interview/v2/`
4. **Build** orchestrator with state management
5. **Test** with sample interviews
6. **Deploy** behind feature flag
7. **Monitor** and gradually roll out
8. **Deprecate** old tasks
