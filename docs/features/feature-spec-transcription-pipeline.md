# Transcription & Insight Pipeline – Queue-Based Architecture

## 1&nbsp;– Goals ✅ ACHIEVED

* ✅ Provide a **robust, resumable pipeline** for long-running media processing (upload → transcribe → analyze → ready).
* ✅ **Decouple** each heavy step with Postgres job queues so that failure in any step can be retried without re-playing previous steps.
* ✅ Expose **live status** to the UI via Supabase Realtime so users can watch progress in the Onboard/Processing widget.
* ✅ Keep implementation inside the existing Remix + Supabase stack using **webhook-driven architecture** and **Row Level Security**.
* ✅ Follow "Personas" design language for UI polish with educational content cards.

**⚠️ Production Deployment Required**: Core system implemented but webhook endpoint needs production deployment.

---

## 2 – Implemented Flow (Webhook-Driven)

```mermaid
flowchart TD
    %% User Onboarding Flow
    U1[User: Welcome Screen] --> U2[User: Questions Screen]
    U2 --> U3[User: Upload Screen]
    U3 --> U4[User: Processing Screen]

    %% Backend Pipeline
    U3 -->|POST /api/onboarding-start| API[Onboarding API]
    API -->|1. Create| P[Project + Interview]
    API -->|2. Upload to| AAI[AssemblyAI /upload]
    API -->|3. Start transcription| AAI2[AssemblyAI /transcript]
    API -->|4. Insert| UJ[upload_jobs table]

    %% Interview Status Updates
    P -->|account_id = user.sub| I1[interview.status = 'uploaded']

    %% Webhook-Driven Processing
    AAI2 -.->|webhook callback| WH[/api/assemblyai-webhook]
    WH -->|1. Update interview| I2[interview.status = 'transcribed']
    WH -->|2. Create| AJ[analysis_jobs]
    WH -->|3. Queue analysis| BAML[BAML Processing]

    %% Real-time UI Updates
    I1 -.->|Supabase Realtime| U4
    I2 -.->|Supabase Realtime| U4
    BAML -->|Complete| I3[interview.status = 'ready']
    I3 -.->|Supabase Realtime| U5[User: Completion]

    %% RLS & Authentication
    P -->|RLS Policy| RLS[account_id = auth.uid()]
    UJ -->|RLS Policy| RLS2[team account access]

    %% Critical Production Issue
    WH -.->|⚠️ NOT DEPLOYED| PROD[upsight.fly.dev]

    classDef user fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef database fill:#e8f5e8
    classDef external fill:#fff3e0
    classDef realtime fill:#fce4ec
    classDef issue fill:#ffebee

    class U1,U2,U3,U4,U5 user
    class API,WH api
    class P,I1,I2,I3,UJ,AJ,RLS,RLS2 database
    class AAI,AAI2,BAML external
    class U4 realtime
    class PROD issue
```

**Key Implementation Details:**
* **Webhook-driven**: No polling workers - AssemblyAI calls our webhook directly
* **Personal ownership**: `interview.account_id = user.sub` for simple RLS
* **Real-time updates**: Supabase Realtime pushes status changes to UI instantly
* **⚠️ Production blocker**: Webhook endpoint not deployed to production

---

## 3 – Postgres Changes

### 3.1 Enums

```sql
create type job_status as enum ('pending','in_progress','done','error','retry');
-- Existing interview_status already covers UI states.
```

### 3.2 Queue Tables

```sql
-- 1. upload_jobs
create table upload_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  media_file bytea,        -- temporary storage for direct uploads (or external_url)
  external_url text,
  attempts int default 0,
  last_error text,
  status job_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. transcription_jobs
create table transcription_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  upload_url text,           -- URL returned by AssemblyAI /upload
  transcript text,
  attempts int default 0,
  last_error text,
  status job_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. analysis_jobs
create table analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  transcript text,
  progress int default 0,    -- % of BAML chunks processed
  attempts int default 0,
  last_error text,
  status job_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

*All tables inherit **RLS** from `interviews` via policy: only account members can access rows of interviews they own.*

### 3.3 Triggers

```sql
create trigger set_timestamp before insert or update
  on upload_jobs for each row execute procedure accounts.trigger_set_timestamps();
