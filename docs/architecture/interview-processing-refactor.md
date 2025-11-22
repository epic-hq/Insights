# Interview Processing Refactor: Modular Task Design

## Executive Summary

This document outlines a refactoring of the interview processing pipeline to enable independent task orchestration, individual task retry capability, and resumable workflows.

## Data Model Clarification

**IMPORTANT**: Themes vs. Insights

- **Themes** are the canonical data model for user research findings
- Themes are simple named groupings with core fields: `name`, `statement`, `inclusion_criteria`
- The old `insights` table was **retired** - `insights_current` is now a **VIEW** over the `themes` table
- BAML ExtractedInsight class has many fields (category, journey_stage, jtbd, pain, etc.) but these are **NOT stored in the database**
- Only core theme fields are persisted to keep the schema simple
- Evidence links to themes via the `theme_evidence` junction table

## Current Problems

### 1. Monolithic Orchestration
- **Current**: `uploadMediaAndTranscribeTask` orchestrates the entire chain by triggering `extractEvidenceAndPeopleTask` → `analyzeThemesAndPersonaTask` → `attributeAnswersTask`
- **Problem**: If any step fails, you must re-run the entire pipeline from the beginning
- **Impact**: Wasted compute, time, and LLM costs when retrying

### 2. Mixed Responsibilities
- **Current**: Tasks like `analyzeThemesAndPersonaTask` both execute work (call `analyzeThemesAndPersonaCore`) AND orchestrate other tasks (trigger `generateInterviewInsightsTask` and `attributeAnswersTask`)
- **Problem**: Cannot retry just the theme generation without also re-running insight generation and answer attribution
- **Impact**: Tight coupling prevents flexible retry strategies

### 3. Lack of Resumability
- **Current**: No way to resume from a failed step without re-running previous successful steps
- **Problem**: If theme generation fails after evidence extraction succeeds, you must re-extract evidence
- **Impact**: User frustration, increased costs, slower iteration

### 4. Implicit Dependencies
- **Current**: Tasks implicitly depend on previous tasks completing and storing data in specific ways
- **Problem**: Unclear data contracts between tasks, making it hard to modify or extend the pipeline
- **Impact**: Fragile codebase, difficult to maintain

## Proposed Architecture

### Core Principle: Separation of Execution and Orchestration

Each step becomes an **atomic, independently retryable task** with clear inputs/outputs. A separate **orchestrator task** coordinates the workflow but doesn't execute business logic itself.

### Task Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  processInterviewOrchestrator (NEW)                        │
│  - Coordinates workflow                                     │
│  - Handles retry logic                                      │
│  - Manages state transitions                                │
│  - Does NOT execute business logic                          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ├─ Triggers tasks in sequence
                         ├─ Checks task completion state
                         └─ Can resume from any step
                         │
        ┌────────────────┼────────────────┬────────────────┐
        │                │                │                │
        ▼                ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Step 1:      │ │ Step 2:      │ │ Step 3:      │ │ Step 4:      │
│ Upload &     │ │ Extract      │ │ Generate     │ │ Finalize     │
│ Transcribe   │ │ Evidence     │ │ Themes       │ │ Analysis     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
     │                │                │                │
     │                │                │                │
     ▼                ▼                ▼                ▼
    Core            Core             Core             Core
   Function        Function         Function         Function
