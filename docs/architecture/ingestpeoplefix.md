# Diagram of Ingestion pipeline

Supports People Linking


## Current (v2 orchestrator - feature flag removed)

All entry points now use v2 orchestrator. Legacy/v1 code paths removed.

```mermaid
flowchart TD
  subgraph Upload_Onboarding
    upload["UploadScreen / OnboardingFlow"]
    upload -->|"file or url"| v2_upload["Trigger v2 orchestrator"]
  end

  subgraph Reprocess
    reprocess["Reprocess buttons - api/reanalyze-themes"]
    reprocess --> v2_reprocess["Trigger v2 orchestrator resumeFrom insights"]
  end

  subgraph Webhooks_Check
    webhook["/api/assemblyai-webhook"]
    check["/api/interviews.check-transcription"]
    webhook --> v2_webhook["Trigger v2 orchestrator"]
    check --> v2_check["Trigger v2 orchestrator"]
  end

  subgraph V2_Orchestrator
    v2_upload --> orch["interview.v2.orchestrator"]
    v2_reprocess --> orch
    v2_webhook --> orch
    v2_check --> orch
  end

  subgraph V2_Tasks
    orch -->|"idempotencyKey per run"| upload_task["uploadAndTranscribe"]
    upload_task --> extract["extractEvidence - max 3 concurrent batches"]
    extract --> enrich["enrichPerson"]
    enrich --> insights["generateInsights"]
    insights --> personas["assignPersonas"]
    personas --> answers["attributeAnswers"]
    answers --> finalize["finalizeInterview"]
  end

  classDef v2 fill:#d1f5d3,stroke:#2b7a2a,color:#0f3a0f;
  class v2_upload,v2_reprocess,v2_webhook,v2_check,orch,upload_task,extract,enrich,insights,personas,answers,finalize v2;
```

## V2 people-linking plan (task-level view)

```mermaid
flowchart LR
  orch[interview.v2.orchestrator] --> sanitize[interview.v2.sanitizeTranscript]
  sanitize --> extract[interview.v2.extractEvidence]
  extract --> assign_people[interview.v2.assignPeople]
  assign_people --> assign_personas[interview.v2.assignPersonas]
  assign_personas --> finalize[interview.v2.finalizeInterview]

  subgraph People_Link_Plan
    A[Normalize speaker labels → transcript_key: SPEAKER A/B/…]
    B[Person emission: person_key per participant; skip placeholders Participant 1 / Speaker A]
    C[Upsert people with account_id+name_hash+company; set person_type for internal/external]
    D[Link interview_people with transcript_key -> person_id]
  end

  extract -. emits .-> A
  extract -. emits .-> B
  assign_people --> C
  finalize --> D

  classDef v2 fill:#d1f5d3,stroke:#2b7a2a,color:#0f3a0f;
  class orch,sanitize,extract,assign_people,assign_personas,finalize,A,B,C,D v2;

  %% Note: Each node is on its own line; IDs avoid slashes; labels are in quotes. Avoid parentheses/linebreaks in labels; use simple text or semicolons.
```

### Notes
- Consolidate on `person_key` (pipeline ID) and `transcript_key` (speaker label) — deprecate `participant_key`.
- Skip placeholder speakers (“Participant 1”, “Speaker A”) when upserting people; apply company-aware onConflict.
- After mapping, persist `transcript_key` on `interview_people` so UI linking stays stable.

## Ingest consolidation (action plan)
- Default to v2 everywhere: remove ENABLE_MODULAR_WORKFLOW branches and stop invoking legacy/v1 routes (`/api.upload-file`, `/api.process-interview-internal`, v1 trigger ids).
- Shared helpers: use `normalizeSpeakerLabel`, `isPlaceholderPerson`, and `upsertPersonWithCompanyAwareConflict` (account_id,name_hash,company) across v2 tasks.
- V2 tasks:
  - `extractEvidenceTaskV2`: inline/replace legacy core (no import from processInterview.server); apply shared helpers; skip placeholders; emit transcript_key + person_key mapping directly.
  - `assignPersonasTaskV2`: port persona logic from legacy core.
  - `enrichPersonTaskV2`: ensure person upserts use company-aware conflict/person_type.
  - `finalizeInterviewTaskV2`: write `transcript_key` onto `interview_people` after mapping.
