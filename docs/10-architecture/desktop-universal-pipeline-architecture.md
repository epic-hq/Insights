# Desktop App ↔ Web API ↔ Universal Conversation Pipeline

> **Status:** Reference diagram (current as of 2026-04-18)
> **Audience:** Engineers reasoning about desktop ingestion, realtime evidence, and the unified conversation pipeline.
> **Companions:**
> - [`docs/20-features-prds/features/unified-conversation-architecture.md`](../20-features-prds/features/unified-conversation-architecture.md) — pipeline rationale & schema
> - [`docs/10-architecture/interview-processing-explained.md`](./interview-processing-explained.md) — three-phase processing
> - [`docs/10-architecture/interview-processing-flows.md`](./interview-processing-flows.md) — media URL strategy
> - [`docs/features/desktop-speaker-identification.md`](../features/desktop-speaker-identification.md) — Recall SDK speaker spec
> - [`docs/30-howtos/desktop-build-deploy.md`](../30-howtos/desktop-build-deploy.md) — desktop build

This doc is a **map, not a spec**. It shows how the Electron desktop app, the web API, and the shared conversation pipeline fit together so you can quickly locate the right code path when debugging or extending a feature.

---

## 1. System Context

All conversation sources (desktop live recording, file upload, URL import, Ask link, public AI chat) converge on the **`interviews` table** and the same downstream pipeline. The desktop app is one of four ingestion entry points — but the only one that streams evidence *during* the conversation.

```mermaid
flowchart LR
    subgraph Clients["Clients"]
        DESK["Electron Desktop App<br/><code>desktop/src/main.js</code>"]
        WEB["Web App (React Router 7)<br/><code>app/routes/*</code>"]
        ASK["Ask Link / Public Survey"]
        CHAT["Public AI Chat"]
    end

    subgraph ThirdParty["3rd-Party Services"]
        RECALL["Recall SDK<br/>(meeting capture + diarization)"]
        AAI["AssemblyAI<br/>(post-hoc transcription)"]
        R2["Cloudflare R2<br/>(media storage)"]
        OAI["OpenAI / BAML<br/>(evidence + persona)"]
    end

    subgraph Backend["Insights Backend"]
        API["Web API<br/><code>app/routes/api.*</code>"]
        TRG["Trigger.dev Tasks<br/><code>src/trigger/**</code>"]
        DB[("Supabase<br/>Postgres + RLS")]
    end

    DESK -- "REST (bearer token)" --> API
    DESK <-. "WebSocket events" .-> RECALL
    RECALL -. "webhook (optional)" .-> API
    WEB --> API
    ASK --> API
    CHAT --> API

    API -- "trigger.dev enqueue" --> TRG
    API <--> DB
    TRG <--> DB
    TRG --> AAI
    TRG --> OAI
    TRG <--> R2
    API <--> R2
```

**Key observation:** the desktop app talks to the web API over plain REST with a bearer token. Real-time events come from **Recall SDK directly into the desktop process** — they do *not* flow through our backend. The desktop batches those events and posts summarized evidence/utterances to the API.

---

## 2. Desktop ↔ Web API Boundary (Endpoints)

Every desktop → backend call lives under `/api/desktop/*`. Grouped by lifecycle phase:

```mermaid
flowchart TB
    subgraph Auth["Auth & Context"]
        A1["GET /api/desktop/context<br/>POST /api/desktop/context<br/><i>pick account + project</i>"]
        A2["GET /api/desktop/recall-token<br/><i>SDK token + webhook config</i>"]
    end

    subgraph Live["During Meeting (realtime)"]
        L1["POST /api/desktop/realtime-evidence<br/><i>batched utterances → evidence/tasks/people</i>"]
    end

    subgraph Stop["On Stop (finalize)"]
        S1["POST /api/desktop/people/resolve<br/><i>match / create Person rows</i>"]
        S2["POST /api/desktop/interviews/upload-media<br/><i>upload final audio/video</i>"]
        S3["POST /api/desktop/interviews/:id/finalize<br/><i>write transcript, link evidence→people,<br/>status=ready, enqueue Phase 2</i>"]
    end

    A1 --> A2 --> L1
    L1 --> S1 --> S2 --> S3
```