```

### Atomic Tasks

#### 1. `uploadAndTranscribeTask`
**Responsibility**: Create interview record and transcribe audio (if needed)
**Input**: `{ metadata, mediaUrl, transcriptData?, existingInterviewId?, analysisJobId? }`
**Output**: `{ interviewId, fullTranscript, language, transcriptData }`
**Stores**: Interview record in database
**Idempotent**: Yes - can be re-run with `existingInterviewId`

#### 2. `extractEvidenceTask`
**Responsibility**: Extract evidence units and people from transcript (with timestamps)
**Input**: `{ interviewId, fullTranscript, language, analysisJobId? }`
**Output**: `{ evidenceIds[], personId?, evidenceUnits[] }`
**Stores**: Evidence rows (with start_seconds for traceability), people rows, interview_people links
**Idempotent**: Yes - deletes existing evidence before re-extracting
**Can Resume From**: Completed Step 1

#### 3. `generateInsightsTask`
**Responsibility**: Generate insights from evidence using BAML and store in themes table
**Input**: `{ interviewId, evidenceUnits[], userCustomInstructions?, analysisJobId? }`
**Output**: `{ insightIds[] }`
**Stores**:
- Theme rows in `themes` table (exposed via `insights` view)
- `theme_evidence` junction table links (for traceability to timestamps)
**Idempotent**: Yes - deletes existing themes/insights for interview before creating
**Can Resume From**: Completed Step 2
**Note**: "Insights" and "themes" are synonymous. Users think of them as actionable insights backed by evidence. Currently stored in `themes` table, exposed via `insights` view. Future plan: rename `themes` → `insights` table.

#### 4. `assignPersonasTask`
**Responsibility**: Assign personas to people based on evidence
**Input**: `{ interviewId, projectId, personId, evidenceUnits[], analysisJobId? }`
**Output**: `{ personaIds[] }`
**Stores**: Persona assignments (people_personas table)
**Idempotent**: Yes - upserts persona assignments
**Can Resume From**: Completed Step 2 (doesn't depend on insights)

#### 5. `attributeAnswersTask`
**Responsibility**: Attribute evidence to project questions
**Input**: `{ interviewId, projectId, evidenceIds[], analysisJobId? }`
**Output**: `{ attributedCount }`
**Stores**: Evidence analysis results, answer attributions
**Idempotent**: Yes - re-runs analysis
**Can Resume From**: Completed Step 2

#### 6. `finalizeInterviewTask`
**Responsibility**: Update interview status, trigger analytics, send notifications
**Input**: `{ interviewId, analysisJobId? }`
**Output**: `{ success: boolean }`
**Stores**: Interview status update, PostHog events
**Idempotent**: Yes - status updates and analytics are idempotent
**Can Resume From**: Any completed step

### Orchestrator Task

#### `processInterviewOrchestrator`

```typescript
interface ProcessInterviewOrchestratorPayload {
  metadata: InterviewMetadata
  mediaUrl: string
  transcriptData?: Record<string, unknown>
  existingInterviewId?: string
  analysisJobId?: string
  userCustomInstructions?: string

  // Resume capability
  resumeFrom?: 'upload' | 'evidence' | 'insights' | 'personas' | 'answers' | 'finalize'
  skipSteps?: string[]  // Optional: skip specific steps (e.g., for testing)
}