- Identifier cleanup: drop `participant_key`, use `person_key` + `transcript_key` only.
- Delete legacy after burn-in: `processInterview.server.ts`, v1 trigger IDs, and their route callers once v2 parity is verified.

> Mermaid tip: Each node is on its own line; IDs avoid slashes; labels in quotes; avoid parentheses/linebreaks in labels.


## Status & remaining concerns

### Completed (2024-12-18)

- [x] **Feature flag removed**: `ENABLE_MODULAR_WORKFLOW` branches deleted from all API routes
- [x] **Idempotency keys**: All child tasks now have idempotency keys (`extract-${interviewId}-${ctx.run.id}`, etc.)
- [x] **Batch concurrency**: Limited to 3 parallel BAML calls (was unlimited `Promise.all`)
- [x] **People constraint fix**:
  - Plain index `uniq_people_account_name_company_plain` for ON CONFLICT
  - Normalized existing data (NULL→'', uppercase→lowercase)
  - Added `NOT NULL DEFAULT ''` constraint on `people.company`
- [x] **Step order fix**: Added missing `enrich-person` step in `shouldExecuteStep`
- [x] **Facet kinds seeded**: 12 new kinds (emotion, workflow, goal, pain, behavior, tool, value, requirements, preference, demographic, context, artifact)
- [x] **Progress callbacks**: Heartbeat updates throughout extractEvidenceCore
- [x] **Monolith refactoring (Phase 1)**:
  - `timestampMapping.ts` (204 lines) - Pure timestamp resolution utilities
  - `facetProcessing.ts` (159 lines) - Facet catalog and mention handling
  - `peopleResolution.ts` (207 lines) - Name parsing, normalization, resolution
  - `personaSynthesis.ts` (165 lines) - Persona facet derivation types/utilities
  - Main `extractEvidenceCore.ts` reduced from ~2400 to ~2071 lines

### Remaining work

| Issue | Severity | Notes |
|-------|----------|-------|
| **extractEvidenceCore still large** | Medium | 2071 lines; DB ops and workflow logic harder to extract |
| **No transaction boundaries** | Medium | Evidence, people, facets in separate DB calls; partial failure = orphaned records |
| **No partial checkpointing** | Low | Full step retry is acceptable for now |
| **Legacy code deletion** | Low | `processInterview.server.ts` ready to delete after verification |

### Extracted modules (src/trigger/interview/v2/)

| Module | Lines | Purpose |
|--------|-------|---------|
| `timestampMapping.ts` | 204 | Timestamp coercion, word/segment timeline building, snippet anchoring |
| `facetProcessing.ts` | 159 | Facet catalog resolution, lookup building, mention matching |
| `peopleResolution.ts` | 207 | Name parsing, generic label detection, fallback names, name resolution |
| `personaSynthesis.ts` | 165 | Persona facet grouping, observation building from BAML output |

All modules are <500 lines, have clear single responsibilities, are independently testable, and accept dependencies via parameters (no global state).

### Further refactoring opportunities

The remaining ~2071 lines in extractEvidenceCore contain tightly coupled DB operations and workflow orchestration. Further decomposition would require:
1. Transaction boundaries (wrap multiple inserts in single transaction)
2. Separate evidence row builder from DB insert logic
3. Extract interview_people linking into its own module

### Confidence: High (85%)

Core reliability fixes are in place. Module extraction complete for pure utilities. Remaining code is workflow orchestration that works correctly but could benefit from transaction boundaries.