File references:

| Phase | Route file |
|---|---|
| Auth/context | `app/routes/api.desktop.context.ts` |
| Recall token | `app/routes/api.desktop.recall-token.ts` |
| Realtime evidence | `app/routes/api.desktop.realtime-evidence.ts` |
| Person resolve | `app/routes/api.desktop.people.resolve.ts` |
| Media upload | `app/routes/api.desktop.interviews.upload-media.ts` |
| Finalize | `app/routes/api.desktop.interviews.finalize.ts` |

---

## 3. Realtime Desktop Flow (Sequence)

This is what happens when a user is recording a live meeting on the desktop. The key insight is **evidence extraction runs continuously during the call**, not after.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant D as Desktop (main.js)
    participant R as Recall SDK
    participant API as Web API
    participant AI as OpenAI / BAML
    participant TRG as Trigger.dev
    participant DB as Supabase
    participant R2 as Cloudflare R2

    U->>D: Sign in, pick account/project
    D->>API: GET /api/desktop/context
    API-->>D: { accountId, projectId, uploadToken }
    D->>API: GET /api/desktop/recall-token
    API-->>D: Recall SDK token + webhook config

    Note over D,R: Meeting detected (Zoom/Meet/Teams)
    D->>R: Init Recall SDK, subscribe<br/>(transcript.data, participant_events.join)

    loop Live meeting
        R-->>D: participant_events.join (name, platform, extra_data)
        D->>D: processParticipantJoin() → meeting.participants[]
        R-->>D: transcript.data (words + participant)
        D->>D: processTranscriptData() → buffer utterances
        Note right of D: Every N seconds / M utterances
        D->>API: POST /api/desktop/realtime-evidence<br/>{ utterances, participants, existingEvidence }
        API->>AI: GPT-4o-mini extractEvidence
        API->>DB: upsert evidence/tasks (interview still 'draft')
        API-->>D: new evidence + tasks + people hints
        D->>U: Update floating panel UI
    end

    U->>D: Stop recording
    D->>API: POST /api/desktop/people/resolve<br/>(participants list)
    API->>DB: resolveOrCreatePerson() per participant
    API-->>D: personId map
    D->>R2: Upload final media (presigned URL)
    D->>API: POST /api/desktop/interviews/:id/finalize
    API->>DB: write transcript_formatted, link evidence↔people,<br/>status='ready'
    API->>TRG: enqueue assignPersonas (Phase 2)
    TRG->>AI: persona facet synthesis
    TRG->>DB: persist personas + facets
    DB-->>U: realtime subscription updates web UI
```

**Why this matters:**
- Evidence on screen during the call is the **same shape** as post-hoc evidence — they converge in the `evidence` table.
- Person resolution is deferred to stop-time so mid-meeting name updates (`participant_events.update`) don't create duplicate rows.
- Finalization is what flips `interviews.status` to `ready` and kicks off Phase 2 (persona synthesis); Phase 1 (evidence) already ran live.

---

## 4. Unified Pipeline — All Sources, One Table

The desktop app is just one producer. Every ingestion path writes to `interviews` and then flows through the same downstream stages.

```mermaid
flowchart LR
    subgraph Sources["Ingestion Entry Points"]
        S1["Desktop Realtime<br/>(Recall SDK)"]
        S2["File Upload<br/>POST /api/upload-file"]
        S3["URL Import<br/>POST /api/upload-from-url"]
        S4["Ask Link / Survey"]
        S5["Public AI Chat"]
    end

    INT[("interviews table<br/>source_type discriminator")]

    subgraph Phase0["Phase 0 — Transcription"]
        P0["uploadMediaAndTranscribe<br/>(AssemblyAI)<br/><i>skipped for desktop realtime</i>"]
    end
    subgraph Phase1["Phase 1 — Evidence"]
        P1A["Live: extractRealtimeEvidence<br/>(GPT-4o-mini)"]
        P1B["Batch: extractEvidenceAndPeople<br/>(BAML / GPT-4)"]
    end
    subgraph Phase2["Phase 2 — Persona"]
        P2["assignPersonas<br/>(facet synthesis)"]
    end
    subgraph Downstream["Downstream"]
        LENS["Lens Analysis"]
        TH["Theme Clustering"]
        INS["Insights"]
    end

    S1 --> INT
    S2 --> INT
    S3 --> INT
    S4 --> INT
    S5 --> INT

    S1 -. "bypass P0" .-> P1A
    S2 --> P0
    S3 --> P0
    P0 --> P1B

    P1A --> P2
    P1B --> P2
    P2 --> LENS --> TH --> INS