interface ProcessInterviewState {
  interviewId: string
  fullTranscript?: string
  language?: string
  transcriptData?: Record<string, unknown>
  evidenceIds?: string[]
  evidenceUnits?: EvidenceUnit[]
  personId?: string
  insightIds?: string[]  // IDs from themes table (exposed as insights)
  personaIds?: string[]
  completedSteps: string[]
  currentStep: string
}
```

**Workflow Logic**:

```typescript
async function processInterviewOrchestrator(payload: ProcessInterviewOrchestratorPayload) {
  // Load or initialize state
  const state = await loadOrInitializeState(payload)

  // Determine starting point
  const startFrom = payload.resumeFrom || 'upload'

  try {
    // Step 1: Upload & Transcribe (if not resuming past this)
    if (shouldExecuteStep('upload', startFrom, state)) {
      const result = await uploadAndTranscribeTask.triggerAndWait({
        metadata: payload.metadata,
        mediaUrl: payload.mediaUrl,
        transcriptData: payload.transcriptData,
        existingInterviewId: payload.existingInterviewId,
        analysisJobId: payload.analysisJobId,
      })

      state.interviewId = result.interviewId
      state.fullTranscript = result.fullTranscript
      state.language = result.language
      state.transcriptData = result.transcriptData
      state.completedSteps.push('upload')

      await saveState(state)
    }

    // Step 2: Extract Evidence (parallel-capable, but currently sequential)
    if (shouldExecuteStep('evidence', startFrom, state)) {
      const result = await extractEvidenceTask.triggerAndWait({
        interviewId: state.interviewId,
        fullTranscript: state.fullTranscript,
        language: state.language,
        analysisJobId: payload.analysisJobId,
      })

      state.evidenceIds = result.evidenceIds
      state.evidenceUnits = result.evidenceUnits
      state.personId = result.personId
      state.completedSteps.push('evidence')

      await saveState(state)
    }

    // Step 3: Generate Insights (generates + stores in themes table)
    if (shouldExecuteStep('insights', startFrom, state)) {
      const result = await generateInsightsTask.triggerAndWait({
        interviewId: state.interviewId,
        evidenceUnits: state.evidenceUnits,
        userCustomInstructions: payload.userCustomInstructions,
        analysisJobId: payload.analysisJobId,
      })

      state.insightIds = result.insightIds
      state.completedSteps.push('insights')

      await saveState(state)
    }

    // Step 4: Assign Personas (depends on evidence, independent of insights)
    if (shouldExecuteStep('personas', startFrom, state)) {
      const result = await assignPersonasTask.triggerAndWait({
        interviewId: state.interviewId,
        projectId: payload.metadata.projectId,
        personId: state.personId,
        evidenceUnits: state.evidenceUnits,
        analysisJobId: payload.analysisJobId,
      })

      state.personaIds = result.personaIds
      state.completedSteps.push('personas')

      await saveState(state)
    }

    // Step 5: Attribute Answers (depends on evidence)
    if (shouldExecuteStep('answers', startFrom, state)) {
      await attributeAnswersTask.triggerAndWait({
        interviewId: state.interviewId,
        projectId: payload.metadata.projectId,
        evidenceIds: state.evidenceIds,
        analysisJobId: payload.analysisJobId,
      })

      state.completedSteps.push('answers')

      await saveState(state)
    }

    // Step 6: Finalize (always runs)
    if (shouldExecuteStep('finalize', startFrom, state)) {
      await finalizeInterviewTask.triggerAndWait({
        interviewId: state.interviewId,
        analysisJobId: payload.analysisJobId,
      })

      state.completedSteps.push('finalize')

      await saveState(state)
    }

    return {
      success: true,
      interviewId: state.interviewId,
      completedSteps: state.completedSteps,
    }
  } catch (error) {
    // Save state even on error so we can resume
    await saveState(state)

    throw error
  }
}
```

## State Management

### Approach 1: Database-Backed State (Recommended)

Store workflow state in `analysis_jobs` table (expand schema):

```sql
ALTER TABLE analysis_jobs ADD COLUMN workflow_state JSONB;
ALTER TABLE analysis_jobs ADD COLUMN completed_steps TEXT[];
ALTER TABLE analysis_jobs ADD COLUMN current_step TEXT;
```

**Pros**:
- Persistent across trigger.dev restarts
- Easy to query and monitor
- Can resume from any point
- Supports long-running workflows

**Cons**:
- Requires DB schema changes
- Slightly more complex state management

### Approach 2: Trigger.dev Metadata (Alternative)

Store state in trigger.dev task metadata:

```typescript
metadata.set('workflowState', JSON.stringify(state))
```

**Pros**:
- No DB changes needed
- Built-in to trigger.dev

**Cons**:
- Lost if trigger.dev instance restarts
- Harder to query externally
- Metadata size limits

**Recommendation**: Use Approach 1 (database-backed) for production reliability.

## Migration Strategy

### Phase 1: Create New Tasks (Non-Breaking)

1. Create all 7 atomic tasks alongside existing tasks
2. Create orchestrator task
3. Test orchestrator with new interviews
4. Validate against existing task behavior

**Deliverable**: New task structure working in parallel with old

### Phase 2: Gradual Rollout

1. Add feature flag `ENABLE_MODULAR_WORKFLOW`
2. Route new interviews to orchestrator when flag enabled
3. Monitor for errors, performance, cost
4. Gradually increase traffic to new pipeline

**Deliverable**: Validated new pipeline handling production traffic

### Phase 3: Deprecate Old Tasks

1. Migrate all traffic to new orchestrator
2. Add deprecation warnings to old tasks
3. Remove old task invocations after 1 month
4. Clean up old code

**Deliverable**: Old pipeline fully removed

## Benefits

### 1. Independent Retry
- Failed theme generation? Just retry `createThemesTask`
- Failed transcription? Just retry `uploadAndTranscribeTask`
- No need to re-run entire pipeline

### 2. Resume from Failure
- Workflow crashes? Resume from last completed step
- Saves time, compute, and LLM costs
- Better user experience

### 3. Parallel Execution (Future)
- `assignPersonasTask`, `attributeAnswersTask`, and `generateInsightsTask` can run in parallel after evidence extraction
- Faster overall pipeline execution

### 4. Clear Data Contracts
- Each task has explicit input/output types
- Easy to understand dependencies
- Simpler testing and debugging

### 5. Flexible Orchestration
- Can skip steps for testing (e.g., skip theme generation)
- Can add new steps without modifying existing tasks
- Supports A/B testing different workflows

### 6. Better Monitoring
- Each task reports its own metrics
- Clear visibility into which step is slow/failing
- Better cost attribution per step

## Implementation Checklist

### Phase 1: Setup
- [ ] Create new directory `src/trigger/interview/v2/` for refactored tasks
- [ ] Define shared types in `src/trigger/interview/v2/types.ts`
- [ ] Create state management utilities in `src/trigger/interview/v2/state.ts`
- [ ] Extend `analysis_jobs` table schema for workflow state

### Phase 2: Atomic Tasks
- [ ] Implement `uploadAndTranscribeTask` (reuse existing core function)
- [ ] Implement `extractEvidenceTask` (reuse existing core function)
- [ ] Implement `generateInsightsTask` (combines BAML insight generation + storing in themes table + theme_evidence links)
- [ ] Implement `assignPersonasTask` (extract from `analyzeThemesAndPersonaCore`)
- [ ] Implement `attributeAnswersTask` (reuse existing core function)
- [ ] Implement `finalizeInterviewTask` (extract from `attributeAnswersAndFinalizeCore`)

### Phase 3: Orchestrator
- [ ] Implement `processInterviewOrchestrator`
- [ ] Add resume logic
- [ ] Add state persistence
- [ ] Add error handling and rollback

### Phase 4: Testing
- [ ] Unit tests for each atomic task
- [ ] Integration tests for orchestrator
- [ ] Test resume capability
- [ ] Test parallel execution paths
- [ ] Load testing

### Phase 5: Rollout
- [ ] Add feature flag `ENABLE_MODULAR_WORKFLOW`
- [ ] Update interview upload flow to use orchestrator when flag enabled
- [ ] Monitor metrics (latency, cost, errors)
- [ ] Gradual rollout to 100%

### Phase 6: Cleanup
- [ ] Deprecate old tasks
- [ ] Remove old task code
- [ ] Update documentation

## Example Usage

### Retry Failed Theme Generation

```typescript
// Interview failed during insight/theme generation
const analysisJobId = "job-123"

