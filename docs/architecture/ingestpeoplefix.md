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
  sanitize --> extract[interview.v2.extractEvidenceAndPeople]
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
