# Diagram of Ingestion pipeline

Supports People Linking


## Current (v2 orchestrator enabled with v1 and legacy)

```mermaid
flowchart TD
  subgraph Upload_Onboarding
    upload["UploadScreen / OnboardingFlow"]
    flag{ENABLE_MODULAR_WORKFLOW}
    upload -->|"file or url"| flag
    flag -->|true| v2_upload["Trigger v2 orchestrator"]
    flag -->|false| legacy_upload["Legacy processInterview server"]
  end

  subgraph Reprocess
    reprocess["Reprocess buttons (/api/reprocess-evidence, /api/reprocess-interview)"]
    reprocess -->|"flag true"| v2_reprocess["Trigger v2 orchestrator (resumeFrom evidence)"]
    reprocess -->|"flag false"| v1_reprocess["Trigger v1 task extract-evidence-and-people"]
  end

  subgraph Webhooks_Check
    webhook["/api/assemblyai-webhook"]
    check["/api/interviews.check-transcription"]
    webhook -->|"flag true"| v2_webhook["Trigger v2 orchestrator from webhook"]
    webhook -->|"flag false"| legacy_webhook["Legacy processInterview server"]
    check -->|"flag true"| v2_check["Trigger v2 orchestrator"]
    check -->|"flag false"| legacy_check["Legacy processInterview server"]
  end

  subgraph Other_Legacy
    upload_api["/api.upload-file"]
    internal_api["/api.process-interview-internal"]
    upload_api --> legacy_upload_util["processInterviewTranscript legacy utils"]
    internal_api --> legacy_internal_util["processInterviewTranscript legacy utils"]
  end

  subgraph V1_Task
    v1_task["Trigger v1 extract-evidence-and-people"]
    v1_reprocess --> v1_task
  end

  subgraph V2_Tasks
    v2_upload --> v2_tasks["Modular v2 tasks sanitize → extract → assign → finalize"]
    v2_reprocess --> v2_tasks
    v2_webhook --> v2_tasks
    v2_check --> v2_tasks
  end

  classDef v2 fill:#d1f5d3,stroke:#2b7a2a,color:#0f3a0f;
  classDef legacy fill:#ffe4d4,stroke:#b45a1b,color:#5a2b0f;
  class v2_upload,v2_reprocess,v2_webhook,v2_check,v2_tasks v2;
  class legacy_upload,legacy_webhook,legacy_check,legacy_upload_util,legacy_internal_util,v1_reprocess,v1_task legacy;

  %% Note: Each node is on its own line; IDs avoid slashes; labels are in quotes.
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

- Duplicate key collisions: mitigated by queue/idempotency on extract and lowercase company normalization; requires migration `20251235000000_people_unique_with_company.sql` applied.
- Legacy dependency: `extractEvidenceTaskV2` still imports `extractEvidenceAndPeopleCore`; must inline to delete `processInterview.server.ts`.
- Persona synthesis: still in legacy core; needs port into `assignPersonasTaskV2`.
- Placeholder enforcement: helpers exist, but full enforcement depends on inlining the legacy core.
- Transcript_key: v2 sets it after mapping; ensure the inlined core preserves this.
- Import-from-URL uses a shim; safe post-legacy deletion once inlining is done.

Confidence: Medium. The plan is clear and helpers/migration are in place, but risk remains until the legacy extract and persona logic are fully inlined into v2 and verified end-to-end.