// Resume from insights step (will re-run insight generation but skip previous steps)
await processInterviewOrchestrator.trigger({
  analysisJobId,
  resumeFrom: 'insights',
  // All other data loaded from state
})
```

### Reprocess Interview with New Instructions

```typescript
// User wants to reprocess with custom instructions
const interviewId = "interview-456"

// Resume from insights step with new instructions
await processInterviewOrchestrator.trigger({
  interviewId,
  userCustomInstructions: "Focus on pricing and value prop",
  resumeFrom: 'insights',
})
```

### Skip Expensive Steps for Testing

```typescript
// Test workflow without running LLM-heavy steps
await processInterviewOrchestrator.trigger({
  metadata: testMetadata,
  mediaUrl: testUrl,
  skipSteps: ['insights'],  // Skip expensive BAML insight generation
})
```

## Open Questions

1. **Parallel execution priority**: Should we enable parallel execution in Phase 1 or defer to Phase 2?
2. **State retention**: How long should we keep workflow state? 30 days? 90 days?
3. **Backward compatibility**: Should we support resuming old-style workflows, or only new ones?
4. **Cost tracking**: Should each task report its own LLM cost to Langfuse separately?

## Next Steps

1. Review this design with team
2. Get approval on migration strategy
3. Create GitHub issues for each task in checklist
4. Begin Phase 1 implementation