```

Source-type ↔ producer mapping (`interviews.source_type`):

| source_type | Producer | Transcription path |
|---|---|---|
| `desktop_live` | Desktop + Recall | Recall speaker-timeline (no AssemblyAI) |
| `upload_media` | Web upload | AssemblyAI via Trigger.dev |
| `url_import` | `/api/upload-from-url` | AssemblyAI via Trigger.dev |
| `survey_form` / `survey_chat` / `survey_voice` | Ask link | No transcription (text in) |
| `ai_chat` | Public AI chat | No transcription (text in) |

---

## 5. Core Entities (Ingestion Slice)

A narrow ER diagram focused on what the desktop pipeline touches — the full schema is larger.

```mermaid
erDiagram
    accounts ||--o{ projects : has
    projects ||--o{ interviews : has
    projects ||--o{ people : has
    projects ||--o{ evidence : has

    interviews ||--o{ evidence : produces
    interviews ||--o{ interview_people : participants
    people ||--o{ interview_people : joins
    people ||--o{ evidence_people : speakers
    evidence ||--o{ evidence_people : attributes
    people ||--o{ people_personas : maps
    personas ||--o{ people_personas : has

    interviews {
        uuid id PK
        uuid account_id FK
        uuid project_id FK
        text source_type "desktop_live | upload_media | ..."
        text status "draft | uploaded | ready | failed"
        text media_url "R2 key, not presigned"
        jsonb transcript_formatted
        uuid research_link_id FK "nullable"
    }
    people {
        uuid id PK
        uuid project_id FK
        text name
        text email "nullable"
        jsonb contact_info "platform IDs (zoom/teams/slack)"
    }
    evidence {
        uuid id PK
        uuid interview_id FK
        text quote
        text speaker_label
        jsonb anchors "timestamps, spans"
        text source "realtime | baml"
    }
    evidence_people {
        uuid evidence_id FK
        uuid person_id FK
    }
    interview_people {
        uuid interview_id FK
        uuid person_id FK
        text role "host | participant"
    }
```

**Why the junction tables exist:**
- `evidence_people` — one quote can have multiple speakers (e.g. interruption / cross-talk).
- `interview_people` — roster of the meeting, independent of whether each person actually spoke.
- `contact_info` JSONB on `people` — stores Zoom `conf_user_id`, Teams `user_id`, etc., so the same person is recognized across meetings *without* schema migrations per platform.

---

## 6. Reading Guide

If you're debugging a specific symptom, start here:

| Symptom | Start in |
|---|---|
| Wrong speaker labels on live evidence | `desktop/src/main.js` → `processTranscriptData()` + `api.desktop.realtime-evidence.ts` |
| Duplicate `people` rows across meetings | `app/lib/people/resolution.server.ts` and `contact_info` JSONB |
| Evidence missing after upload | `src/trigger/interview/v2/extractEvidence.ts` + BAML `ExtractEvidenceFromTranscriptV2` |
| Persona facets not populated | `src/trigger/interview/v2/assignPersonas.ts` |
| Media playback 403 / expired URL | `app/utils/media-url.client.ts` — regenerate presigned URL from R2 key |
| Desktop auth / project picker broken | `app/routes/api.desktop.context.ts` |

---

## 7. What This Diagram Deliberately Omits

- **Auth internals** — desktop bearer tokens and Supabase session plumbing.
- **Lens / theme / insight internals** — covered in `docs/20-features-prds/features/unified-conversation-architecture.md`.
- **R2 presigning details** — covered in `interview-processing-flows.md`.
- **Survey-specific flows** (`research_link_responses`) — see unified architecture doc §"Decision: Keep research_link_responses".

Keep this file as the single-page system map. When a flow gets its own deep dive, link it from §1 rather than growing this document.