-- repeat for each queue table
```

---

## 4 – Workers

| Worker | Queue | Responsibilities | Checkpoints / Resume |
|--------|-------|------------------|----------------------|
| **upload-worker** (Edge Function or Node cron) | upload_jobs | • Stream multipart file to AssemblyAI `/upload` &rarr; save `upload_url` in transcription_jobs<br>• Update interview.status = 'uploaded' | Job row holds `last_error`, increments `attempts`; on retry, skip upload if `upload_url` already set |
| **transcription-worker** | transcription_jobs | • Call `/transcript` polling until complete<br>• Store full transcript text in row &rarr; enqueue analysis_job<br>• Update interview.status = 'transcribed' | If interrupted after transcript saved, worker detects and proceeds to enqueue analysis_jobs |
| **analysis-worker** | analysis_jobs | • Run `processInterviewTranscript` (modified to accept raw transcript) chunk-by-chunk, updating `progress` | `progress` field allows resume mid-analysis; failures keep partial DB inserts but are idempotent via UPSERT |

Workers use **pg_boss** (runs inside Supabase pg) or **supabase-js** polling if pg_boss not available.

---

## 5 – UI Integration

### 5.1 Realtime Subscription Hook

```ts
const { data: interview } = useRealtimeRow<Interview>('interviews', interviewId);
```

Hook subscribes to `UPDATE` events on `interviews`. Onboard widget maps:

| interview.status | Progress % | Label |
|------------------|-----------|-------|
| uploaded | 20 | "File uploaded" |
| transcribed | 50 | "Transcription complete" |
| processing | 70…99 (analysis_jobs.progress) | "Analyzing…" |
| ready | 100 | "Ready!" |
| error | -- | show red banner |

### 5.2 Styling Notes

* Use existing `Card` + `progress bar` but adopt **Personas palette**: primary ‑-> teal, secondary ‑-> neutral 100.
* Icons: `Upload`, `Waveform`, `Sparkles`, `CheckCircle`.
* Motion: subtle fade/slide as steps complete.

---

## 6 – Error-Handling & Resumes

1. **Transactional updates**: each worker step wrapped in `begin … commit`.
2. On error, set `status = 'error'`, store message, **do not** delete partial data.
3. Retry scheduler picks oldest `error` or `pending` with `attempts < 5`.
4. Resume logic checks which columns already filled to skip completed sub-steps.

---

## 7 – Monitoring & Alerts (Future)

* Expose **pg_boss_statistics** view in Grafana.
* Slack webhook on queue backlog > threshold or job error.
* Sentry integration in worker runtimes.

---

## 8 – Deployment

* Local & prod: Supabase Edge Functions schedule or Fly.io sidecar.
* Schemas `supabase/schemas/80_jobs` generate migrations in `/supabase/migrations/*_transcription_pipeline.sql`.

---

## 9 – Implementation Status & Results

### ✅ Major Achievements

* [x] **Complete pipeline implementation** - End-to-end queue system with upload_jobs and analysis_jobs
* [x] **Webhook-driven architecture** - AssemblyAI webhook processing for instant updates (no polling)
* [x] **Real-time progress tracking** - Supabase Realtime websocket integration working (401 → 101)
* [x] **Onboarding UX** - 4-step flow: welcome → questions → upload → processing with educational content
* [x] **RLS authentication fixed** - Resolved complex team-based access issues
* [x] **API integration** - `/api/onboarding-start` and `/api/assemblyai-webhook` endpoints working
* [x] **Database schemas** - Queue tables, triggers, and policies deployed
* [x] **Production deployment** - Webhook endpoints live and processing transcriptions successfully
* [x] **Memory optimization** - Increased to 2GB to handle large file uploads and processing
* [x] **Mastra integration** - Fixed missing instrumentation.mjs for AI agent workflows

### 🎯 Technical Decisions Made

**Interview Ownership Model Changed:**
- **Before**: `account_id = teamAccountId` (complex team-based RLS)
- **After**: `account_id = user.sub` (simple personal ownership)
- **Rationale**: Reliable RLS with `account_id = auth.uid()` vs complex team membership checks
- **Team Access**: Handled via project membership (projects remain team-owned)

**Webhook vs Polling:**
- **Implementation**: Direct webhook callbacks from AssemblyAI
- **Benefit**: Sub-second latency vs 1-minute polling intervals
- **URL**: `https://upsight.fly.dev/api/assemblyai-webhook`

### ✅ Critical Issues RESOLVED

* [x] **PRODUCTION DEPLOYMENT COMPLETE** - Webhook endpoints live and processing transcriptions
  - AssemblyAI webhook processing working in production
  - Complete end-to-end flow: upload → transcription → webhook → analysis → completion
  - **Result**: Pipeline fully operational for users

* [x] **Memory optimization completed** - Fixed OOM errors during large file processing
  - Increased memory allocation from 1GB to 2GB
  - Prevents process kills during intensive analysis operations
  - **Result**: Stable processing for 90MB+ audio files

* [x] **Mastra configuration fixed** - AI agent system now operational
  - Created missing instrumentation.mjs file
  - Resolved module loading issues for AI workflows
  - **Result**: Chat agents and AI tools accessible

### ⚠️ Known Risks & Limitations

**Architecture Inconsistencies:**
- Interviews are personal-owned, but projects are team-owned
- Team collaboration on interviews requires future enhancement
- Account vs User ID confusion in some legacy code paths

**Production Stability:**
- Single point of failure in webhook endpoint
- No monitoring/alerting on queue backlog
- Limited error recovery for network failures

**Scale Considerations:**
- Large file uploads may timeout (>10MB files)
- Concurrent processing limits not tested
- AssemblyAI rate limiting not handled


## 10 – Queue Retrieval Strategy (Cron vs Triggers)

Supabase scheduled **Edge Function cron** jobs currently execute at a minimum 1-minute granularity.
That is acceptable for low-volume workloads but too slow for “near-real-time” UX.
To achieve sub-second latency we will use Postgres **LISTEN / NOTIFY**:

1. Each worker issues `LISTEN upload_jobs_channel` (or transcription/analysis).
2. A simple **AFTER INSERT trigger** on each queue table does
   `PERFORM pg_notify('upload_jobs_channel', NEW.id::text);`
3. Worker wakes instantly, starts the job, and later sets `status = 'in_progress'`.

Fallback: if the worker dies, a periodic cron (every 1 min) scans for `status = 'pending' AND created_at < now() - interval '1 minute'` to guarantee progress.

This hybrid model = fast path (trigger) + safety net (cron).

---

## 11 – Enhanced Job Status & User-Facing States

Internal `job_status` enum remains (`pending / in_progress / done / error / retry`).
Add a **`status_detail text`** column to each queue table for granular messages (“AssemblyAI upload 60 %”, “GPT chunk 3/10”).

Interview table still drives the **user-facing enum**:

| interview.status | Meaning shown in UI |
|------------------|---------------------|
| uploaded         | “Uploading file” or **20 %** |
| transcribed      | “Transcribing” or **50 %** |
| processing       | “Analyzing insights” (progress bar reads 70-99 %) |
| ready            | “Ready” (100 %) |
| error            | “Processing failed – retrying” |

The frontend subscription hook maps interview.status + optional analysis_jobs.progress to the progress bar.

---

## 12 – Fly.io Sidecar Pattern

For production we deploy **two processes** in one Fly.io app:

* `web`  – Remix/React server (existing Dockerfile).
* `worker` – Node container (same image) launched via `[processes]` in `fly.toml`.

Both share environment vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
The sidecar pattern keeps Postgres connection latency low (worker runs next to web) and simplifies CI/CD (single deploy command).

---

## 13 – Declarative Schema & Migration Generation

The project uses **Supabase declarative SQL** (`supabase/schemas/*.sql`).
Running `supabase db diff` automatically generates migration files (placed in `supabase/migrations/`).
The new queue tables and enum are added declaratively first, then the diff tool created
[`20250807000100_create_transcription_pipeline.sql`](../../supabase/migrations/20250807000100_create_transcription_pipeline.sql).

---

## 14 – Current Implementation Process Flow

### Simplified Pipeline Process Flow

| **Step** | **Who Does It** | **What Happens** | **Database Changes** | **Credentials Used** |
|----------|-----------------|------------------|---------------------|---------------------|
| **1. User Upload** | `api.onboarding-start.tsx` | User uploads file → AssemblyAI transcription starts | • `interview` created (`status = 'uploaded'`)<br/>• `upload_job` created with `assemblyai_id`<br/>• `user_settings.onboarding_completed = true` | **Admin Client** (RLS bypass) |
| **2. External Processing** | AssemblyAI Cloud | File transcription with speaker detection | *No database changes* | AssemblyAI API Key |
| **3. Webhook Handler** | `api.assemblyai-webhook.tsx` | **Idempotency Check**: `if (uploadJob.status === 'done') return`<br/>**Webhook**: Receives `{transcript_id, status: "completed"}`<br/>**Fetch**: Gets full transcript data from AssemblyAI API | • **Check**: Skip if already processed<br/>• Update `interview.status = 'transcribed'` (50%)<br/>• Update `upload_job.status = 'done'` | **Admin Client** |
| **4. Analysis Processing** | Same webhook call | **Status Update**: `interview.status = 'processing'` (85%)<br/>**Create**: `analysis_job` with `status = 'in_progress'`<br/>**Process**: Complete BAML analysis via `processInterviewTranscriptWithAdminClient()` | • Update `interview.status = 'processing'`<br/>• Create `analysis_job` record<br/>• **Complete BAML processing**<br/>• Store all `insights`, `people`, `personas` with nullable audit fields<br/>• Update `analysis_job.status = 'done'`<br/>• Update `interview.status = 'ready'` (100%) | **Admin Client** + `userId` for audit fields |

**Key Simplifications:**
- **Steps 3-7** all happen in one webhook call - no separate job queue
- **Direct processing** instead of worker polling
- **Single admin client** used throughout webhook processing
- **End-to-end completion** in ~21 seconds

### ✅ Critical Issues RESOLVED

**✅ FIXED: Credential Consistency**
- Webhook Handler uses **Admin Client** throughout processing chain
- Interview Processor now has webhook-specific version `processInterviewTranscriptWithAdminClient()`
- **Solution**: Admin client passed directly, no authentication chain breaks

**✅ FIXED: Mock Request Anti-Pattern Eliminated**
- No longer creating fake `Request` objects for system operations
- **Solution**: Created `processInterviewTranscriptWithAdminClient()` that accepts admin client directly
- **Result**: Clean webhook processing without authentication workarounds

**✅ FIXED: RLS Policy Consistency**
- Admin client bypasses RLS throughout entire processing chain
- **Solution**: Webhook operations are system events using service role credentials
- **Security**: Webhook authentication validates legitimacy, admin client handles data operations

### ✅ Implementation: Clean Admin Client Architecture

**Best Practice Achieved**: Admin credentials used for entire webhook processing chain
- **Why**: Webhooks are system events, not user actions
- **Security**: Maintained via AssemblyAI webhook authentication + service role key
- **Implementation**: `processInterviewTranscriptWithAdminClient()` function for webhooks
- **Result**: No mock requests, consistent credentials, reliable processing

---

## 15 – Future "Generation" Queue

Add a generic **`generation_jobs`** table (same pattern) for large-scale content creation:

```sql
create table generation_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts.accounts(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  payload jsonb,          -- arbitrary generation parameters
  result  jsonb,
  status  job_status default 'pending',
  status_detail text,
  attempts int default 0,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Trigger + LISTEN/NOTIFY channel `generation_jobs_channel`.
UI "Generate report" button inserts a row; worker picks it up to build topic clusters, summaries, or other AI-generated artefacts.


## Added 8/26/2025

### 🛠️ Critical Conventions to Remember

**Webhook Authentication Pattern:**

- Webhooks ALWAYS use `createSupabaseAdminClient()` (no user context)
- Pass `userId` from interview record for audit fields: `created_by: metadata.userId`
- Admin client bypasses RLS - use for all system operations

**ID Usage Conventions:**

- `interview.account_id` = `user.sub` (personal ownership, auth.uid())
- `metadata.userId` = `interview.account_id` for audit fields
- `metadata.accountId` = `interview.account_id` for data scoping

**Status Progression Pipeline:**

```
uploaded (20%) → transcribed (50%) → processing (85%) → ready (100%)
```

**Database Schema Notes:**

- Audit fields (`created_by`, `updated_by`) are nullable to support admin operations
- Upload jobs have idempotency via status check: `if (uploadJob.status === 'done') return`
- Always update interview status before each major processing step
